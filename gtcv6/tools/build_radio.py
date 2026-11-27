#!/usr/bin/env python3
"""Put recorded talk on Radio Fjellet 6.

    python3 gtcv6/tools/build_radio.py [RECORDINGS_DIR]

RECORDINGS_DIR holds the recorded clips, one file per clip (WAV, MP3, M4A, FLAC or OGG), named
after their IDs in gtcv6/RADIO.md. The conversations between Regnar and Sol are recorded one
line per file: `chat_weather_01`, `chat_weather_02`, ... and `over_umbrella_01`, ... Their lines
are joined in order, with a short pause between them, into one clip per conversation
(`chat_weather.mp3`). Every clip is levelled to -16 LUFS and written as 96 kbps mono MP3 to
gtcv6/public/audio/radio/.

Without RECORDINGS_DIR it only rewrites the list of clips and their durations
(gtcv6/public/audio/radio/clips.json), which is what the game reads: a clip that is in the list
goes on air, a slot without one is left out. Needs ffmpeg and ffprobe.
"""
import json
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public' / 'audio' / 'radio'
EXTS = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'}
LINE = re.compile(r'^((?:chat|over|ad)_[a-z0-9]+)_(\d+)$')
GAP = 0.18          # seconds between two lines of a conversation (each line has its own short silence)


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]))


def to_wav(src, dst):
    """Mono 44.1 kHz WAV, each line levelled on its own so the two voices match."""
    run('ffmpeg', '-y', '-v', 'error', '-i', str(src), '-ac', '1', '-ar', '44100',
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', str(dst))


def to_mp3(src, dst):
    run('ffmpeg', '-y', '-v', 'error', '-i', str(src), '-ac', '1', '-ar', '44100',
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', str(dst))


def build(rec_dir):
    files = sorted(p for p in Path(rec_dir).iterdir() if p.suffix.lower() in EXTS)
    convs, singles = defaultdict(list), []
    for f in files:
        m = LINE.match(f.stem)
        if m:
            convs[m.group(1)].append((int(m.group(2)), f))
        else:
            singles.append(f)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        gap = tmp / 'gap.wav'
        run('ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', str(GAP), str(gap))
        for name, lines in sorted(convs.items()):
            lines.sort()
            nums = [n for n, _ in lines]
            if nums != list(range(1, len(nums) + 1)):
                print(f'  {name}: lines {nums}, expected 1..{len(nums)}: is one missing?')
            parts = []
            for n, f in lines:
                w = tmp / f'{name}_{n:02d}.wav'
                to_wav(f, w)
                parts += [w, gap]
            listing = tmp / f'{name}.txt'
            listing.write_text(''.join(f"file '{p}'\n" for p in parts[:-1]))
            joined = tmp / f'{name}.wav'
            run('ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', str(joined))
            to_mp3(joined, OUT / f'{name}.mp3')
            print(f'  {name}.mp3  {len(lines)} lines, {duration(OUT / f"{name}.mp3"):.1f} s')
        for f in singles:
            to_mp3(f, OUT / f'{f.stem}.mp3')
            print(f'  {f.stem}.mp3  {duration(OUT / f"{f.stem}.mp3"):.1f} s')


def write_list():
    clips = {f.stem: round(duration(f), 2) for f in sorted(OUT.glob('*.mp3'))}
    (OUT / 'clips.json').write_text(json.dumps(clips, indent=1) + '\n')
    print(f'clips.json: {len(clips)} clips')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        build(sys.argv[1])
    write_list()
