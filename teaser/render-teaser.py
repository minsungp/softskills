from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from pathlib import Path
import subprocess, math, os, textwrap

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT / 'teaser' / 'captures'
OUT = ROOT / 'teaser'
W, H = 1920, 1080
FPS = 24
DURATION = 43.0
VIDEO_NO_AUDIO = OUT / 'verdian-valley-quest-teaser.noaudio.mp4'
FINAL = OUT / 'verdian-valley-quest-teaser.mp4'
AUDIO = OUT / 'teaser-score.wav'

font_candidates = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
]
font_path = next((p for p in font_candidates if Path(p).exists()), None)
def font(size, bold=True):
    if font_path:
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

F_TITLE = font(92)
F_BIG = font(68)
F_MED = font(44)
F_SMALL = font(30)
F_TINY = font(22)

shots = {p.stem: Image.open(p).convert('RGB') for p in CAP.glob('*.png')}

scenes = [
    (0.0, 3.5, '00-intro', 'WHAT IF SOFT-SKILL\nASSESSMENT PLAYED\nLIKE AN RPG?', 'VERDIAN VALLEY QUEST'),
    (3.5, 7.5, '01-overworld-start', 'EXPLORE THE VALLEY', '20:00 on the clock'),
    (7.5, 12.0, '02-three-path-dialogue', 'FIND GLOWING TRIALS', 'Each encounter is a workplace decision in disguise'),
    (12.0, 16.5, '03-three-path-choices', 'CHOOSE UNDER PRESSURE', 'Fast, safe, collaborative, risky — every route leaves data'),
    (16.5, 20.5, '04-stone-result', 'RECOVER VERDIAN STONES', 'Milestone scenes reveal progress'),
    (20.5, 24.0, '05-broken-bridge-choice', 'CREATIVITY', 'Broken bridge. Limited tools. No perfect answer.'),
    (24.0, 27.5, '06-rune-gate-choice', 'ANALYTICAL THINKING', 'Patterns, evidence, controlled tests'),
    (27.5, 31.0, '07-storm-conflict-choice', 'TEAMWORK + TIME', 'Conflict does not pause the storm'),
    (31.0, 34.5, '08-tool-shore-choice', 'RESOURCEFULNESS', 'Use the right tool for the situation'),
    (34.5, 38.5, '09-final-altar-choice', 'FIVE STONES. ONE RETURN RITUAL.', 'Leadership continues after success'),
    (38.5, 43.0, '10-assessment-report', 'FINISH THE QUEST.\nGET THE ASSESSMENT.', 'Playable soft-skills RPG prototype'),
]

# Fit image to frame with blurred background and slight Ken Burns motion.
def compose_base(img, progress, zoom_dir=1):
    bg = img.resize((W, H), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(24))
    bg = ImageEnhance.Brightness(bg).enhance(0.48)
    # contain foreground
    scale = min((W*0.88) / img.width, (H*0.80) / img.height)
    zw = int(img.width * scale * (1.0 + 0.035 * progress * zoom_dir))
    zh = int(img.height * scale * (1.0 + 0.035 * progress * zoom_dir))
    fg = img.resize((zw, zh), Image.Resampling.LANCZOS)
    frame = bg.copy()
    x = (W - zw)//2 + int((progress-.5)*22*zoom_dir)
    y = (H - zh)//2 + 18
    shadow = Image.new('RGBA', (zw+44, zh+44), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((22,22,zw+22,zh+22), radius=20, fill=(0,0,0,120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    frame.paste(shadow.convert('RGB'), (x-22,y-22), shadow)
    frame.paste(fg, (x,y))
    return frame

def draw_text(draw, xy, text, fnt, fill, stroke=0, align='left', spacing=6):
    x, y = xy
    lines = text.split('\n')
    for line in lines:
        draw.text((x,y), line, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=(20,18,12), anchor=None)
        y += fnt.size + spacing

def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * max(0,min(1,x)))

def draw_overlay(frame, main, sub, t, scene_index):
    d = ImageDraw.Draw(frame)
    # cinematic green/gold vignette
    overlay = Image.new('RGBA', (W,H), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0,0,W,H), outline=(72,51,31,180), width=16)
    od.rectangle((0,H-210,W,H), fill=(16,24,18,205))
    od.rectangle((0,0,W,130), fill=(16,24,18,140))
    frame.alpha_composite(overlay)
    # top metadata
    d.text((48,42), 'SOFT SKILLS RPG PROTOTYPE', font=F_TINY, fill=(255,226,126), stroke_width=1, stroke_fill=(20,18,12))
    d.text((W-48,42), f'{scene_index+1:02d}/11', font=F_TINY, fill=(255,251,232), anchor='ra')
    # main title
    mx, my = 58, H-178
    for i, line in enumerate(main.split('\n')):
        f = F_BIG if len(line) < 28 else F_MED
        d.text((mx,my+i*(f.size+4)), line, font=f, fill=(255,251,232), stroke_width=3, stroke_fill=(24,36,31))
    d.text((mx, H-54), sub, font=F_SMALL, fill=(255,226,126), stroke_width=2, stroke_fill=(24,36,31))
    # progress bar
    od = ImageDraw.Draw(frame)
    od.rounded_rectangle((48,H-22,W-48,H-12), radius=5, fill=(73,51,31))
    od.rounded_rectangle((48,H-22,48+int((W-96)*(t/DURATION)),H-12), radius=5, fill=(244,183,56))
    return frame

cmd = [
    'ffmpeg','-y',
    '-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24',
    '-s',f'{W}x{H}','-r',str(FPS),'-i','-',
    '-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',str(VIDEO_NO_AUDIO)
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
frame_count = int(DURATION * FPS)
for n in range(frame_count):
    t = n / FPS
    idx = max(i for i,s in enumerate(scenes) if t >= s[0])
    start, end, key, main, sub = scenes[idx]
    p = ease((t-start)/(end-start))
    img = shots[key]
    frame = compose_base(img, p, 1 if idx % 2 == 0 else -1).convert('RGBA')
    # scene transition flash/wipe
    local = (t-start)/(end-start)
    if local < 0.12 and idx > 0:
        alpha = int(190 * (1 - local/0.12))
        flash = Image.new('RGBA', (W,H), (255,246,216,alpha))
        frame.alpha_composite(flash)
    frame = draw_overlay(frame, main, sub, t, idx).convert('RGB')
    proc.stdin.write(frame.tobytes())
proc.stdin.close()
proc.wait()
if proc.returncode:
    raise SystemExit(proc.returncode)

# Simple adventurous synth score.
subprocess.run([
    'ffmpeg','-y',
    '-f','lavfi','-i',f'sine=frequency=196:duration={DURATION}',
    '-f','lavfi','-i',f'sine=frequency=392:duration={DURATION}',
    '-f','lavfi','-i',f'sine=frequency=587.33:duration={DURATION}',
    '-filter_complex','[0:a]volume=0.08[a0];[1:a]volume=0.035[a1];[2:a]volume=0.018,afade=t=in:st=0:d=1.5,afade=t=out:st=40:d=3[a2];[a0][a1][a2]amix=inputs=3:duration=first,afade=t=in:st=0:d=0.8,afade=t=out:st=41:d=2',
    str(AUDIO)
], check=True)
subprocess.run([
    'ffmpeg','-y','-i',str(VIDEO_NO_AUDIO),'-i',str(AUDIO),'-shortest','-c:v','copy','-c:a','aac','-b:a','160k',str(FINAL)
], check=True)
print(FINAL)
