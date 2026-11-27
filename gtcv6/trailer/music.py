# A 30 second trailer soundtrack, synthesised: rain, a laid-back 96 bpm groove in A minor,
# gulls, a scooter, a riser and a big hit on the title card.
import numpy as np, wave
from scipy.signal import lfilter, butter

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(6)
L = np.zeros(N); R = np.zeros(N)
t_all = np.arange(N) / SR
BPM = 96
BEAT = 60 / BPM

def lp(x, f):
    b, a = butter(2, min(0.99, f / (SR / 2)), 'low'); return lfilter(b, a, x)
def hp(x, f):
    b, a = butter(2, min(0.99, f / (SR / 2)), 'high'); return lfilter(b, a, x)
def bp(x, f0, f1):
    b, a = butter(2, [f0 / (SR / 2), f1 / (SR / 2)], 'band'); return lfilter(b, a, x)
def put(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    s = sig[:N - i] * gain
    L[i:i + len(s)] += s * (1 - pan) ** 0.5 * 0.9
    R[i:i + len(s)] += s * (1 + pan) ** 0.5 * 0.9
def env(n, a, d, sus=0.0, rel=None):
    e = np.ones(n)
    ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai)
    di = int(d * SR)
    if di > 0: e[ai:ai + di] = np.linspace(1, sus, min(di, max(0, n - ai)))[:max(0, min(di, n - ai))]
    e[ai + di:] = sus
    if rel: ri = int(rel * SR); e[-ri:] *= np.linspace(1, 0, ri)
    return e
def saw(f, n):
    t = np.arange(n) / SR
    return 2 * ((t * f) % 1) - 1
def note(midi): return 440 * 2 ** ((midi - 69) / 12)

# rain: two noise layers, fading as the weather clears (from about 22 s)
noise = rng.standard_normal(N)
rain_amt = np.clip(1 - (t_all - 21.5) / 2.5, 0.15, 1)
rain = hp(noise, 3000) * 0.05 + lp(rng.standard_normal(N), 800) * 0.09
fade_in = np.clip(t_all / 0.8, 0, 1)
L += rain * rain_amt * fade_in; R += np.roll(rain, 777) * rain_amt * fade_in

# drums from 3.1 s to 25.2 s (with a break on the terrace shot)
def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def snare():
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1200, 6000) * 0.7 + np.sin(2 * np.pi * 190 * t) * 0.4) * np.exp(-t * 16)
def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 70))
K, S_, Hc, Ho = kick(), snare(), hat(), hat(True)
start, stop = 3.1, 25.2
b = 0
while True:
    tb = start + b * BEAT
    if tb >= stop: break
    in_break = 21.6 <= tb < 23.2
    bar_pos = b % 4
    if not in_break:
        if bar_pos in (0, 2): put(K, tb, 0.9)
        if bar_pos == 1 and b % 8 == 5: put(K, tb + BEAT / 2, 0.6)
        if bar_pos in (1, 3): put(S_, tb, 0.55, 0.05)
        put(Hc, tb, 0.18, 0.3); put(Ho if bar_pos == 3 else Hc, tb + BEAT / 2, 0.14, 0.3)
    b += 1

# chords Am - F - C - G, one per bar, bass and pad, from 0.4 s (pad) and 3.1 s (bass)
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
BASS = [45, 41, 36, 43]
bar = 4 * BEAT
for i in range(12):
    t0 = 0.4 + i * bar
    if t0 > 25.2: break
    n = int(bar * SR)
    pad = sum(saw(note(m) * (1 + d), n) for m in CH[i % 4] for d in (-0.003, 0.003))
    pad = lp(pad, 1400 if t0 < 21 else 2600) * env(n, 0.4, 0.5, 0.75, 0.3) * 0.05
    put(pad, t0, 1.0, -0.25 if i % 2 else 0.25)
    if t0 >= 3.0:
        bl = lp(saw(note(BASS[i % 4]), n), 380) * env(n, 0.01, 0.3, 0.6, 0.1)
        for k in range(4):      # a little bass rhythm
            put(bl[int(k * BEAT * SR):int((k * BEAT + BEAT * 0.8) * SR)] * (1.0 if k % 2 == 0 else 0.7), t0 + k * BEAT, 0.32)
# a plucked lead motif over the groove
MOTIF = [(0, 76), (0.75, 74), (1.5, 72), (2.5, 69), (3.0, 72)]
for rep in range(5):
    tb = 6.2 + rep * bar
    if tb > 21: break
    for off, m in MOTIF:
        n = int(0.5 * SR)
        pl = lp(saw(note(m + (0 if rep % 2 == 0 else -2 if m == 69 else 0)), n), 2400) * env(n, 0.005, 0.35, 0.0) * 0.07
        put(pl, tb + off * BEAT, 1.0, 0.35)

# gulls during their shot (and one far away at the start)
def gull(f0):
    out = []
    for k in range(3):
        n = int(0.2 * SR); t = np.arange(n) / SR
        f = f0 * 1.5 * np.exp(-t * 3.5)
        out.append(np.concatenate([np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 * np.exp(-t * 6) * np.minimum(1, t * 60), np.zeros(int(0.03 * SR))]))
    return bp(np.concatenate(out), 700, 4500)
put(gull(1300), 1.2, 0.06, -0.6)
for k, tt in enumerate([9.8, 10.5, 11.1, 11.7]):
    put(gull(1100 + k * 120), tt, 0.16, (-0.5, 0.5, -0.2, 0.4)[k])

# scooter whine across the chase
n = int(3.4 * SR); t = np.arange(n) / SR
fm = 120 + 160 * (t / 3.4) ** 0.7
whine = lp(np.sign(np.sin(2 * np.pi * np.cumsum(fm) / SR)), 1800) * np.minimum(1, t * 4) * np.minimum(1, (3.4 - t) * 3) * 0.05
put(whine, 12.6, 1.0, 0.0)

# riser into the title, then the hit
n = int(2.6 * SR); t = np.arange(n) / SR
riser = bp(rng.standard_normal(n), 400, 7000) * (t / 2.6) ** 2 * 0.25
put(riser, 22.6, 1.0)
n = int(4.8 * SR); t = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.4) * 0.9
crash = hp(rng.standard_normal(n), 3000) * np.exp(-t * 1.8) * 0.18
final = sum(saw(note(m) * (1 + d), n) for m in (45, 57, 60, 64, 69) for d in (-0.004, 0.004))
final = lp(final, 1800) * np.exp(-t * 0.55) * 0.035
put(boom + crash + final, 25.2, 1.0)

# master: gentle limiting and fades
mix = np.stack([L, R])
mix *= np.clip(t_all / 0.3, 0, 1) * np.clip((DUR - t_all) / 0.8, 0, 1)
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix /= np.max(np.abs(mix)) * 1.08
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'music.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape)
