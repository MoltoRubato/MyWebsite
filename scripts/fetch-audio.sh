#!/usr/bin/env bash
# ============================================================
# Dev-only: fetch + process the CC0 instrument samples.
#   Piano — FreePats "Upright Piano KW" (CC0 1.0)
#           https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html
#   Drums — Versilian Community Sample Library (CC0 1.0)
#           https://github.com/sgossner/VCSL
# Outputs:
#   public/assets/audio/piano/{C3,Fs3,C4,Fs4,C5,Fs5,C6,Fs6,C7}.m4a
#   public/assets/audio/drums/{kick,snare,clap,hat,openhat,shaker}.wav
# Requires: curl, afconvert (macOS), python3. Never bundled by the client.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------- piano ----------------
PIANO_BASE="https://raw.githubusercontent.com/freepats/upright-piano-KW/main/samples"
# repo filename (URL-encoded) -> shipped name ("#" never ships in URLs)
PIANO_FILES=(
  "C3vH.flac:C3"
  "F%233vH.flac:Fs3"
  "C4vL.flac:C4"
  "F%234vH.flac:Fs4"
  "C5vH.flac:C5"
  "F%235vH.flac:Fs5"
  "C6vH.flac:C6"
  "F%236vH.flac:Fs6"
  "C7vH.flac:C7"
)
mkdir -p public/assets/audio/piano
for pair in "${PIANO_FILES[@]}"; do
  src="${pair%%:*}"; out="${pair##*:}"
  echo "piano: $src -> $out.m4a"
  curl -fsSL "$PIANO_BASE/$src" -o "$TMP/$out.flac"
  # sanity: a real FLAC is >50KB; an error page isn't
  [ "$(stat -f%z "$TMP/$out.flac")" -gt 50000 ] || { echo "  !! $src too small, aborting"; exit 1; }
  # NOTE: no "-c 1" — afconvert fails setting a mono client layout on these
  # FLACs ('cclo' -66564); the sources are effectively mono anyway.
  afconvert -f m4af -d aac -b 80000 "$TMP/$out.flac" "public/assets/audio/piano/$out.m4a"
done

# ---------------- drums ----------------
DRUM_BASE="https://raw.githubusercontent.com/sgossner/VCSL/master"
declare -a DRUMS=(
  "Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v3_rr1_Sum.wav:kick"
  "Membranophones/Struck%20Membranophones/Legacy%20Snares/OldSnare/snare_ff1.wav:snare"
  "Idiophones/Struck%20Idiophones/Claps/SoloClap_vl2.wav:clap"
  "Idiophones/Struck%20Idiophones/Hi-Hat%20Cymbal/HiHat_HitC_v3_rr1_Mid.wav:hat"
  "Idiophones/Struck%20Idiophones/Hi-Hat%20Cymbal/HiHat_HitOC_rr5_Mid.wav:openhat"
  "Idiophones/Struck%20Idiophones/Shaker%2C%20Small/Mid_ShakerDouble_Down_rr1.wav:shaker"
)
mkdir -p "$TMP/drums" public/assets/audio/drums
for pair in "${DRUMS[@]}"; do
  src="${pair%%:*}"; out="${pair##*:}"
  echo "drum: $out"
  curl -fsSL "$DRUM_BASE/$src" -o "$TMP/drums/$out.wav"
  [ "$(stat -f%z "$TMP/drums/$out.wav")" -gt 20000 ] || { echo "  !! $out too small, aborting"; exit 1; }
done
python3 scripts/trim_drums.py "$TMP/drums" public/assets/audio/drums

echo "---- shipped sizes ----"
du -sh public/assets/audio/piano public/assets/audio/drums
