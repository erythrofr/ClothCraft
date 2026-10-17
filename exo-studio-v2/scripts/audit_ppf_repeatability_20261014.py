"""Analyze whether PPF mesh outputs reproduce from identical input scenarios.

This is read-only to independent saved Metal sessions; it compares the saved
cloth/pin motion and scene hashes without assuming a solver is deterministic.
It also distinguishes differences caused by a changed run horizon (`frames`)
from repeat trials with the same advertised configuration.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import tomllib
import numpy as np


ASSET_FILES = ['vert.bin','tri.bin','pin-ind-0.bin','stitch_ind.bin','stitch_w.bin']


def hash_file(filename):
    source=hashlib.sha256()
    with open(filename,'rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024),b''):
            source.update(chunk)
    return source.hexdigest()


def magnitude_stats(values):
    a=np.asarray(values,dtype=np.float64)*1000
    return {'medianMm':round(float(np.median(a)),6),
            'p95Mm':round(float(np.percentile(a,95)),6),
            'maxMm':round(float(a.max()),6)}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--runs',type=Path,nargs='+',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--compare-up-to',type=int,default=95)
    args=p.parse_args()
    if len(args.runs)<2 or args.compare_up_to<0:
        raise ValueError('Specify >=2 runs and a nonnegative final frame index')
    sessions=[]
    for filename in args.runs:
        run=json.loads(filename.read_text())
        session=Path(run['sessionPath'])
        config=tomllib.loads((session/'param.toml').read_text())['param']
        hashes={name:hash_file(session/'bin'/name) for name in ASSET_FILES}
        hashes['pinKeyframesSha256']=hashlib.sha256(''.join(
            hash_file(session/'bin'/f'pin-0-op-{i}.bin') for i in range(120)).encode()).hexdigest()
        sessions.append({'run':run,'session':session,'params':config,'hashes':hashes,
                         'seed':run.get('originalRandomSeed',0),
                         'jitter':run.get('jitter',run.get('randomJitter'))})
    common=sessions[0]['hashes']
    if any(x['hashes']!=common for x in sessions[1:]):
        raise ValueError('Cannot compare reproducibility: distinct rest geometry/topology/stitches/keyframes')
    if any(x['jitter']!=sessions[0]['jitter'] for x in sessions[1:]):
        raise ValueError('Cannot compare reproducibility: distinct body offset jitter')
    if any(x['seed']!=sessions[0]['seed'] for x in sessions[1:]):
        raise ValueError('Cannot compare reproducibility: distinct random seeds')
    source=sessions[0]
    original=source['session']
    vertices=np.fromfile(original/'bin/vert.bin',dtype='<f8').reshape(-1,3)
    pinnedInd=np.fromfile(original/'bin/pin-ind-0.bin',dtype='<u8')
    pinned=np.zeros(len(vertices),dtype=bool);pinned[pinnedInd]=True

    comparisons=[]
    for second in sessions[1:]:
        differing={key:[source['params'].get(key),second['params'].get(key)]
                   for key in set(source['params'])|set(second['params'])
                   if source['params'].get(key)!=second['params'].get(key)}
        if set(differing)-{'frames'}:
            raise ValueError('Uncontrolled solver parameters differ: '+str(differing))
        # Preserve the run-horizon confound explicitly.
        limit=min(args.compare_up_to,source['params']['frames'],second['params']['frames'])
        rows=[]
        for frame in range(limit+1):
            pa=original/'output'/f'vert_{frame}.bin'
            pb=second['session']/'output'/f'vert_{frame}.bin'
            if not pa.exists() or not pb.exists():break
            a=np.fromfile(pa,dtype='<f4').reshape(-1,3)
            b=np.fromfile(pb,dtype='<f4').reshape(-1,3)
            if a.shape!=vertices.shape or b.shape!=vertices.shape:
                raise ValueError('Bad output dimensions')
            displacements=np.linalg.norm(a.astype('f8')-b.astype('f8'),axis=1)
            rows.append({'frame':frame,'bitwiseIdentical':bool(np.array_equal(a,b)),
                         'allVertices':magnitude_stats(displacements),
                         'clothVertices':magnitude_stats(displacements[~pinned]),
                         'pinnedVertices':magnitude_stats(displacements[pinned])})
        comparisons.append({'reference':source['run']['sessionName'],
                            'compared':second['run']['sessionName'],
                            'solverParametersDifferent':differing,
                            'sameAdvertisedSolverParameters':not differing,
                            'requestedUpTo':args.compare_up_to,
                            'lastComparedFrame':rows[-1]['frame'] if rows else None,
                            'firstNonidenticalFrame':next((r['frame'] for r in rows if not r['bitwiseIdentical']),None),
                            'peakClothDifferenceMm':max((r['clothVertices']['maxMm'] for r in rows),default=None),
                            'peakPinnedDifferenceMm':max((r['pinnedVertices']['maxMm'] for r in rows),default=None),
                            'perFrame':rows})
    result={'schema':'garment-studio.ppf-native-repeatability.v1',
            'scope':'Read-only comparison of saved native vertex outputs; not proof of source of nondeterminism',
            'fullPhysicalFitVerified':False,'inputHashes':common,
            'inputSeed':source['seed'],'bodyJitter':source['jitter'],'comparisons':comparisons}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n')
    for diff in comparisons:
        print('REPEATABILITY',diff['reference'],'vs',diff['compared'],
              'frameHorizonDifferent',bool(diff['solverParametersDifferent']),
              'firstDivergence',diff['firstNonidenticalFrame'],
              'maxClothDriftMm',diff['peakClothDifferenceMm'],
              'maxPinnedDriftMm',diff['peakPinnedDifferenceMm'],flush=True)


if __name__=='__main__':main()
