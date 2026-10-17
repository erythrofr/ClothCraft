"""Run a configured Garment Studio PPF Blender scene through macOS native.

Usage:
  blender scene.blend --background --python ppf_run_configured.py -- \
    --runtime /path/to/ppf-runtime --output solved.blend --report report.json
"""

from __future__ import annotations

import argparse
import fcntl
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ppf_headless import ensure_ppf_registered


def args_from_blender():
    raw = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--port', type=int, default=19090)
    parser.add_argument('--device', default='GPU', choices=['GPU', 'CPU'])
    parser.add_argument('--connect-timeout', type=float, default=60.0)
    parser.add_argument('--build-timeout', type=float, default=240.0)
    parser.add_argument('--run-timeout', type=float, default=600.0)
    parser.add_argument('--fetch-timeout', type=float, default=120.0)
    parser.add_argument('--project-name')
    parser.add_argument('--build-only', action='store_true')
    return parser.parse_args(raw)


def ppf_modules():
    ensure_ppf_registered()
    pkg = 'bl_ext.user_default.ppf_contact_solver'
    facade = __import__(pkg + '.core.facade', fromlist=['engine', 'runner', 'tick', 'communicator'])
    events = __import__(pkg + '.core.events', fromlist=['PollTick', 'QueryRequested'])
    encoder_mesh = __import__(pkg + '.core.encoder.mesh', fromlist=['encode_obj'])
    encoder_param = __import__(pkg + '.core.encoder.params', fromlist=['encode_param'])
    client = __import__(pkg + '.core.client', fromlist=['apply_animation'])
    groups = __import__(pkg + '.models.groups', fromlist=['get_addon_data'])
    return pkg, facade, events, encoder_mesh, encoder_param, client, groups


def tick_until(facade, events, predicate, timeout, interval=0.15, description='state', failure_grace=0.0):
    deadline = time.time() + timeout
    started = time.time()
    last = None
    while time.time() < deadline:
        facade.engine.dispatch(events.PollTick())
        facade.tick()
        state = facade.engine.state
        last = {
            'phase': state.phase.name,
            'server': state.server.name,
            'solver': state.solver.name,
            'activity': state.activity.name,
            'frame': int(state.frame or 0),
            'error': getattr(state, 'error', '') or '',
        }
        if predicate(state):
            return last
        # A .blend can persist the previous solver result. Starting a new
        # upload/build transitions activity to SENDING before the fresh solver
        # status arrives, so treating a stale FAILED value as terminal here
        # aborts a valid new build before the server even starts it. Only fail
        # once the current activity has settled back to IDLE.
        if (
            state.solver.name == 'FAILED'
            and state.activity.name == 'IDLE'
            and time.time() - started >= failure_grace
        ):
            raise RuntimeError(f'{description} failed: {last}')
        time.sleep(interval)
    raise TimeoutError(f'{description} timed out after {timeout}s: {last}')


def read_pc2(path):
    with open(path, 'rb') as handle:
        magic = handle.read(12)
        version, n_verts = struct.unpack('<II', handle.read(8))
        start, sample_rate = struct.unpack('<ff', handle.read(8))
        (n_samples,) = struct.unpack('<I', handle.read(4))
        body = handle.read(n_samples * n_verts * 3 * 4)
    array = np.frombuffer(body, dtype='<f4').reshape(n_samples, n_verts, 3)
    return {
        'magic': magic.decode('latin-1', errors='ignore'),
        'version': version,
        'vertices': n_verts,
        'samples': n_samples,
        'start': start,
        'sampleRate': sample_rate,
        'array': array,
    }


def mesh_cache_path(obj):
    for modifier in obj.modifiers:
        if modifier.type == 'MESH_CACHE' and modifier.cache_format == 'PC2' and modifier.filepath:
            return bpy.path.abspath(modifier.filepath)
    return None


def persist_pc2_cache(garment, source_path, output_blend):
    """Keep the PPF animation alive after an isolated service job is deleted.

    The solver writes cache files beside its temporary *configured* Blender
    project, but our final .blend is saved in the permanent output directory.
    Without copying and relinking the cache, the exported .blend loses all
    frames as soon as the temporary job directory is cleaned up.
    """
    source = Path(source_path).resolve()
    target = output_blend.parent / 'data' / output_blend.stem / source.name
    target.parent.mkdir(parents=True, exist_ok=True)
    if source != target.resolve():
        shutil.copy2(source, target)
    for modifier in garment.modifiers:
        if modifier.type == 'MESH_CACHE' and modifier.cache_format == 'PC2':
            modifier.filepath = str(target)
    return str(target)


def scrub_stale_runtime_markers(runtime, project_name):
    """Mirror current upstream PPF server sentinel cleanup for older runtimes.

    The Sep-22 macOS runtime can leave an empty crash_signal/status marker
    behind after a prior run. The current upstream server explicitly removes
    those files before launch; without that fix the Blender add-on can observe
    the stale terminal state and report a fresh build as FAILED before the new
    solver process starts.
    """
    share_root = Path(runtime) / 'local' / 'share' / 'ppf-cts'
    markers = (
        'save_and_quit',
        'finished.txt',
        'status.cbor',
        'terminate_request',
        'crash_signal',
        'hold_at_frame',
        'held',
        'inputs_updated',
    )
    removed = []
    if not share_root.exists():
        return removed
    for output_dir in share_root.glob(f'*/{project_name}/session/output'):
        for marker in markers:
            candidate = output_dir / marker
            if not candidate.exists():
                continue
            try:
                candidate.unlink()
                removed.append(str(candidate))
            except OSError:
                pass
    return removed


def acquire_runtime_lock(runtime):
    """Prevent multiple headless PPF clients sharing one runtime data root.

    PPF project names and TCP ports can differ while the packaged runtime still
    shares process/session state beneath ``local/share/ppf-cts``. Concurrent
    Garment Studio jobs were observed causing a geometry-clean build to report
    FAILED with no violations. Serialize them at the runtime boundary.
    """
    lock_path = Path(runtime) / 'local' / 'share' / 'ppf-cts' / '.garment-studio.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open('a+')
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as exc:
        handle.close()
        raise RuntimeError(f'Another Garment Studio PPF job is already using this runtime: {lock_path}') from exc
    handle.seek(0)
    handle.truncate()
    handle.write(f'{os.getpid()}\n')
    handle.flush()
    return handle


def find_project_session(runtime, project_name):
    share_root = Path(runtime) / 'local' / 'share' / 'ppf-cts'
    matches = sorted(share_root.glob(f'*/{project_name}/session'))
    return matches[-1] if matches else None


def frame_indices(output_dir):
    indices = []
    if not output_dir or not output_dir.exists():
        return indices
    for path in output_dir.glob('vert_*.bin'):
        try:
            indices.append(int(path.stem.split('_', 1)[1]))
        except (TypeError, ValueError, IndexError):
            continue
    return sorted(set(indices))


def solver_process_alive(session_dir):
    if session_dir is None:
        return False
    probe = subprocess.run(
        ['pgrep', '-f', str(session_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return probe.returncode == 0


def real_crash_signal(output_dir):
    path = output_dir / 'crash_signal'
    try:
        return path.read_text().strip()
    except OSError:
        return ''


def wait_native_frames(runtime, project_name, expected_last_frame, timeout):
    """Trust the solver artifacts when an older server misreports FAILED.

    The Sep-22 Metal runtime opens an empty ``crash_signal`` at process start.
    Current upstream treats that empty file as no signal, but the matching old
    supervisor can flip to FAILED while the solver is visibly alive and still
    writing ``vert_N.bin``. Keep Blender alive and follow the native artifacts
    instead; a non-empty crash signal remains terminal.
    """
    deadline = time.time() + timeout
    session_dir = None
    output_dir = None
    last_indices = []
    last_progress = time.time()
    while time.time() < deadline:
        if session_dir is None:
            session_dir = find_project_session(runtime, project_name)
            output_dir = session_dir / 'output' if session_dir else None
        indices = frame_indices(output_dir) if output_dir else []
        if indices != last_indices:
            last_indices = indices
            last_progress = time.time()
        if indices and indices[-1] >= expected_last_frame:
            return {
                'sessionDir': str(session_dir),
                'outputDir': str(output_dir),
                'frames': len(indices),
                'lastFrame': indices[-1],
                'finished': bool((output_dir / 'finished.txt').exists()),
                'solverAlive': solver_process_alive(session_dir),
                'crashSignal': real_crash_signal(output_dir),
            }
        if output_dir:
            signal = real_crash_signal(output_dir)
            if signal:
                raise RuntimeError(f'PPF native solver received fatal signal: {signal}')
            alive = solver_process_alive(session_dir)
            if not alive and indices:
                finished = (output_dir / 'finished.txt').exists()
                if finished:
                    return {
                        'sessionDir': str(session_dir),
                        'outputDir': str(output_dir),
                        'frames': len(indices),
                        'lastFrame': indices[-1],
                        'finished': True,
                        'solverAlive': False,
                        'crashSignal': '',
                    }
                raise RuntimeError(
                    f'PPF native solver stopped at frame {indices[-1]} without a completion marker'
                )
            if indices and time.time() - last_progress > 90.0:
                raise TimeoutError(f'PPF native solver made no frame progress for 90s (last frame {indices[-1]})')
        time.sleep(0.25)
    raise TimeoutError(f'PPF native artifact monitor timed out; last frames={last_indices[-5:]}')


def read_vertex_frame(path, n_verts):
    body = Path(path).read_bytes()
    expected = n_verts * 3 * 4
    if len(body) != expected:
        raise RuntimeError(f'Unexpected PPF vertex frame size: {len(body)} != {expected}')
    return np.frombuffer(body, dtype='<f4').reshape(n_verts, 3).copy()


def solver_to_blender(array):
    converted = np.empty_like(array)
    converted[:, 0] = array[:, 0]
    converted[:, 1] = -array[:, 2]
    converted[:, 2] = array[:, 1]
    return converted


def apply_direct_frame(garment, frame_array):
    if len(garment.data.vertices) != frame_array.shape[0]:
        raise RuntimeError(
            f'PPF direct frame vertex count mismatch: {frame_array.shape[0]} != {len(garment.data.vertices)}'
        )
    coords = solver_to_blender(frame_array)
    flat = coords.astype(np.float32, copy=False).reshape(-1)
    garment.data.vertices.foreach_set('co', flat)
    garment.data.update()
    return coords


def main():
    args = args_from_blender()
    runtime = str(Path(args.runtime).resolve())
    runtime_lock = acquire_runtime_lock(runtime)
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    pkg, facade, events, encoder_mesh, encoder_param, client, groups = ppf_modules()
    com = facade.communicator

    root = groups.get_addon_data(bpy.context.scene)
    # Use an isolated native-server project by default. Older PPF server
    # builds persist terminal solver state per project; reusing a .blend whose
    # project is still named "unnamed" can make a fresh headless build inherit
    # the previous FAILED/frame state before any new geometry is uploaded.
    project_name = args.project_name or f'garment_studio_ppf_{os.getpid()}'
    root.state.project_name = project_name
    root.ssh_state.server_type = 'MAC_NATIVE'
    root.ssh_state.mac_native_path = runtime
    root.ssh_state.docker_port = int(args.port)
    root.ssh_state.native_device = args.device
    com.set_project_name(project_name)

    report = {
        'runtime': runtime,
        'device': args.device,
        'port': args.port,
        'project': project_name,
        'phases': [],
    }

    report['staleMarkersRemoved'] = scrub_stale_runtime_markers(runtime, project_name)

    # Connect; production communicator spawns the local server itself.
    report['phases'].append('connect')
    com.connect_mac_native(runtime, args.port, args.device)
    report['connectState'] = tick_until(
        facade, events,
        lambda s: s.phase.name == 'ONLINE',
        args.connect_timeout,
        description='macOS native connection',
    )

    # Native connect resolves the runtime and establishes the host-side
    # connection. Starting the actual solver server is a distinct state
    # transition in the production UI/API.
    if facade.engine.state.server.name != 'RUNNING':
        report['phases'].append('start_server')
        com.start_server(device=args.device)
        report['serverState'] = tick_until(
            facade, events,
            lambda s: s.phase.name == 'ONLINE' and s.server.name == 'RUNNING',
            args.connect_timeout,
            description='PPF native server startup',
        )

    report['backendType'] = getattr(com.connection, 'type', '')
    report['resolvedRuntime'] = getattr(com.connection, 'current_directory', '')

    # Encode the exact Blender scene the add-on will send in interactive use.
    report['phases'].append('encode')
    data_bytes = encoder_mesh.encode_obj(bpy.context)
    param_bytes = encoder_param.encode_param(bpy.context)
    report['payloadBytes'] = {'geometry': len(data_bytes), 'params': len(param_bytes)}

    # Upload + build atomically.
    report['phases'].append('build')
    com.build_pipeline(data=data_bytes, param=param_bytes, message='Garment Studio PPF regression')
    report['buildState'] = tick_until(
        facade, events,
        lambda s: s.activity.name == 'IDLE' and s.solver.name in ('READY', 'RESUMABLE'),
        args.build_timeout,
        description='PPF build',
        failure_grace=3.0,
    )

    if args.build_only:
        output.parent.mkdir(parents=True, exist_ok=True)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        report['phases'].append('saved_build_only')
        report['ok'] = True
        report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
        try:
            com.disconnect()
        except Exception:
            pass
        runtime_lock.close()
        return

    # Run. Require actual frame growth so a stale READY state cannot false-pass.
    report['phases'].append('run')
    start_frame = int(facade.engine.state.frame or 0)
    com.run()
    saw_progress = False
    deadline = time.time() + args.run_timeout
    while time.time() < deadline:
        facade.engine.dispatch(events.PollTick())
        facade.tick()
        state = facade.engine.state
        if state.solver.name == 'FAILED':
            # Sep-22 native server can report FAILED from its empty
            # crash_signal placeholder even while the Metal process is alive.
            # Defer the verdict to direct artifact monitoring below.
            break
        if state.solver.name == 'RUNNING' or int(state.frame or 0) > start_frame:
            saw_progress = True
        if saw_progress and state.activity.name == 'IDLE' and state.solver.name in ('READY', 'RESUMABLE'):
            break
        time.sleep(0.05)
    else:
        raise TimeoutError(f'PPF run timed out at frame {facade.engine.state.frame}')
    if not saw_progress and facade.engine.state.solver.name != 'FAILED':
        raise RuntimeError('PPF run never advanced a frame')

    expected_last_frame = max(0, int(root.state.frame_count) - 1)
    if facade.engine.state.solver.name == 'FAILED':
        report['phases'].append('direct_native_monitor')
        direct = wait_native_frames(runtime, project_name, expected_last_frame, args.run_timeout)
        report['directNative'] = direct
        garment = bpy.data.objects.get('PPF_Garment')
        if garment is None:
            raise RuntimeError('PPF_Garment missing during direct native recovery')
        output_dir = Path(direct['outputDir'])
        first_native = read_vertex_frame(output_dir / 'vert_0.bin', len(garment.data.vertices))
        last_native = read_vertex_frame(output_dir / f"vert_{direct['lastFrame']}.bin", len(garment.data.vertices))
        apply_direct_frame(garment, last_native)
        displacement = np.linalg.norm(last_native - first_native, axis=1)
        report['nativeFrames'] = {
            'samples': direct['frames'],
            'lastFrame': direct['lastFrame'],
            'finite': bool(np.all(np.isfinite(last_native))),
            'meanDisplacementM': float(np.mean(displacement)),
            'maxDisplacementM': float(np.max(displacement)),
            'path': str(output_dir),
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        report['phases'].append('saved_direct_native')
        report_path.write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
        try:
            com.disconnect()
        except Exception:
            pass
        return

    # Force a final status query; terminal PollTick can stop querying.
    expected_frames = max(1, int(root.state.frame_count) - 1)
    query_deadline = time.time() + 60.0
    while time.time() < query_deadline and int(facade.engine.state.frame or 0) < expected_frames:
        if not facade.engine.state.busy:
            facade.engine.dispatch(events.QueryRequested(request={}, message='Garment Studio final frame query'))
        facade.tick()
        time.sleep(0.15)
    report['runState'] = {
        'solver': facade.engine.state.solver.name,
        'activity': facade.engine.state.activity.name,
        'frame': int(facade.engine.state.frame or 0),
        'expectedFrames': expected_frames,
    }

    # Fetch and synchronously drain animation frames because headless Blender
    # does not service modal UI timers while this script owns the main thread.
    report['phases'].append('fetch')
    facade.runner.clear_fetched_frames()
    com.fetch()
    deadline = time.time() + args.fetch_timeout
    while time.time() < deadline:
        facade.engine.dispatch(events.PollTick())
        facade.tick()
        state = facade.engine.state
        if state.solver.name == 'FAILED':
            raise RuntimeError(f'PPF fetch failed: {getattr(state, "error", "")}')
        if state.activity.name in ('APPLYING', 'IDLE'):
            break
        time.sleep(0.15)

    applied = total = queued = 0
    deadline = time.time() + args.fetch_timeout
    while time.time() < deadline:
        facade.tick()
        client.apply_animation()
        with facade.runner._anim_lock:
            queued = len(facade.runner._anim_frames)
            applied = int(facade.runner._anim_applied)
            total = int(facade.runner._anim_total)
        if queued == 0 and total > 0 and applied >= total:
            break
        time.sleep(0.08)
    report['fetch'] = {'applied': applied, 'total': total, 'queued': queued}

    garment = bpy.data.objects.get('PPF_Garment')
    if garment is None:
        raise RuntimeError('PPF_Garment missing after solve')
    pc2_path = mesh_cache_path(garment)
    if not pc2_path or not os.path.exists(pc2_path):
        raise RuntimeError(f'No PC2 cache attached to PPF_Garment: {pc2_path}')
    pc2 = read_pc2(pc2_path)
    array = pc2.pop('array')
    finite = bool(np.all(np.isfinite(array)))
    if not finite:
        raise RuntimeError('Fetched PPF PC2 contains non-finite values')

    displacement = np.linalg.norm(array[-1] - array[0], axis=1) if array.shape[0] >= 2 else np.zeros(array.shape[1])
    pc2_path = persist_pc2_cache(garment, pc2_path, output)
    report['pc2'] = {
        **pc2,
        'path': pc2_path,
        'finite': finite,
        'meanDisplacementM': float(np.mean(displacement)),
        'maxDisplacementM': float(np.max(displacement)),
    }
    cache = getattr(facade.runner, '_response_cache', {})
    response = getattr(cache, 'last_response', cache if isinstance(cache, dict) else {}) or {}
    report['serverResponse'] = {
        key: value for key, value in response.items()
        if key in ('status', 'frame', 'error', 'saved_states', 'backend', 'device')
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    report['phases'].append('saved')
    report['ok'] = True
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report))

    try:
        com.disconnect()
    except Exception:
        pass
    # Keep the descriptor alive until every server/fetch action above has
    # finished; closing it releases the advisory flock automatically.
    runtime_lock.close()


def write_failure_report(exc):
    """Always leave a machine-readable result for service/CI callers.

    Blender's user add-on shutdown can itself emit unrelated unregister
    errors in background mode. Catching the actual solve exception here keeps
    that shutdown noise from becoming the only observable failure signal.
    """
    try:
        args = args_from_blender()
        report_path = Path(args.report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            'ok': False,
            'error': f'{type(exc).__name__}: {exc}',
            'runtime': str(Path(args.runtime).resolve()),
            'device': args.device,
            'port': args.port,
        }
        report_path.write_text(json.dumps(payload, indent=2))
        print(json.dumps(payload))
    except Exception as report_exc:
        print(json.dumps({
            'ok': False,
            'error': f'{type(exc).__name__}: {exc}',
            'reportError': f'{type(report_exc).__name__}: {report_exc}',
        }))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        write_failure_report(exc)
        # Do not re-raise inside Blender. The structured report is the source
        # of truth for the wrapper/service, and a normal Python return avoids
        # turning an add-on unregister warning into a macOS Blender crash.
