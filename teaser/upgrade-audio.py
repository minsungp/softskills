#!/usr/bin/env python3
from __future__ import annotations
import json, math, os, subprocess, wave, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEASER = ROOT / 'teaser'
SCRIPT = TEASER / 'narration-script.txt'
NARRATION = TEASER / 'narration-voiceover.mp3'
MUSIC = TEASER / 'music-and-sfx.wav'
MIX = TEASER / 'verdian-valley-quest-teaser-audio.wav'
VIDEO_IN = TEASER / 'verdian-valley-quest-teaser.mp4'
VIDEO_OUT = TEASER / 'verdian-valley-quest-teaser-v2-audio.mp4'
DURATION = 43.0
SR = 44100


def load_env(path: Path):
    if not path.exists():
        return
    for raw in path.read_text(errors='ignore').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env(Path('/Users/minsungpark/.hermes/.env'))
load_env(Path('/Users/minsungpark/MY ZONE/code/shared.env'))


def elevenlabs_tts():
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        print('No ELEVENLABS_API_KEY; skipping ElevenLabs narration')
        return False
    text = SCRIPT.read_text().strip()
    # Rachel. Stable, trailer-friendly default public voice.
    voice_id = os.environ.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM')
    model_id = os.environ.get('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2')
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128'
    payload = {
        'text': text,
        'model_id': model_id,
        'voice_settings': {
            'stability': 0.55,
            'similarity_boost': 0.75,
            'style': 0.34,
            'use_speaker_boost': True,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            NARRATION.write_bytes(res.read())
        print(f'wrote {NARRATION}')
        return True
    except Exception as e:
        print(f'ElevenLabs failed: {e}')
        return False


def tone(t, freq, kind='square'):
    x = 2 * math.pi * freq * t
    if kind == 'square':
        return 1.0 if math.sin(x) >= 0 else -1.0
    if kind == 'tri':
        return 2 * abs(2 * ((freq * t) % 1) - 1) - 1
    if kind == 'saw':
        return 2 * ((freq * t) % 1) - 1
    return math.sin(x)


def add_note(buf, start, dur, freq, amp=0.15, kind='square', pan=0.0):
    a = max(0, int(start * SR)); b = min(len(buf), int((start + dur) * SR))
    if b <= a: return
    for i in range(a, b):
        lt = (i / SR) - start
        env = min(1.0, lt / 0.015) * min(1.0, (dur - lt) / 0.08)
        v = amp * env * tone(lt, freq, kind)
        # buf is mono for simplicity
        buf[i] += v


def add_noise(buf, start, dur, amp=0.12, seed=1, sweep=False):
    rng = seed & 0xffffffff
    a = max(0, int(start * SR)); b = min(len(buf), int((start + dur) * SR))
    for i in range(a, b):
        lt = (i / SR) - start
        env = math.sin(math.pi * lt / dur) if dur else 0
        rng = (1664525 * rng + 1013904223) & 0xffffffff
        n = ((rng / 0xffffffff) * 2 - 1)
        if sweep:
            n *= (0.3 + 0.7 * lt / dur)
        buf[i] += amp * env * n


def write_music_and_sfx():
    n = int(DURATION * SR)
    buf = [0.0] * n
    # More pleasant chiptune arpeggio in G major / forest adventure mood.
    chords = [
        [196.00, 246.94, 293.66, 392.00],
        [174.61, 220.00, 261.63, 349.23],
        [130.81, 196.00, 246.94, 329.63],
        [146.83, 220.00, 293.66, 392.00],
    ]
    step = 0.25
    for k in range(int(DURATION / step)):
        t0 = k * step
        chord = chords[int(t0 // 4) % len(chords)]
        f = chord[k % len(chord)]
        add_note(buf, t0, 0.18, f * 2, 0.035, 'tri')
        if k % 4 == 0:
            add_note(buf, t0, 0.42, chord[0], 0.05, 'sine')
        if k % 8 == 4:
            add_note(buf, t0, 0.20, chord[2] * 2, 0.025, 'square')
    # Scene SFX synced roughly to trailer cuts.
    events = [0.2, 3.5, 7.5, 12.0, 16.5, 20.5, 24.0, 27.5, 31.0, 34.5, 38.5]
    for idx, t0 in enumerate(events):
        add_noise(buf, t0, 0.42, 0.055, seed=100 + idx, sweep=True)  # soft whoosh
        add_note(buf, t0 + 0.08, 0.10, 784 + idx * 12, 0.05, 'tri')
    # UI bleeps / choices
    for t0 in [13.0, 13.45, 13.9, 18.0, 22.2, 25.7, 29.0, 32.5, 36.2, 40.0]:
        add_note(buf, t0, 0.08, 1046.5, 0.055, 'square')
        add_note(buf, t0 + 0.07, 0.08, 1318.5, 0.04, 'square')
    # Stone chimes
    for t0 in [17.4, 35.6, 39.2]:
        for j, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
            add_note(buf, t0 + j * 0.09, 0.28, f, 0.075 / (j + 1)**0.2, 'tri')
    # Storm low hit
    for t0 in [27.7, 28.15, 28.6]:
        add_noise(buf, t0, 0.32, 0.08, seed=int(t0 * 100), sweep=False)
        add_note(buf, t0, 0.28, 73.42, 0.08, 'sine')
    # soft limiter
    peak = max(0.001, max(abs(x) for x in buf))
    scale = 0.85 / peak if peak > 0.85 else 1.0
    with wave.open(str(MUSIC), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        frames = bytearray()
        for x in buf:
            y = max(-1.0, min(1.0, x * scale))
            frames += int(y * 32767).to_bytes(2, 'little', signed=True)
        w.writeframes(frames)
    print(f'wrote {MUSIC}')


def macos_say_fallback():
    if NARRATION.exists() and NARRATION.stat().st_size > 1000:
        return True
    aiff = TEASER / 'narration-macos.aiff'
    text = SCRIPT.read_text().strip()
    try:
        subprocess.run(['say', '-v', 'Samantha', '-r', '168', '-o', str(aiff), text], check=True)
        subprocess.run(['ffmpeg', '-y', '-i', str(aiff), '-codec:a', 'libmp3lame', '-q:a', '2', str(NARRATION)], check=True)
        print(f'wrote fallback narration {NARRATION}')
        return True
    except Exception as e:
        print(f'macOS say fallback failed: {e}')
        return False


def mix_and_mux(has_voice: bool):
    inputs = ['-i', str(MUSIC)]
    filt = '[0:a]volume=0.75[m]'
    maps = '[m]'
    if has_voice and NARRATION.exists():
        # Delay narration slightly after opening text, compress volume balance.
        inputs += ['-i', str(NARRATION)]
        filt += ';[1:a]adelay=900|900,volume=1.35,apad[v];[m][v]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.92,aresample=44100[out]'
        maps = '[out]'
    else:
        filt += ';[m]alimiter=limit=0.92,aresample=44100[out]'
        maps = '[out]'
    subprocess.run(['ffmpeg', '-y', *inputs, '-filter_complex', filt, '-map', maps, '-t', str(DURATION), str(MIX)], check=True)
    subprocess.run(['ffmpeg', '-y', '-i', str(VIDEO_IN), '-i', str(MIX), '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', str(VIDEO_OUT)], check=True)
    print(f'wrote {VIDEO_OUT}')

has_voice = elevenlabs_tts()
if not has_voice:
    has_voice = macos_say_fallback()
write_music_and_sfx()
mix_and_mux(has_voice)
