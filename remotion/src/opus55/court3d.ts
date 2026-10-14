/**
 * Universe five's set, in plain three.js (see memory three-inside-remotion): a wood-panelled courtroom. build() makes
 * it ONCE; render(state) places the camera. The people in it are SVG drawn over this canvas through the same camera
 * (uni5.tsx), hidden behind their desks with the desk boxes exported here. One unit = one metre, floor y = 0,
 * the judge's bench at the back (z < 0), the gallery behind the default camera (z > 0), defence on the left (x < 0).
 */
import * as THREE from 'three';

export type V3 = [number, number, number];
export type State = {f: number; cam: {pos: V3; look: V3; fov: number}};
export type Box = {min: V3; max: V3};

/* where the furniture stands: the desks the characters hide behind */
export const DESK: Record<'defense' | 'prosecution' | 'witness' | 'judge', Box> = {
  defense: {min: [-5.25, 0, -3.1], max: [-4.35, .9, -.5]},
  prosecution: {min: [4.35, 0, -3.1], max: [5.25, .9, -.5]},
  witness: {min: [-.75, .35, -2.75], max: [.75, 1.2, -2.35]},
  judge: {min: [-2.8, .45, -7.1], max: [2.8, 2.15, -6.25]},
};
/* where the characters' feet are */
// Meb stands on three law books so his chest clears the desk; the witness floats (it is a ghost); the judge sits high
export const SPOT = {meb: [-5.75, .6, -1.8] as V3, witness: [0, .35, -3.15] as V3, judge: [0, 1.75, -7.25] as V3};

/* ---------- seeded helpers ---------- */
let seed = 5;
const rnd = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
const canvasTex = (w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const shade = (hex: string, k: number) => {const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString();};
const noise = (c: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => {
  for (let i = 0; i < n; i++) {c.fillStyle = rnd() < .5 ? `rgba(255,255,255,${rnd() * a})` : `rgba(0,0,0,${rnd() * a * 1.4})`; c.fillRect(rnd() * w, rnd() * h, 2, 2);}
};
/** Grain along x inside a rect: long thin wavy lines. */
const grain = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: string, lines: number) => {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < lines; i++) {
    const yy = y + rnd() * h, amp = 1 + rnd() * 3, ph = rnd() * 6, fr = .01 + rnd() * .03;
    c.strokeStyle = dark; c.globalAlpha = .08 + rnd() * .18; c.lineWidth = .6 + rnd() * 1.6;
    c.beginPath(); for (let xx = x; xx <= x + w; xx += 6) {const v = yy + Math.sin(xx * fr + ph) * amp; if (xx === x) c.moveTo(xx, v); else c.lineTo(xx, v);} c.stroke();
  }
  c.globalAlpha = 1; c.restore();
};

/* ---------- textures ---------- */
const WOOD = '#8a5634', WOOD_D = '#4a2a18', WOOD_L = '#a86d44';
const plankTex = (base: string, dark: string, planks: number, vertical = false) => canvasTex(512, 512, c => {
  c.fillStyle = base; c.fillRect(0, 0, 512, 512);
  if (vertical) {c.translate(512, 0); c.rotate(Math.PI / 2);}
  const h = 512 / planks;
  for (let i = 0; i < planks; i++) {
    c.fillStyle = shade(base, .86 + rnd() * .26); c.fillRect(0, i * h, 512, h);
    grain(c, 0, i * h, 512, h, dark, 14);
    c.fillStyle = 'rgba(20,8,2,.55)'; c.fillRect(0, i * h, 512, 2);
  }
  c.setTransform(1, 0, 0, 1, 0, 0); noise(c, 512, 512, 3000, .05);
});
const parquetTex = () => canvasTex(512, 512, c => {  // 2 m square: boards 0.5 × 0.125 m, staggered
  c.fillStyle = '#9c6a42'; c.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 16; r++) for (let k = -1; k < 5; k++) {
    const x = k * 128 + (r % 2) * 64, y = r * 32;
    c.fillStyle = shade('#a8734a', .8 + rnd() * .3); c.fillRect(x, y, 128, 32);
    grain(c, x, y, 128, 32, '#3a1e0e', 5);
    c.strokeStyle = 'rgba(30,12,4,.6)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, 126, 30);
  }
  noise(c, 512, 512, 4000, .05);
});
/** Raised panels on wood: nx × ny frames with a light top-left bevel and a dark bottom-right. */
const panelTex = (nx: number, ny: number, base = WOOD) => canvasTex(512, 512, c => {
  c.fillStyle = base; c.fillRect(0, 0, 512, 512); grain(c, 0, 0, 512, 512, WOOD_D, 60);
  const mx = 512 / nx, my = 512 / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = i * mx + mx * .12, y = j * my + my * .14, w = mx * .76, h = my * .72;
    c.fillStyle = shade(base, 1.12); c.fillRect(x, y, w, h); grain(c, x, y, w, h, WOOD_D, 10);
    c.lineWidth = 7;
    c.strokeStyle = 'rgba(255,220,180,.35)'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y); c.lineTo(x + w, y); c.stroke();
    c.strokeStyle = 'rgba(30,10,0,.6)'; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.stroke();
    c.strokeStyle = 'rgba(20,8,0,.45)'; c.lineWidth = 3; c.strokeRect(x - 12, y - 12, w + 24, h + 24);
  }
  noise(c, 512, 512, 2500, .05);
});
const plasterTex = () => canvasTex(512, 512, c => {
  c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(160,130,90,${.04 + rnd() * .05})`); g.addColorStop(1, 'rgba(160,130,90,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);}
  noise(c, 512, 512, 6000, .04);
});
const carpetTex = () => canvasTex(256, 256, c => {
  c.fillStyle = '#1d5443'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(210,180,90,.14)'; c.lineWidth = 3;   // a quiet diamond weave
  for (let k = -256; k < 512; k += 64) {c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 256, 256); c.stroke(); c.beginPath(); c.moveTo(k + 256, 0); c.lineTo(k, 256); c.stroke();}
  noise(c, 256, 256, 5000, .08);
});
const leatherTex = () => canvasTex(256, 256, c => {
  c.fillStyle = '#7a1c24'; c.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {const x = i * 64 + (j % 2) * 32, y = j * 64;
    const g = c.createRadialGradient(x, y, 2, x, y, 30); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(.25, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(255,255,255,.05)');
    c.fillStyle = g; c.fillRect(x - 32, y - 32, 64, 64);}
  noise(c, 256, 256, 2000, .06);
});
const emblemTex = () => canvasTex(512, 512, c => {  // a round seal: the scales, and a ring of words
  const g = c.createRadialGradient(220, 200, 20, 256, 256, 250); g.addColorStop(0, '#fbe7a1'); g.addColorStop(.7, '#d8a93e'); g.addColorStop(1, '#8a6118');
  c.fillStyle = g; c.beginPath(); c.arc(256, 256, 250, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6b4a10'; c.lineWidth = 10; c.beginPath(); c.arc(256, 256, 236, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.arc(256, 256, 178, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#5a3c0a'; c.font = 'bold 40px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const words = '★ COURT OF UNIVERSE FIVE ★ PLAIN WORDS ';
  for (let i = 0; i < words.length; i++) {const a = i / words.length * Math.PI * 2 - Math.PI / 2; c.save(); c.translate(256 + Math.cos(a) * 207, 256 + Math.sin(a) * 207); c.rotate(a + Math.PI / 2); c.fillText(words[i], 0, 0); c.restore();}
  c.strokeStyle = '#5a3c0a'; c.fillStyle = '#5a3c0a'; c.lineCap = 'round'; c.lineWidth = 12;
  c.beginPath(); c.moveTo(256, 120); c.lineTo(256, 360); c.stroke();                 // post
  c.beginPath(); c.moveTo(150, 175); c.lineTo(362, 175); c.stroke();                 // beam
  c.beginPath(); c.moveTo(196, 380); c.lineTo(316, 380); c.stroke();                 // foot
  c.beginPath(); c.arc(256, 118, 14, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) {
    const x = 256 + s * 106; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x, 175); c.lineTo(x - 42, 262); c.moveTo(x, 175); c.lineTo(x + 42, 262); c.stroke();
    c.beginPath(); c.moveTo(x - 56, 262); c.quadraticCurveTo(x, 312, x + 56, 262); c.closePath(); c.fill();
  }
});
const windowTex = () => canvasTex(256, 512, c => {  // a tall arched window, bright sky behind
  c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 256, 512);
  const arch = () => {c.beginPath(); c.moveTo(20, 510); c.lineTo(20, 128); c.arc(128, 128, 108, Math.PI, 0); c.lineTo(236, 510); c.closePath();};
  const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#fffdf2'); g.addColorStop(.6, '#fff1cf'); g.addColorStop(1, '#ffe2a8');
  c.fillStyle = g; arch(); c.fill();
  c.strokeStyle = '#3d2414'; c.lineWidth = 12; arch(); c.stroke();
  c.lineWidth = 7; c.beginPath();
  for (const y of [200, 300, 400]) {c.moveTo(20, y); c.lineTo(236, y);}
  c.moveTo(128, 20); c.lineTo(128, 510); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.arc(128, 128, 60, Math.PI, 0); c.stroke();
});
const rayTex = () => canvasTex(128, 512, c => {  // a soft light shaft, brightest at the window end
  const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, 'rgba(255,236,190,.55)'); g.addColorStop(1, 'rgba(255,236,190,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 512);
  const s = c.createLinearGradient(0, 0, 128, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(.2, 'rgba(0,0,0,0)'); s.addColorStop(.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = s; c.fillRect(0, 0, 128, 512);
});
const bookTex = (cover: string) => canvasTex(128, 64, c => {  // a book's side: the cover band and the pages
  c.fillStyle = '#f2e8d2'; c.fillRect(0, 0, 128, 64);
  for (let y = 10; y < 56; y += 3) {c.fillStyle = 'rgba(120,100,70,.25)'; c.fillRect(0, y, 128, 1);}
  c.fillStyle = cover; c.fillRect(0, 0, 128, 9); c.fillRect(0, 55, 128, 9); c.fillRect(0, 0, 10, 64);
});

export type Rig = ReturnType<typeof build>;
export function build(canvas: HTMLCanvasElement, W: number, H: number) {
  seed = 5;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, W / H, .05, 200);
  const lam = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(o);
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); scene.add(b); return b;
  };
  const tex = (t: THREE.Texture, rx: number, ry: number) => {const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c;};
  const trimM = lam({color: WOOD_D}), capM = lam({color: '#5a3320'}), goldM = lam({color: '#d8a93e', emissive: '#3a2a08'});
  const panel = panelTex(4, 1), panel2 = panelTex(2, 2), plank = plankTex(WOOD, WOOD_D, 8, true);

  /* floor: parquet, and the green carpet of the well with a gold edge */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), lam({map: tex(parquetTex(), 10, 10)}));
  floor.position.set(0, 0, -1); scene.add(floor);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 6.6).rotateX(-Math.PI / 2), lam({map: tex(carpetTex(), 5, 3.3)}));
  carpet.position.set(0, .006, -3.3); scene.add(carpet);
  for (const [w, d, x, z] of [[10.6, .12, 0, -.0], [10.6, .12, 0, -6.6], [.12, 6.6, -5.25, -3.3], [.12, 6.6, 5.25, -3.3]] as const) box(w, .014, d, goldM, x, .007, z);

  /* the back wall: wainscot, cream plaster, pilasters, the seal */
  const back = -8.5;
  box(20, 1.4, .12, lam({map: tex(panel, 5, 1)}), 0, .7, back);
  box(20, .1, .2, capM, 0, 1.42, back + .04);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 5.6), lam({map: tex(plasterTex(), 4, 1.2)})); wall.position.set(0, 4.2, back - .02); scene.add(wall);
  for (const x of [-7.4, -3.7, 3.7, 7.4]) {box(.55, 5.6, .22, lam({map: tex(plank, .5, 3)}), x, 4.2, back + .08); box(.8, .28, .34, capM, x, 6.9, back + .1); box(.75, .22, .3, capM, x, 1.55, back + .1);}
  box(20, .35, .3, capM, 0, 7.05, back + .1);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.15, 64), lam({map: emblemTex(), transparent: true, emissive: '#2a1c04'})); seal.position.set(0, 4.55, back + .08); scene.add(seal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, .07, 12, 64), capM); ring.position.set(0, 4.55, back + .1); scene.add(ring);
  // two long drapes either side of the seal
  const drapeM = lam({color: '#6e1a22'});
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(.4, .55, 5.2, 18, 1, true, -Math.PI / 2, Math.PI);  // the front half of a cone
    const d = new THREE.Mesh(g, drapeM); d.position.set(s * 2.15, 4.35, back + .05); scene.add(d);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(.5, .03, 6, 20), goldM); cord.position.set(s * 2.15, 3.1, back + .25); cord.rotation.x = Math.PI / 2.3; scene.add(cord);
  }

  /* side walls with tall windows and the light that comes in through them */
  const winT = windowTex(), rays = rayTex();
  for (const s of [-1, 1]) {
    const x = s * 9;
    box(.12, 1.4, 18, lam({map: tex(panel, 4.5, 1)}), x, .7, -1);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.6), lam({map: tex(plasterTex(), 3.6, 1.2)}));
    pl.position.set(x - s * .02, 4.2, -1); pl.rotation.y = -s * Math.PI / 2; scene.add(pl);
    box(.3, .35, 18, capM, x - s * .1, 7.05, -1);
    for (const z of [-5.8, -2.2, 1.4]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.4), new THREE.MeshBasicMaterial({map: winT, transparent: true}));
      win.position.set(x - s * .05, 4.1, z); win.rotation.y = -s * Math.PI / 2; scene.add(win);
      box(.2, .12, 1.8, capM, x - s * .08, 2.36, z);
      if (s < 0) {  // the sun comes in from the left
        const r = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.MeshBasicMaterial({map: rays, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55, side: THREE.DoubleSide}));
        r.position.set(x + 3.1, 2.4, z + .6); r.rotation.set(0, Math.PI / 2 - .25, -.95); scene.add(r);
      }
    }
  }
  /* ceiling: dark coffers and two pendant lamps */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 18).rotateX(Math.PI / 2), lam({color: '#4a2e1c'})); ceil.position.set(0, 7.2, -1); scene.add(ceil);
  for (let k = -8; k <= 8; k += 2) {box(.18, .25, 18, capM, k, 7.08, -1); box(18, .25, .18, capM, 0, 7.08, k - 1);}
  const lampM = new THREE.MeshBasicMaterial({color: '#fff0c4'});
  for (const [x, z] of [[-3, -4], [3, -4], [-3, 1], [3, 1]]) {
    box(.02, 1.6, .02, trimM, x, 6.3, z);
    const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(.18, .45, .3, 20, 1, true), lam({color: '#2e4a3a', side: THREE.DoubleSide})); shadeM.position.set(x, 5.4, z); scene.add(shadeM);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), lampM); bulb.position.set(x, 5.3, z); scene.add(bulb);
  }

  /* the judge's bench: a platform, the high front, a leather chair behind */
  const J = DESK.judge;
  box(7.2, .45, 2.8, lam({map: tex(plank, 3, 1)}), 0, .225, -7.2);
  box(J.max[0] - J.min[0], J.max[1] - J.min[1], J.max[2] - J.min[2], lam({map: tex(panel, 1.4, 1)}), 0, (J.max[1] + J.min[1]) / 2, (J.max[2] + J.min[2]) / 2);
  box(6.0, .1, 1.1, capM, 0, J.max[1] + .05, (J.max[2] + J.min[2]) / 2 + .05);
  box(5.7, .12, .1, goldM, 0, J.max[1] - .25, J.max[2] + .01);
  const nameplate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .32), lam({map: canvasTex(384, 82, c => {
    c.fillStyle = '#d8a93e'; c.fillRect(0, 0, 384, 82); c.strokeStyle = '#6b4a10'; c.lineWidth = 6; c.strokeRect(5, 5, 374, 72);
    c.fillStyle = '#3d2806'; c.font = 'bold 44px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('THE READER', 192, 44);}), emissive: '#2a1c04'}));
  nameplate.position.set(-1.9, 1.6, J.max[2] + .02); scene.add(nameplate);   // off-centre: the witness stands in front of the middle
  const leather = leatherTex();
  box(1.5, 1.9, .25, lam({map: leather}), 0, 2.9, -7.95);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .25, 24, 1, false, -Math.PI / 2, Math.PI), lam({map: leather}));  // the chair's round top
  top.rotation.x = -Math.PI / 2; top.position.set(0, 3.85, -7.95); scene.add(top);
  // the sound block for the gavel, papers
  const block = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .07, 24), capM); block.position.set(.95, J.max[1] + .135, -6.45); scene.add(block);
  const paperM = lam({color: '#f6f1e4'});
  box(.42, .03, .3, paperM, -1.2, J.max[1] + .115, -6.55).rotation.y = .2;
  box(.42, .03, .3, paperM, -1.15, J.max[1] + .145, -6.5).rotation.y = -.1;

  /* the witness stand on its low platform */
  const Wt = DESK.witness;
  box(2.4, Wt.min[1], 1.6, lam({map: tex(plank, 1.2, 1)}), 0, Wt.min[1] / 2, -3.0);
  box(Wt.max[0] - Wt.min[0], Wt.max[1] - Wt.min[1], Wt.max[2] - Wt.min[2], lam({map: tex(panel2, .8, 1)}), 0, (Wt.max[1] + Wt.min[1]) / 2, (Wt.max[2] + Wt.min[2]) / 2);
  box(1.66, .07, .58, capM, 0, Wt.max[1] + .035, (Wt.max[2] + Wt.min[2]) / 2);
  for (const s of [-1, 1]) box(.07, .45, .07, capM, s * .9, Wt.min[1] + .225, -3.4 - .3);  // rail posts
  box(1.9, .06, .06, capM, 0, Wt.min[1] + .45, -3.7);

  /* the two counsel desks */
  for (const k of ['defense', 'prosecution'] as const) {
    const D = DESK[k], cx = (D.max[0] + D.min[0]) / 2, cz = (D.max[2] + D.min[2]) / 2;
    box(D.max[0] - D.min[0], D.max[1], D.max[2] - D.min[2], lam({map: tex(panel, 1, 1)}), cx, D.max[1] / 2, cz);
    box(D.max[0] - D.min[0] + .16, .07, D.max[2] - D.min[2] + .16, capM, cx, D.max[1] + .035, cz);
    for (let i = 0; i < 3; i++) box(.3, .012, .42, paperM, cx + (rnd() - .5) * .3, D.max[1] + .075 + i * .012, cz + (i - 1) * .35 + (rnd() - .5) * .2).rotation.y = (rnd() - .5) * .6;
  }
  // a folder on the defence desk, and the stack of law books Meb stands on
  box(.34, .03, .46, lam({color: '#c9423a'}), -4.8, DESK.defense.max[1] + .1, -1.2).rotation.y = .15;
  const M = SPOT.meb;
  [['#7d2a2a', .62, .21, 0], ['#233f6b', .58, .2, .12], ['#2d5a3a', .56, .19, -.1]].forEach(([col, w, h, rot], i) => {
    const bt = bookTex(col as string);
    const y = [0, .21, .41][i] + (h as number) / 2;
    const b = box(w as number, h as number, .44, [lam({map: bt}), lam({map: bt}), lam({color: col as string}), lam({color: col as string}), lam({map: bt}), lam({map: bt})], M[0], y, M[2]);
    b.rotation.y = rot as number;
  });

  /* the gallery: a rail with balusters and three pews */
  const railZ = 1.9;
  for (const s of [-1, 1]) {
    box(7.6, .08, .12, capM, s * 4.9, 1.0, railZ); box(7.6, .1, .14, capM, s * 4.9, .05, railZ);
    for (let x = 1.2; x < 8.8; x += .26) {const p = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, .9, 8), lam({color: WOOD_L})); p.position.set(s * x, .5, railZ); scene.add(p);}
  }
  for (const z of [3.0, 4.3, 5.6]) for (const s of [-1, 1]) {
    box(7.2, .08, .5, lam({map: tex(plank, 2, .2)}), s * 4.9, .46, z);
    box(7.2, .75, .08, lam({map: tex(panel, 2.6, .6)}), s * 4.9, .8, z + .28);
  }

  /* light: warm room light, the sun from the left windows, a soft front fill */
  scene.add(new THREE.HemisphereLight('#fff3dc', '#5a3a26', 1.35));
  const sun = new THREE.DirectionalLight('#ffe1b0', 1.25); sun.position.set(-12, 9, 2); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#dfe6ff', .45); fill.position.set(4, 6, 12); scene.add(fill, fill.target);
  scene.fog = new THREE.Fog('#3a2618', 22, 60);

  function render(s: State) {
    renderer.setClearColor('#2a1a10');
    camera.position.set(...s.cam.pos); camera.lookAt(...s.cam.look);
    if (camera.fov !== s.cam.fov) {camera.fov = s.cam.fov; camera.updateProjectionMatrix();}
    renderer.render(scene, camera);
  }
  return {render, camera};
}
