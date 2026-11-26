// Procedural canvas textures. Every texture is drawn once at startup; UVs in the
// world are in metres, so each texture's `repeat` is 1 / (metres it covers).
import * as THREE from '../vendor/three.module.min.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(size, metres, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.repeat.set(1 / metres, 1 / metres);
  return t;
}

const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

function grain(g, s, amt, r, alpha = 1) {
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] = 255 * alpha;
  }
  g.putImageData(img, 0, 0);
}

export function buildTextures() {
  const T = {};

  // Wet cobblestones (2 m)
  T.cobble = make(512, 2.4, (g, s) => {
    const r = rng(11);
    g.fillStyle = '#2b2c2e'; g.fillRect(0, 0, s, s);
    const rows = 10, h = s / rows;
    for (let j = 0; j < rows; j++) {
      let x = (j % 2) * h * 0.5 - h;
      while (x < s + h) {
        const w = h * (0.75 + r() * 0.6);
        const v = 70 + r() * 50, tint = r() * 10;
        g.fillStyle = rgb(v + tint, v + tint * 0.6, v);
        const pad = 3;
        g.beginPath();
        g.roundRect(x + pad, j * h + pad, w - pad * 2, h - pad * 2, 10);
        g.fill();
        // wet highlight
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.roundRect(x + pad + 3, j * h + pad + 2, w * 0.5, h * 0.25, 6);
        g.fill();
        // wrap horizontally
        if (x + w > s) { g.fillStyle = rgb(v, v, v); g.beginPath(); g.roundRect(x - s + pad, j * h + pad, w - pad * 2, h - pad * 2, 10); g.fill(); }
        x += w;
      }
    }
    grain(g, s, 18, r);
  });

  // Horizontal wooden cladding, near-white so a material colour tints it (1.2 m)
  T.siding = make(256, 1.2, (g, s) => {
    const r = rng(3);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    const boards = 6, h = s / boards;
    for (let j = 0; j < boards; j++) {
      const y = j * h;
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.85, '#e6e6e6'); grd.addColorStop(1, '#9a9a9a');
      g.fillStyle = grd; g.fillRect(0, y, s, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + h - 2, s, 2);
    }
    grain(g, s, 10, r);
  });

  // Vertical board cladding (Bryggen) (1.2 m)
  T.vboard = make(256, 1.2, (g, s) => {
    const r = rng(4);
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, s, s);
    const n = 6, w = s / n;
    for (let i = 0; i < n; i++) {
      const grd = g.createLinearGradient(i * w, 0, i * w + w, 0);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.8, '#e2e2e2'); grd.addColorStop(1, '#8c8c8c');
      g.fillStyle = grd; g.fillRect(i * w, 0, w, s);
    }
    grain(g, s, 14, r);
  });

  // Oak-ish plank floor (2 m)
  T.floor = make(512, 2, (g, s) => {
    const r = rng(5);
    const n = 13, w = s / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * s;
      while (y < s) {
        const len = s * (0.4 + r() * 0.5);
        const v = r();
        g.fillStyle = rgb(150 + v * 40, 100 + v * 30, 60 + v * 20);
        g.fillRect(i * w, y, w, len);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(80,45,20,${0.06 + r() * 0.08})`;
          g.fillRect(i * w + r() * w, y, 1.5, len);
        }
        g.fillStyle = 'rgba(40,20,5,0.5)'; g.fillRect(i * w, y, w, 2);
        y += len;
      }
      g.fillStyle = 'rgba(40,20,5,0.55)'; g.fillRect(i * w, 0, 2, s);
    }
    grain(g, s, 10, r);
  });

  // Knotty pine panel wall (2 m)
  T.pine = make(512, 2, (g, s) => {
    const r = rng(6);
    const n = 12, w = s / n;
    for (let i = 0; i < n; i++) {
      const v = r();
      g.fillStyle = rgb(205 + v * 25, 150 + v * 20, 90 + v * 15);
      g.fillRect(i * w, 0, w, s);
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = `rgba(150,85,30,${0.1 + r() * 0.15})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        const x = i * w + r() * w;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 10, s * 0.3, x + (r() - 0.5) * 10, s * 0.7, x, s);
        g.stroke();
      }
      for (let k = 0; k < 2; k++) {
        if (r() < 0.6) {
          g.fillStyle = 'rgba(110,55,15,0.7)';
          g.beginPath(); g.ellipse(i * w + w * (0.3 + r() * 0.4), r() * s, 3 + r() * 4, 4 + r() * 6, 0, 0, Math.PI * 2); g.fill();
        }
      }
      g.fillStyle = 'rgba(90,45,10,0.6)'; g.fillRect(i * w, 0, 2, s);
    }
    grain(g, s, 10, r);
  });

  // White square wall tiles (0.6 m = 4 tiles)
  T.tileWhite = make(256, 0.6, (g, s) => {
    g.fillStyle = '#b9bcbf'; g.fillRect(0, 0, s, s);
    const n = 4, w = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = '#f4f5f6'; g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(i * w + 6, j * w + 6, w * 0.3, 3);
    }
  });

  // Dark floor tiles (0.6 m)
  T.tileDark = make(256, 0.6, (g, s) => {
    const r = rng(8);
    g.fillStyle = '#4a4c50'; g.fillRect(0, 0, s, s);
    const n = 3, w = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 34 + r() * 10;
      g.fillStyle = rgb(v, v + 2, v + 6); g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
    }
    grain(g, s, 8, r);
  });

  // Grey/white block-pattern vinyl from the upstairs landing (1.6 m)
  T.checker = make(256, 1.6, (g, s) => {
    const r = rng(9);
    const n = 4, w = s / n;
    const cols = ['#e9e9e6', '#9da1a3', '#c9cac8', '#7f8486'];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = cols[(i + j * 3 + ((i * j) % 3)) % 4];
      g.fillRect(i * w, j * w, w, w);
    }
    grain(g, s, 6, r);
  });

  // Rough stone retaining wall (2.5 m)
  T.stone = make(512, 2.5, (g, s) => {
    const r = rng(10);
    g.fillStyle = '#3a3b3a'; g.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const h = 30 + r() * 40;
      let x = -r() * 60;
      while (x < s) {
        const w = 50 + r() * 80;
        const v = 85 + r() * 50;
        g.fillStyle = rgb(v, v * 0.98, v * 0.94);
        g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 8); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x + 3, y + h - 10, w - 6, 6);
        x += w;
      }
      y += h;
    }
    // moss
    for (let k = 0; k < 160; k++) {
      g.fillStyle = `rgba(70,95,40,${r() * 0.35})`;
      g.beginPath(); g.arc(r() * s, r() * s, 3 + r() * 10, 0, 7); g.fill();
    }
    grain(g, s, 20, r);
  });

  // Concrete slabs with weeds in the cracks (2 m)
  T.slab = make(512, 2.4, (g, s) => {
    const r = rng(12);
    g.fillStyle = '#4b4e47'; g.fillRect(0, 0, s, s);
    const n = 3, w = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 120 + r() * 30;
      g.fillStyle = rgb(v, v, v * 0.96);
      g.fillRect(i * w + 3, j * w + 3, w - 6, w - 6);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
        g.beginPath(); g.arc(i * w + r() * w, j * w + r() * w, 2 + r() * 8, 0, 7); g.fill();
      }
    }
    for (let k = 0; k < 90; k++) {
      g.strokeStyle = `rgba(${60 + r() * 40},${110 + r() * 40},40,0.9)`;
      g.lineWidth = 2;
      const along = r() < 0.5, line = Math.floor(r() * n) * w + (r() < 0.5 ? 0 : 3);
      const p = r() * s;
      g.beginPath();
      if (along) { g.moveTo(p, line); g.lineTo(p + (r() - 0.5) * 8, line - 6 - r() * 8); }
      else { g.moveTo(line, p); g.lineTo(line - 6 - r() * 8, p + (r() - 0.5) * 8); }
      g.stroke();
    }
    grain(g, s, 16, r);
  });

  // Roof: dark slate rows (1 m)
  T.roof = make(256, 1.0, (g, s) => {
    const r = rng(13);
    g.fillStyle = '#222'; g.fillRect(0, 0, s, s);
    const rows = 5, h = s / rows;
    for (let j = 0; j < rows; j++) {
      const n = 4, w = s / n, off = (j % 2) * w / 2;
      for (let i = -1; i < n + 1; i++) {
        const v = 200 + r() * 55;
        g.fillStyle = rgb(v, v, v);
        g.beginPath(); g.roundRect(i * w + off + 2, j * h + 2, w - 4, h - 3, [0, 0, 10, 10]); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * w + off + 2, j * h + h - 8, w - 4, 5);
      }
    }
    grain(g, s, 14, r);
  });

  // Grass (3 m)
  T.grass = make(256, 3, (g, s) => {
    const r = rng(14);
    g.fillStyle = '#4f6b35'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 2500; k++) {
      const v = r();
      g.fillStyle = rgb(60 + v * 50, 90 + v * 50, 35 + v * 20);
      g.fillRect(r() * s, r() * s, 2, 4);
    }
  });

  // Wharf boards (2 m)
  T.deck = make(256, 2, (g, s) => {
    const r = rng(15);
    const n = 8, w = s / n;
    for (let i = 0; i < n; i++) {
      const v = r();
      g.fillStyle = rgb(95 + v * 30, 85 + v * 25, 72 + v * 20);
      g.fillRect(0, i * w, s, w);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, i * w, s, 2);
    }
    grain(g, s, 18, r);
  });

  // Gravel / asphalt (3 m)
  T.asphalt = make(256, 3, (g, s) => {
    const r = rng(16);
    g.fillStyle = '#3d3e40'; g.fillRect(0, 0, s, s);
    grain(g, s, 40, r);
  });

  return T;
}

// Text drawn onto a transparent texture: signs, house numbers, speech bubbles.
export function textTexture(lines, { w = 512, h = 128, bg = null, fg = '#111', font = '700 72px "Archivo", sans-serif', radius = 18, border = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, radius); g.fill();
    if (border) { g.strokeStyle = border; g.lineWidth = 6; g.stroke(); }
  }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (arr.length - 1) / 2) * (h / (arr.length + 0.4))));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
