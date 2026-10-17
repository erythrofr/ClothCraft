"""Utilities for running the PPF Blender extension in factory/headless mode."""

from __future__ import annotations

import importlib
import platform
import sys
import tempfile
import zipfile
from pathlib import Path


def _matching_cbor_wheel(extension_root: Path) -> Path | None:
    major, minor = sys.version_info[:2]
    abi = f"cp{major}{minor}"
    machine = platform.machine().lower()
    if sys.platform == "darwin":
        platform_token = "macosx"
        arch_token = "arm64" if machine in {"arm64", "aarch64"} else "x86_64"
    elif sys.platform.startswith("linux"):
        platform_token = "manylinux"
        arch_token = "aarch64" if machine in {"arm64", "aarch64"} else "x86_64"
    else:
        platform_token = "win"
        arch_token = "arm64" if machine in {"arm64", "aarch64"} else "amd64"

    wheels = sorted((extension_root / "wheels").glob(f"cbor2-*-{abi}-{abi}-*.whl"))
    for wheel in wheels:
        name = wheel.name.lower()
        if platform_token in name and arch_token in name:
            return wheel
    return wheels[0] if wheels else None


def ensure_cbor2(extension_root: Path) -> None:
    try:
        import cbor2  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    wheel = _matching_cbor_wheel(extension_root)
    if wheel is None:
        raise RuntimeError(f"PPF extension has no cbor2 wheel for Python {sys.version_info[:2]} / {platform.machine()}")

    cache = Path(tempfile.gettempdir()) / f"garment-studio-ppf-{wheel.stem}"
    marker = cache / ".extracted"
    if not marker.exists():
        cache.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(wheel) as archive:
            archive.extractall(cache)
        marker.write_text(str(wheel))
    path = str(cache)
    if path not in sys.path:
        sys.path.insert(0, path)
    importlib.invalidate_caches()
    import cbor2  # noqa: F401


def ensure_ppf_registered() -> None:
    """Register PPF and its bundled native Python wheel in a headless profile."""
    import bpy

    addon = importlib.import_module("bl_ext.user_default.ppf_contact_solver")
    extension_root = Path(addon.__file__).resolve().parent
    ensure_cbor2(extension_root)
    if not hasattr(bpy.types.Scene, "zozo_contact_solver"):
        addon.register()
    if not hasattr(bpy.types.Scene, "zozo_contact_solver"):
        raise RuntimeError("PPF extension registered without Scene.zozo_contact_solver")

