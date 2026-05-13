#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TEASER = ROOT / 'teaser'
VIDEO_IN = TEASER / 'verdian-valley-quest-teaser.mp4'
MUSIC = TEASER / 'music-and-sfx.wav'
VIDEO_OUT = TEASER / 'verdian-valley-quest-teaser-v3-no-voice.mp4'

if not VIDEO_IN.exists():
    raise SystemExit(f'missing base video: {VIDEO_IN}')
if not MUSIC.exists():
    raise SystemExit(f'missing music/SFX bed: {MUSIC}; run python3 teaser/upgrade-audio.py once or generate the bed first')

subprocess.run([
    'ffmpeg', '-y',
    '-i', str(VIDEO_IN),
    '-i', str(MUSIC),
    '-filter_complex', '[1:a]volume=1.85,acompressor=threshold=-18dB:ratio=2.2:attack=8:release=80,alimiter=limit=0.92,aresample=44100[a]',
    '-map', '0:v:0', '-map', '[a]',
    '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    str(VIDEO_OUT),
], check=True)
print(f'wrote {VIDEO_OUT}')
