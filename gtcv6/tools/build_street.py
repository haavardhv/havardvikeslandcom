#!/usr/bin/env python3
"""Put recorded lines in the mouths of the people on the street.

    python3 gtcv6/tools/build_street.py m1=paul.mp3 m2=benjamin.mp3 f1=melissa.mp3 f2=annie.mp3
    python3 gtcv6/tools/build_street.py path/to/recordings

Each voice in gtcv6/STREET.md (m1, m2, f1, f2) has 13 lines, `ped_m1_01` to `ped_m1_13`. A voice
can come as one long take with the lines in order and a pause of about two seconds between them
(`m1=take.mp3`): the take is levelled as a whole, so the lines keep their levels against each
other, and cut on the pauses. Or the lines can come one file each, named after their IDs, in a
folder. Every line is trimmed to 0.12 s of silence at each end, levelled to -16 LUFS (the same as
the radio) and written as 96 kbps mono MP3 to gtcv6/public/audio/street/.

Afterwards, and when run with no arguments, it rewrites gtcv6/public/audio/street/clips.json,
the list of lines and their durations that the game reads: a line in the list is spoken, one that
isn't is only shown in the speech bubble. Needs ffmpeg and ffprobe.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public' / 'audio' / 'street'
EXTS = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'}
VOICES = ('m1', 'm2', 'f1', 'f2')
LINES = 13          # per voice
PAUSE = 1.2         # a silence at least this long (s) is a pause between two lines
PAD = 0.12          # silence kept at each end of a line (s)
LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11'


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]))


def pauses(f):
    """(start, end) of every pause in a take."""
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(f), '-af', f'silencedetect=noise=-40dB:d={PAUSE}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(starts, ends))


def encode(src, dst, start=None, end=None, level=True):
    """Cut [start, end] out of src, trim the silence at both ends down to PAD, and write MP3."""
    cut = ['-ss', f'{start:.3f}', '-to', f'{end:.3f}'] if start is not None else []
    trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02'
    af = f'{trim},areverse,{trim},areverse,adelay={int(PAD * 1000)},apad=pad_dur={PAD}'
    if level:
        af = f'{af},{LOUD}'
    run('ffmpeg', '-y', '-v', 'error', '-i', str(src), *cut, '-ac', '1', '-af', af, '-ar', '44100',
        '-codec:a', 'libmp3lame', '-b:a', '96k', str(dst))


def build_take(voice, take):
    with tempfile.TemporaryDirectory() as tmp:
        lev = Path(tmp) / 'take.wav'
        run('ffmpeg', '-y', '-v', 'error', '-i', str(take), '-ac', '1', '-ar', '44100', '-af', LOUD, str(lev))
        total = duration(lev)
        gaps = pauses(lev)
        bounds = [0.0] + [e for _, e in gaps], [s for s, _ in gaps] + [total]
        lines = [(a, b) for a, b in zip(*bounds) if b - a > 0.25]
        if len(lines) != LINES:
            print(f'  {voice}: found {len(lines)} lines in {take}, expected {LINES}: check the pauses')
        for i, (a, b) in enumerate(lines[:LINES], 1):
            dst = OUT / f'ped_{voice}_{i:02d}.mp3'
            encode(lev, dst, max(0.0, a - 0.3), min(total, b + 0.3), level=False)
            print(f'  {dst.stem}.mp3  {duration(dst):.2f} s')


def build_dir(rec_dir):
    for f in sorted(p for p in Path(rec_dir).iterdir() if p.suffix.lower() in EXTS and p.stem.startswith('ped_')):
        dst = OUT / f'{f.stem}.mp3'
        encode(f, dst)
        print(f'  {dst.stem}.mp3  {duration(dst):.2f} s')


def write_list():
    clips = {f.stem: round(duration(f), 2) for f in sorted(OUT.glob('ped_*.mp3'))}
    (OUT / 'clips.json').write_text(json.dumps(clips, indent=1) + '\n')
    print(f'clips.json: {len(clips)} lines')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for arg in sys.argv[1:]:
        if '=' in arg:
            voice, take = arg.split('=', 1)
            if voice not in VOICES:
                sys.exit(f'unknown voice {voice!r}: use one of {", ".join(VOICES)}')
            build_take(voice, take)
        else:
            build_dir(arg)
    write_list()
