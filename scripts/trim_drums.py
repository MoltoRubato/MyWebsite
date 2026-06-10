#!/usr/bin/env python3
"""Dev-only: trim/fade/mono the VCSL drum one-shots for the beat pad.

Stdlib only (wave + struct/array) — no audioop, which was removed in
Python 3.13. Handles 16-bit and 24-bit PCM WAVs. Output: mono 16-bit at
the source sample rate, trimmed with a linear fade on the tail.
"""
import array
import struct
import sys
import wave
from pathlib import Path

# seconds to keep per one-shot (tail gets an 80ms linear fade)
TRIMS = {"kick": 0.5, "snare": 0.4, "hat": 0.3, "openhat": 1.0, "shaker": 0.35}
FADE_S = 0.08


def read_samples(path: Path):
    with wave.open(str(path), "rb") as w:
        nch, sw, rate, nframes = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(nframes)
    if sw == 2:
        data = array.array("h")
        data.frombytes(raw)
        samples = list(data)
    elif sw == 3:
        n = len(raw) // 3
        samples = [int.from_bytes(raw[i * 3 : i * 3 + 3], "little", signed=True) >> 8 for i in range(n)]
    else:
        raise SystemExit(f"{path.name}: unsupported sample width {sw} bytes")
    # interleaved -> mono mixdown
    if nch > 1:
        mono = [sum(samples[i : i + nch]) // nch for i in range(0, len(samples) - nch + 1, nch)]
    else:
        mono = samples
    return mono, rate


def main(src_dir: str, out_dir: str) -> None:
    src, out = Path(src_dir), Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, keep_s in TRIMS.items():
        f = src / f"{name}.wav"
        if not f.exists():
            print(f"  !! missing {f}", file=sys.stderr)
            raise SystemExit(1)
        mono, rate = read_samples(f)
        keep = min(len(mono), int(keep_s * rate))
        mono = mono[:keep]
        fade = min(len(mono), int(FADE_S * rate))
        for i in range(fade):
            k = (fade - 1 - i) / fade
            mono[len(mono) - fade + i] = int(mono[len(mono) - fade + i] * k)
        # clamp to int16
        clipped = [max(-32768, min(32767, s)) for s in mono]
        with wave.open(str(out / f"{name}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(struct.pack(f"<{len(clipped)}h", *clipped))
        print(f"  {name}.wav: {len(clipped)/rate:.2f}s @ {rate}Hz")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: trim_drums.py <src_dir> <out_dir>")
    main(sys.argv[1], sys.argv[2])
