# Trailer

`gtcv6-ad.mp4` is a 30-second ad for the game (1280×720, 30 fps). It is recorded from the game itself, and it is not part of the deployed site.

To record it again:

```bash
python3 -m http.server 8765 --directory gtcv6/public   # in one terminal
cd gtcv6/trailer && mkdir -p frames
node record.js 0 900 1 1280 720 frames                 # needs Playwright and Chromium; about 1–2 s per frame
python3 music.py                                       # needs numpy and scipy; writes music.wav
ffmpeg -framerate 30 -i frames/f%04d.jpg -i music.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest gtcv6-ad.mp4
```

- `record.js` runs the game on virtual time, so every frame is exactly 1/30 s apart however slow the machine renders. Arguments: first frame to save, number of frames, save every n-th frame, width, height, output folder.
- `director.js` is loaded into the page. It holds the shots (camera paths and posed characters), the captions, the title card and the fades.
- `music.py` synthesises the soundtrack: rain, a 96 bpm groove in A minor, gulls, a scooter, a riser and a hit on the title card.

In the published cut, the Guangdong House shot starts 0.6 s late and is slowed slightly, so the camera never passes through a wall.
