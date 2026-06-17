#!/usr/bin/env python3
"""Generate a minimal 1x1 transparent PNG placeholder for Tauri icons.

Phase 1 placeholder. Phase 4 (Design Token Foundation) replaces this with
the real visual identity assets.
"""
import struct
import zlib
from pathlib import Path

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def chunk(t: bytes, d: bytes) -> bytes:
    return (
        struct.pack(">I", len(d))
        + t
        + d
        + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    )


def make_png() -> bytes:
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
    raw = b"\x00\x00\x00\x00\x00"  # filter byte + RGBA
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return PNG_SIG + ihdr + idat + iend


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "icons" / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(make_png())
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
