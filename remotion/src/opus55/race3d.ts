/**
 * Universe one's world: a three-lane highway racer, in plain three.js (see memory three-inside-remotion).
 * Built ONCE per tab by build(); render(state) moves the camera, the cars, the coins and the light, then draws.
 * Road runs along -Z: a distance d down the road is z = -d. Lanes sit at x = -LANE, 0, +LANE.
 * Meb is never a mesh: uni1.tsx draws him in 2D on the projected roof.
 * The game (channel/game) builds the same world with Opts: its own car bodies, rival ghosts, a named blimp.
 */
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

export const LANE = 3.6, RAIL = 8.7, TRACK = 3400, LEN = TRACK + 150;
export type V3 = [number, number, number];
export type Kind = 'sedan' | 'suv' | 'van' | 'truck' | 'bus';
export type Gate = {d: number; kind: 'step' | 'finish' | 'start' | 'exit'; text: string; tab?: string; color?: string;
  lanes?: [string, string, string]};   // the game: a sign over each lane (left to right), a light before it, a wall after it
export type Board = {d: number; side: -1 | 1; lines: [string, string]; bg: string; fg: string};
export type Spec = {gates: Gate[]; traffic: {kind: Kind; color: string}[]; coins: number; boards: Board[]};
export type State = {
  cam: {pos: V3; look: V3; fov: number; roll: number};
  car: {x: number; d: number; yaw: number; roll: number; nitro: number; bob: number};
  ghost: {x: number; d: number; o: number};
  traffic: {x: number; d: number}[];
  coins: {x: number; d: number; y: number; spin: number; s: number}[];
  gates: {s: number; flash: number; spin?: number}[];
  lamps: number;   // start gantry: 0-3 red lamps lit, 4 = all green
  beams: {from: V3; p: number}[];   // a trip to the model: from the car up to the blimp, p = 0..1
  tod: number;     // 0 day, 1 golden hour, 2 dusk
  blimp: V3;
  f: number;
  ghosts?: {x: number; d: number; o: number}[];  // the game's rivals (channel/game), one per Opts.ghosts
  /** The game's lane gates, by gate index: each lane's light (0..1) and colour, and its wall (0 down, 1 up). */
  lanes?: ({light: number[]; col: string[]; wall: number[]} | null)[];
  /** The game's pit stop: where the car stands, the seconds into the stop and how long it lasts. The crew works for that long. */
  pit?: {x: number; d: number; t: number; dur: number} | null;
};
/** What the game (channel/game) swaps in; the video passes none of it and gets the orange OPUS 5.5 car. */
export type CarBody = 'sports' | 'hatch' | 'gt' | 'classic';
export type CarLook = {paint: string; plate: string; body?: CarBody};
export type Opts = {player?: CarLook; ghosts?: CarLook[]; blimp?: {label: string; band: string}; crew?: boolean};   // crew: the pit stop's four tyres
/** Roof height of each body, for drawing Meb on top. */
export const ROOF_Y: Record<CarBody, number> = {sports: 1.36, hatch: 1.55, gt: 1.37, classic: 1.67};
/** The game's pit crew, one at each wheel: hop in from the roadside, work while the tyre comes off and on about once a second, hop out.
 *  The crew are Mebs, so the game draws them in 2D at `pos` (feet); this file only moves the tyres. */
export const CREW = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
export const crewAt = (p: NonNullable<State['pit']>, i: number) => {
  const [sx, sz] = CREW[i], near = Math.max(0, Math.min(1, p.t / .3, (p.dur - p.t) / .3)), work = near >= 1;
  const u = Math.max(0, Math.min(1, (p.t - .3) / Math.max(.01, p.dur - .6))), off = Math.abs(Math.sin(u * Math.PI * Math.max(1, Math.round(p.dur - .6))));
  return {sx, work, off, pos: [p.x + sx * (6.5 - 4.4 * near), work ? 0 : Math.abs(Math.sin(p.t * 24 + i)) * .14, -p.d + sz * 1.5] as V3};
};

/* ---------- small makers ---------- */
let seed = 11;
const rnd = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
const col = (c: string) => new THREE.Color(c);
const lam = (c: string, o: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({color: c, ...o});
const std = (c: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => new THREE.MeshPhysicalMaterial({color: c, roughness: .45, metalness: 0, ...o});
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b;};
function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  if (repeat) {t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);}
  return t;
}
const rrect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {c.beginPath(); c.roundRect(x, y, w, h, r);};
const FONT = (px: number) => `bold ${px}px Arial, Helvetica, sans-serif`;
/** Text that fits: shrinks the font until the line is at most maxW wide. */
const fitText = (c: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, maxW: number) => {
  let p = px; c.font = FONT(p);
  while (c.measureText(s).width > maxW && p > 10) {p -= 2; c.font = FONT(p);}
  c.fillText(s, x, y);
};
const radial = (inner: string, outer: string) => tex(128, 128, c => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});

/* ---------- textures ---------- */
const PXM = 512 / 14;  // road texture: 14 m wide, one tile = 12 m long
function roadTex() {
  return tex(512, 1024, c => {
    c.fillStyle = '#3b3e45'; c.fillRect(0, 0, 512, 1024);
    c.fillStyle = '#44474e'; c.fillRect(0, 0, 1.6 * PXM, 1024); c.fillRect(512 - 1.6 * PXM, 0, 1.6 * PXM, 1024);
    for (let i = 0; i < 9000; i++) {const v = 40 + rnd() * 40; c.fillStyle = `rgba(${v + 10},${v + 12},${v + 18},${.35 + rnd() * .4})`; c.fillRect(rnd() * 512, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 2);}
    for (const lane of [-1, 0, 1]) for (const s of [-.85, .85]) {  // tyre tracks, a shade darker
      c.fillStyle = 'rgba(20,20,26,.16)'; c.fillRect((7 + lane * LANE + s - .35) * PXM, 0, .7 * PXM, 1024);}
    c.fillStyle = '#f4f2ea';
    for (const x of [-5.4, 5.4]) c.fillRect((7 + x - .09) * PXM, 0, .18 * PXM, 1024);           // edge lines
    for (const x of [-1.8, 1.8]) c.fillRect((7 + x - .075) * PXM, 0, .15 * PXM, 1024 * 3 / 12); // 3 m dash, 9 m gap
  }, [1, LEN / 12]);
}
const grassTex = () => tex(256, 256, c => {
  for (let i = 0; i < 8; i++) {c.fillStyle = i % 2 ? '#5aa83c' : '#66b546'; c.fillRect(i * 32, 0, 32, 256);}  // mowing stripes, along the road
  for (let i = 0; i < 2500; i++) {c.fillStyle = rnd() < .5 ? 'rgba(40,90,30,.35)' : 'rgba(150,200,90,.3)'; c.fillRect(rnd() * 256, rnd() * 256, 2, 3);}
}, [1400 / 24, LEN / 24]);
// 7 m blocks: a pattern whose period is near twice the distance moved per frame swaps colour every frame and blinks (2.4 m did, 2026-09-26)
const kerbTex = () => tex(64, 128, c => {c.fillStyle = '#e8352e'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#f7f4ee'; c.fillRect(0, 64, 64, 64);}, [1, LEN / 14]);
const checker = (nx: number, ny: number, w: number, h: number) => tex(w, h, c => {
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {c.fillStyle = (i + j) % 2 ? '#111' : '#fafafa'; c.fillRect(i * w / nx, j * h / ny, w / nx + 1, h / ny + 1);}
});

/* ---------- vehicles ---------- */
type Car = {g: THREE.Group; wheels: THREE.Object3D[]; flames?: THREE.Object3D[]; lights?: THREE.MeshBasicMaterial[]};
const TIRE = lam('#1a1a1e'), RIM = std('#c9ccd4', {metalness: .9, roughness: .3}), GLASS = std('#0f1624', {roughness: .08, clearcoat: 1, metalness: .2});
const TAIL = new THREE.MeshBasicMaterial({color: '#ff2a2a'}), HEAD = new THREE.MeshBasicMaterial({color: '#fff6de'}), BLACK = lam('#15161a');
function wheel(r: number, w: number) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), TIRE); t.rotation.z = Math.PI / 2; g.add(t);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .62, r * .62, w + .02, 10), RIM); m.rotation.z = Math.PI / 2; g.add(m);
  return g;
}
/** Side profile [length, height] points (front = +u) extruded across the width; front ends up facing -Z. */
function profile(pts: [number, number][], width: number, m: THREE.Material, bevel = .08) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ExtrudeGeometry(s, {depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4});
  geo.translate(0, 0, -(width - 2 * bevel) / 2); geo.rotateY(Math.PI / 2); geo.computeVertexNormals();
  return new THREE.Mesh(geo, m);
}
const plateTex = (s: string) => tex(256, 64, c => {c.fillStyle = '#f4f4f0'; rrect(c, 2, 2, 252, 60, 8); c.fill(); c.strokeStyle = '#223'; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#1b2440'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, s, 128, 35, 44, 230);});

/** The player's car: a low fastback in Claude orange, glass canopy, LED tail bar, wing, twin exhausts. */
function sportsCar(paint: string, plate: string, ghost?: THREE.Material): Car {
  const g = new THREE.Group(), P = ghost || std(paint, {roughness: .28, clearcoat: 1, clearcoatRoughness: .08}), G = ghost || GLASS;
  const K = ghost || BLACK, TL = ghost || TAIL;
  g.add(profile([[-2.25, .3], [-2.33, .55], [-2.3, .82], [-2.05, .95], [1.15, .97], [2.0, .8], [2.33, .6], [2.3, .34], [2.1, .28], [-2.1, .28]], 1.92, P, .1));
  g.add(profile([[-1.72, .93], [-.78, 1.29], [.32, 1.31], [1.2, .95]], 1.56, G, .1));                     // the canopy
  g.add(profile([[-.84, 1.25], [-.78, 1.33], [.32, 1.35], [.4, 1.28]], 1.44, P, .05));                    // roof panel
  g.add(box(1.7, .07, .04, TL, 0, .8, 2.45));                                                            // LED tail bar
  for (const s of [-1, 1]) g.add(box(.34, .14, .05, TL, s * .7, .74, 2.45));
  g.add(box(1.5, .2, .1, K, 0, .4, 2.42));                                                               // diffuser
  for (const s of [-1, 1]) {const e = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .2, 12), ghost || RIM); e.rotation.x = Math.PI / 2; e.position.set(s * .45, .38, 2.5); g.add(e);}
  g.add(box(1.8, .05, .34, K, 0, 1.13, 2.02)); for (const s of [-1, 1]) g.add(box(.06, .18, .12, K, s * .6, 1.02, 2.05));  // the wing
  for (const s of [-1, 1]) g.add(box(.62, .1, .06, ghost || HEAD, s * .62, .66, -2.34));                   // headlights
  for (const s of [-1, 1]) g.add(box(.18, .1, .12, P, s * 1.0, 1.02, -.78));                               // mirrors
  if (!ghost) {const pl = new THREE.Mesh(new THREE.PlaneGeometry(.56, .14), new THREE.MeshBasicMaterial({map: plateTex(plate)})); pl.position.set(0, .57, 2.455); g.add(pl);}
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [[-.9, -1.45], [.9, -1.45], [-.9, 1.5], [.9, 1.5]]) {const w = wheel(.37, .3); w.position.set(x, .37, z); g.add(w); wheels.push(w);}
  if (ghost) wheels.forEach(w => w.traverse(o => {if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ghost;}));
  return {g, wheels, flames: ghost ? [] : nitroFlames(g, .45, .38, 2.55)};
}
/** Nitro: an outer blue cone and a white core per exhaust, pointing back; hidden until render() lights them. */
function nitroFlames(g: THREE.Group, x: number, y: number, z: number) {
  return [-1, 1].map(s => {
    const f = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.17, 1.6, 14, 1, true), new THREE.MeshBasicMaterial({color: '#3aa0ff', transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false}));
    const core = new THREE.Mesh(new THREE.ConeGeometry(.08, 1.0, 10, 1, true), new THREE.MeshBasicMaterial({color: '#eaffff', transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false}));
    outer.rotation.x = core.rotation.x = -Math.PI / 2; outer.position.z = .8; core.position.z = .5;
    f.add(outer, core); f.position.set(s * x, y, z); f.visible = false; g.add(f); return f;
  });
}
const CHROME = std('#dfe3ea', {metalness: .95, roughness: .18});
/** Shared by the game's three other bodies: a body profile, a glass cabin, a roof panel, lights, wheels. */
function bodyCar(o: {len: number; wd: number; body: [number, number][]; cabin: [number, number][]; roof: [number, number][];
  wheelR: number; wheelZ: [number, number]; tailY: number; headY: number}, paint: string, plate: string, ghost?: THREE.Material): Car {
  const g = new THREE.Group(), P = ghost || std(paint, {roughness: .3, clearcoat: 1, clearcoatRoughness: .1}), G = ghost || GLASS, back = o.len / 2;
  g.add(profile(o.body, o.wd, P, .1));
  g.add(profile(o.cabin, o.wd - .3, G, .08));
  g.add(profile(o.roof, o.wd - .42, P, .05));
  for (const s of [-1, 1]) {g.add(box(.4, .14, .05, ghost || TAIL, s * (o.wd / 2 - .32), o.tailY, back + .02)); g.add(box(.44, .12, .05, ghost || HEAD, s * (o.wd / 2 - .34), o.headY, -back - .02));}
  if (!ghost) {const pl = new THREE.Mesh(new THREE.PlaneGeometry(.56, .14), new THREE.MeshBasicMaterial({map: plateTex(plate)})); pl.position.set(0, o.tailY - .2, back + .03); g.add(pl);}
  const wheels: THREE.Object3D[] = [];
  for (const z of o.wheelZ) for (const s of [-1, 1]) {const w = wheel(o.wheelR, .3); w.position.set(s * (o.wd / 2 - .08), o.wheelR, z); g.add(w); wheels.push(w);}
  if (ghost) wheels.forEach(w => w.traverse(m => {if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).material = ghost;}));
  return {g, wheels, flames: []};
}
/** A small, tall hatchback: short nose, upright tail. */
const hatchCar = (paint: string, plate: string, ghost?: THREE.Material) => bodyCar({len: 3.9, wd: 1.78, wheelR: .33, wheelZ: [-1.25, 1.25], tailY: .92, headY: .7,
  body: [[-1.95, .3], [-2.0, .55], [-1.98, .95], [-1.9, 1.02], [1.3, 1.02], [1.85, .86], [2.0, .6], [1.97, .32], [1.8, .28], [-1.8, .28]],
  cabin: [[-1.86, .98], [-1.76, 1.48], [.42, 1.5], [1.22, 1.0]], roof: [[-1.78, 1.44], [-1.74, 1.55], [.4, 1.56], [.5, 1.48]]}, paint, plate, ghost);
/** A long grand tourer: long bonnet, cabin set back, four exhausts for fast mode. */
function gtCar(paint: string, plate: string, ghost?: THREE.Material): Car {
  const c = bodyCar({len: 5.24, wd: 2.0, wheelR: .4, wheelZ: [-1.75, 1.7], tailY: .8, headY: .68,
    body: [[-2.55, .32], [-2.62, .6], [-2.55, .88], [-2.2, .98], [.2, 1.0], [1.1, .93], [2.3, .82], [2.62, .62], [2.6, .36], [2.35, .3], [-2.35, .3]],
    cabin: [[-1.95, .96], [-1.0, 1.3], [-.1, 1.32], [.8, .98]], roof: [[-1.05, 1.27], [-1.0, 1.37], [-.1, 1.38], [-.02, 1.3]]}, paint, plate, ghost);
  if (!ghost) {c.g.add(box(1.7, .07, .04, TAIL, 0, .84, 2.63)); c.g.add(box(1.6, .2, .1, BLACK, 0, .42, 2.6));
    c.g.add(box(1.9, .05, .3, BLACK, 0, 1.08, 2.3)); c.flames = nitroFlames(c.g, .55, .4, 2.66);}
  return c;
}
/** An old luxury car: tall upright cabin, chrome bumpers and grille. */
function classicCar(paint: string, plate: string, ghost?: THREE.Material): Car {
  const c = bodyCar({len: 5.3, wd: 1.95, wheelR: .42, wheelZ: [-1.75, 1.75], tailY: .86, headY: .78,
    body: [[-2.6, .35], [-2.66, .72], [-2.5, .96], [-1.6, 1.02], [1.4, 1.02], [2.4, .96], [2.64, .74], [2.62, .38], [-2.6, .35]],
    cabin: [[-1.5, .98], [-1.36, 1.6], [.74, 1.6], [.96, .98]], roof: [[-1.4, 1.56], [-1.38, 1.68], [.72, 1.68], [.8, 1.58]]}, paint, plate, ghost);
  if (!ghost) {for (const z of [-2.7, 2.7]) c.g.add(box(2.0, .16, .18, CHROME, 0, .44, z)); c.g.add(box(.9, .46, .05, CHROME, 0, .72, -2.66));
    c.g.add(box(.08, .16, .3, CHROME, 0, 1.08, -2.3));}
  return c;
}
const car = (l: CarLook, ghost?: THREE.Material): Car =>
  (l.body === 'hatch' ? hatchCar : l.body === 'gt' ? gtCar : l.body === 'classic' ? classicCar : sportsCar)(l.paint, l.plate, ghost);

/** Traffic: boxy and friendly, one colour, glass, lights, wheels. */
function trafficCar(kind: Kind, paint: string): Car {
  const g = new THREE.Group(), P = std(paint, {roughness: .4, clearcoat: .6}), wheels: THREE.Object3D[] = [];
  const D: Record<Kind, [number, number, number, number, number, number]> = {  // length, width, body top, cabin len, cabin top, cabin shift
    sedan: [4.5, 1.82, .95, 2.3, 1.45, .15], suv: [4.8, 1.98, 1.15, 2.9, 1.85, .2], van: [5.3, 2.02, 2.25, 0, 0, 0],
    truck: [11.5, 2.5, 3.7, 0, 0, 0], bus: [11.2, 2.5, 3.2, 0, 0, 0]};
  const [len, wd, top, cl, ct, cs] = D[kind];
  if (kind === 'truck') {
    g.add(box(wd, 3.2, 8.6, std('#f2f2f0', {roughness: .6}), 0, 2.05, 1.3));                              // the box
    const back = new THREE.Mesh(new THREE.PlaneGeometry(wd - .1, 3.0), new THREE.MeshLambertMaterial({map: tex(256, 320, c => {
      c.fillStyle = '#e9e9e6'; c.fillRect(0, 0, 256, 320); c.strokeStyle = '#9a9a9a'; c.lineWidth = 4; c.strokeRect(6, 6, 244, 308); c.beginPath(); c.moveTo(128, 6); c.lineTo(128, 314); c.stroke();
      c.fillStyle = paint; c.fillRect(20, 110, 216, 84); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'TOKEN', 128, 136, 40, 200); fitText(c, 'EXPRESS', 128, 172, 30, 200);})}));
    back.position.set(0, 2.05, 5.61); g.add(back);
    g.add(box(wd, 2.3, 2.4, P, 0, 1.55, -4.25)); g.add(box(wd - .2, .9, .1, GLASS, 0, 2.2, -5.46));
    for (const s of [-1, 1]) g.add(box(.3, .16, .05, TAIL, s * 1.0, .75, 5.62));
    for (const z of [-4.2, 3.2, 4.6]) for (const s of [-1, 1]) {const w = wheel(.52, .38); w.position.set(s * 1.1, .52, z); g.add(w); wheels.push(w);}
  } else if (kind === 'bus') {
    g.add(box(wd, 2.8, len, P, 0, 1.8, 0)); g.add(box(wd + .02, .9, len - 1.4, GLASS, 0, 2.4, -.3)); g.add(box(wd - .3, 1.0, .05, GLASS, 0, 2.4, len / 2 + .01));
    g.add(box(wd + .03, .25, len, std('#ffffff'), 0, 1.55, 0));
    for (const s of [-1, 1]) g.add(box(.3, .3, .05, TAIL, s * 1.0, .9, len / 2 + .02));
    for (const z of [-3.6, 3.6]) for (const s of [-1, 1]) {const w = wheel(.5, .36); w.position.set(s * 1.1, .5, z); g.add(w); wheels.push(w);}
  } else if (kind === 'van') {
    g.add(profile([[-len / 2, .35], [-len / 2, 2.25], [len / 2 - 1.3, 2.25], [len / 2 - .35, 1.25], [len / 2, 1.15], [len / 2, .35]], wd, P, .06));
    g.add(box(wd - .3, .6, .05, GLASS, 0, 1.75, len / 2 + .07)); g.add(box(wd + .04, .5, 1.1, GLASS, 0, 1.8, -len / 2 + 1.55));
    for (const s of [-1, 1]) g.add(box(.25, .3, .05, TAIL, s * .85, 1.0, len / 2 + .07));
    for (const z of [-1.7, 1.7]) for (const s of [-1, 1]) {const w = wheel(.4, .3); w.position.set(s * .92, .4, z); g.add(w); wheels.push(w);}
  } else {
    g.add(box(wd, top - .3, len, P, 0, .3 + (top - .3) / 2, 0));
    g.add(profile([[-cl / 2, top - .02], [-cl / 2 + .35, ct], [cl / 2 - .55, ct], [cl / 2, top - .02]], wd - .16, GLASS, .06).translateZ(cs));
    g.add(box(wd - .3, .06, cl - 1.0, P, 0, ct + .01, cs + .1));
    for (const s of [-1, 1]) {g.add(box(.42, .14, .05, TAIL, s * (wd / 2 - .3), top - .2, len / 2 + .01)); g.add(box(.4, .12, .05, HEAD, s * (wd / 2 - .3), top - .25, -len / 2 - .01));}
    const r = kind === 'suv' ? .42 : .36;
    for (const z of [-len * .32, len * .32]) for (const s of [-1, 1]) {const w = wheel(r, .28); w.position.set(s * (wd / 2 - .08), r, z); g.add(w); wheels.push(w);}
  }
  return {g, wheels};
}

/* ---------- roadside ---------- */
function gantry(gt: Gate, signs: THREE.MeshBasicMaterial[]) {
  const g = new THREE.Group(), M = lam('#8d939c'), Y = gt.kind === 'finish' ? lam('#e8352e') : M;
  for (const s of [-1, 1]) {g.add(box(.4, 7.8, .4, Y, s * 8.2, 3.9, 0)); g.add(box(.9, .3, .9, lam('#9a9a9a'), s * 8.2, .15, 0));}
  g.add(box(16.8, .34, .34, M, 0, 7.6, 0)); g.add(box(16.8, .2, .2, M, 0, 6.3, .0));
  for (let i = -7; i <= 7; i += 1.4) g.add(box(.08, 1.3, .08, M, i, 6.95, 0).rotateZ(i % 2.8 ? .7 : -.7));  // truss
  const sign = new THREE.MeshBasicMaterial({map: tex(1024, 280, c => {
    if (gt.kind === 'finish') {
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {c.fillStyle = (i + j) % 2 ? '#111' : '#fafafa'; c.fillRect(i * 32, j * 32, 32, 32); c.fillRect(i * 32, 216 + j * 32, 32, 32);}
      c.fillStyle = '#111'; c.fillRect(0, 64, 1024, 152); c.fillStyle = '#ffd23f'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, gt.text, 512, 142, 110, 960);
    } else {
      c.fillStyle = gt.color || '#0f6a3b'; rrect(c, 0, 0, 1024, 280, 30); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 12; rrect(c, 14, 14, 996, 252, 22); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, gt.text, 512, 144, 118, 920);
    }
  })});
  signs.push(sign);
  const w = gt.kind === 'finish' ? 16.4 : 7.2;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 280 / 1024), sign); p.position.set(0, 6.9, .22); g.add(p);
  if (gt.tab) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .62), new THREE.MeshBasicMaterial({map: tex(360, 100, c => {
      c.fillStyle = '#ffd23f'; rrect(c, 0, 0, 360, 100, 14); c.fill(); c.fillStyle = '#10213a'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, gt.tab!, 180, 54, 62, 330);})}));
    t.position.set(0, 8.3, .25); g.add(t);
  }
  g.position.z = -gt.d;
  return g;
}

/* ---------- the rig ---------- */
export type Rig = ReturnType<typeof build>;
const KEY = {  // day, golden hour, dusk
  top: ['#2a6fd6', '#3e5aa8', '#1d1747'], hor: ['#c4e4ff', '#ffcf9c', '#ff8466'], sun: ['#fff4d6', '#ffbd6b', '#ff6b4a'],
  hemiS: ['#e4f1ff', '#ffe0bd', '#9b7ad0'], hemiG: ['#56753a', '#77583a', '#2c2344'], mtn: ['#7896bd', '#7f76a6', '#4a3470'],
  cloud: ['#ffffff', '#ffe3c8', '#ffb0a6'], city: ['#8fa6c4', '#a58aa8', '#352a5a'],
};
const pick = (k: string[], t: number) => {const i = Math.min(1, Math.floor(t)), u = Math.min(1, t - i); return col(k[i]).lerp(col(k[i + 1]), u);};
const pickN = (k: number[], t: number) => {const i = Math.min(1, Math.floor(t)), u = Math.min(1, t - i); return k[i] + (k[i + 1] - k[i]) * u;};

export function build(canvas: HTMLCanvasElement, spec: Spec, W: number, H: number, opts: Opts = {}) {
  seed = 11;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, W / H, .5, 4000);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;  // car paint and coins reflect a studio
  scene.environmentIntensity = .8;
  scene.fog = new THREE.Fog('#c4e4ff', 90, 560);
  const hemi = new THREE.HemisphereLight('#e4f1ff', '#56753a', 1.5), sun = new THREE.DirectionalLight('#fff4d6', 2.4);
  scene.add(hemi, sun, sun.target);

  /* sky dome, mountains, clouds, far city: all ride along with the camera (x, z) so they stay at the horizon */
  const far = new THREE.Group(); scene.add(far);
  const skyU = {top: {value: col('#2a6fd6')}, hor: {value: col('#c4e4ff')}, sunCol: {value: col('#fff4d6')}, sunDir: {value: new THREE.Vector3(.4, .5, -1).normalize()}};
  far.add(new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), new THREE.ShaderMaterial({uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.6)) : hor;
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (smoothstep(0.9994, 0.9997, s) * 2.0 + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`})));
  const mtnMats = [lam('#7896bd', {fog: false}), lam('#7896bd', {fog: false})];
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2 + ring * .07, r = 900 + ring * 260, h = 70 + rnd() * 150 + ring * 60;
    const m = new THREE.Mesh(new THREE.ConeGeometry(90 + rnd() * 120, h, 5 + Math.floor(rnd() * 3)), mtnMats[ring]);
    m.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r); m.rotation.y = rnd() * 3; far.add(m);
  }
  const cityMat = new THREE.MeshLambertMaterial({color: '#8fa6c4', fog: false, emissive: '#ffffff', emissiveIntensity: 0,
    emissiveMap: tex(64, 128, c => {c.fillStyle = '#000'; c.fillRect(0, 0, 64, 128); for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (rnd() < .45) {c.fillStyle = rnd() < .8 ? '#ffd9a0' : '#9fd8ff'; c.fillRect(x, y, 4, 4);}}, [1, 1])});
  for (let i = 0; i < 70; i++) {  // a skyline ahead and to the right
    const h = 25 + rnd() * rnd() * 170, w = 14 + rnd() * 26;
    const b = box(w, h, w, cityMat, 420 + rnd() * 520, h / 2 - 2, -700 - rnd() * 500); far.add(b);
  }
  const cloudMat = lam('#ffffff', {fog: false, flatShading: true, emissive: '#ffffff', emissiveIntensity: .45});
  for (let i = 0; i < 26; i++) {
    const cl = new THREE.Group(), a = -Math.PI / 2 + (rnd() - .5) * 2.4, r = 700 + rnd() * 700;
    for (let k = 0; k < 5; k++) {const s = new THREE.Mesh(new THREE.IcosahedronGeometry(20 + rnd() * 26, 1), cloudMat); s.position.set(k * 30 - 60 + rnd() * 10, rnd() * 12, rnd() * 20); s.scale.y = .55; cl.add(s);}
    cl.position.set(Math.cos(a) * r, 140 + rnd() * 160, Math.sin(a) * r); cl.rotation.y = rnd() * 3; far.add(cl);
  }

  /* the ground, the road, kerbs, rails */
  const z0 = 150, L = LEN;
  const plane = (w: number, l: number, m: THREE.Material, x: number, y: number) => {const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z0 - l / 2); scene.add(p); return p;};
  plane(1400, L, lam('#ffffff', {map: grassTex()}), 0, -.06);
  plane(14, L, lam('#ffffff', {map: roadTex()}), 0, 0);
  for (const s of [-1, 1]) {plane(.55, L, lam('#ffffff', {map: kerbTex()}), s * 7.275, .03); plane(1.2, L, lam('#8f8a78'), s * 8.15, .015);}
  const RAILM = std('#cfd5dc', {metalness: .7, roughness: .35});
  for (const s of [-1, 1]) {const r = box(.1, .34, L, RAILM, s * RAIL, .62, z0 - L / 2); scene.add(r);}
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, n: number, place: (i: number, o: THREE.Object3D) => void, color?: (i: number) => string) => {
    const im = new THREE.InstancedMesh(geo, m, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(i, o); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (color) im.setColorAt(i, col(color(i)));}
    im.frustumCulled = false; scene.add(im); return im;
  };
  const NP = Math.floor(L / 4);
  inst(new THREE.BoxGeometry(.14, .8, .14), RAILM, NP * 2, (i, o) => o.position.set((i % 2 ? 1 : -1) * RAIL, .4, z0 - Math.floor(i / 2) * 4));

  /* lamps: pole, arm, head, and a pool of light on the road that shows at dusk */
  const NL = Math.floor(L / 50), lampHead = new THREE.MeshBasicMaterial({color: '#ffe8b8'});
  const lampPos = (i: number): [number, number] => [(i % 2 ? 1 : -1) * 9.4, z0 - 20 - Math.floor(i / 2) * 50 - (i % 2) * 25];
  inst(new THREE.CylinderGeometry(.12, .17, 9.4, 8), lam('#7d838c'), NL * 2, (i, o) => {const [x, z] = lampPos(i); o.position.set(x, 4.7, z);});
  inst(new THREE.BoxGeometry(2.8, .14, .14), lam('#7d838c'), NL * 2, (i, o) => {const [x, z] = lampPos(i); o.position.set(x - Math.sign(x) * 1.3, 9.3, z);});
  inst(new THREE.BoxGeometry(1.1, .16, .42), lampHead, NL * 2, (i, o) => {const [x, z] = lampPos(i); o.position.set(x - Math.sign(x) * 2.5, 9.18, z);});
  const poolMat = new THREE.MeshBasicMaterial({map: radial('rgba(255,214,150,1)', 'rgba(255,214,150,0)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  inst(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), poolMat, NL * 2, (i, o) => {const [x, z] = lampPos(i); o.position.set(x - Math.sign(x) * 2.6, .03, z);});
  const glowMat = new THREE.SpriteMaterial({map: radial('rgba(255,225,170,1)', 'rgba(255,200,140,0)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  const glows: THREE.Sprite[] = [];
  for (let i = 0; i < NL * 2; i++) {const [x, z] = lampPos(i); const s = new THREE.Sprite(glowMat); s.position.set(x - Math.sign(x) * 2.5, 9.0, z); s.scale.set(3.4, 3.4, 1); scene.add(s); glows.push(s);}

  /* trees: pines and round trees, never inside the rails */
  const NT = Math.floor(L / 5.5);
  const treeAt = [...Array(NT)].map(() => {const s = rnd() < .5 ? -1 : 1; return {x: s * (12 + Math.pow(rnd(), 1.6) * 70), z: z0 - rnd() * L, k: .8 + rnd() * .9, pine: rnd() < .55, c: rnd()};});
  const pines = treeAt.filter(t => t.pine), rounds = treeAt.filter(t => !t.pine);
  const GREENS = ['#2f7a3a', '#3b8c3f', '#2a6b40', '#4a9a44'], LEAF = ['#58a83f', '#6cb84a', '#4d9a3a', '#7cc255'];
  inst(new THREE.CylinderGeometry(.22, .3, 1.8, 6), lam('#6b4a32'), treeAt.length, (i, o) => {const t = treeAt[i]; o.position.set(t.x, .9 * t.k, t.z); o.scale.setScalar(t.k);});
  inst(new THREE.ConeGeometry(1.9, 3.4, 7), lam('#ffffff', {flatShading: true}), pines.length, (i, o) => {const t = pines[i]; o.position.set(t.x, 2.9 * t.k, t.z); o.scale.setScalar(t.k); o.rotation.y = t.c * 6;}, i => GREENS[Math.floor(pines[i].c * 4)]);
  inst(new THREE.ConeGeometry(1.35, 2.7, 7), lam('#ffffff', {flatShading: true}), pines.length, (i, o) => {const t = pines[i]; o.position.set(t.x, 4.6 * t.k, t.z); o.scale.setScalar(t.k); o.rotation.y = t.c * 9;}, i => GREENS[Math.floor(pines[i].c * 4)]);
  inst(new THREE.IcosahedronGeometry(2.1, 0), lam('#ffffff', {flatShading: true}), rounds.length, (i, o) => {const t = rounds[i]; o.position.set(t.x, 3.2 * t.k, t.z); o.scale.set(t.k, t.k * .9, t.k); o.rotation.y = t.c * 5;}, i => LEAF[Math.floor(rounds[i].c * 4)]);

  /* billboards */
  for (const b of spec.boards) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) g.add(box(.35, 6.5, .35, lam('#6f757e'), s * 3.4, 3.25, 0));
    g.add(box(10.6, 5.3, .3, lam('#30343c'), 0, 7.4, -.2));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 4.9), new THREE.MeshBasicMaterial({map: tex(1024, 492, c => {
      c.fillStyle = b.bg; c.fillRect(0, 0, 1024, 492); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(900, 80, 260, 0, 7); c.fill();
      c.fillStyle = b.fg; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, b.lines[0], 512, 190, 150, 940); fitText(c, b.lines[1], 512, 350, 84, 900);})}));
    face.position.set(0, 7.4, -.04); g.add(face);
    g.position.set(b.side * 17, 0, -b.d); g.rotation.y = -b.side * .42; scene.add(g);
  }

  /* gantries */
  const signs: THREE.MeshBasicMaterial[] = [];
  const gates = spec.gates.map(gt => {const g = gantry(gt, signs); scene.add(g); return g;});
  const startLamps: THREE.MeshBasicMaterial[] = [];
  spec.gates.forEach((gt, i) => {
    if (gt.kind === 'start') for (const x of [-LANE, 0, LANE]) {
      const housing = box(1.3, 1.3, .5, lam('#15161a'), x, 4.9, .1); gates[i].add(housing);
      const m = new THREE.MeshBasicMaterial({color: '#3a0d0d'}); startLamps.push(m);
      const c = new THREE.Mesh(new THREE.CircleGeometry(.46, 24), m); c.position.set(x, 4.9, .37); gates[i].add(c);
    }
    if (gt.kind === 'finish' || gt.kind === 'start') {const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshLambertMaterial({map: checker(20, 2, 640, 64)})); s.rotation.x = -Math.PI / 2; s.position.set(0, .02, 0); gates[i].add(s);}
  });
  /* the game's lane gates: only built for gates with lanes, so the video's world is untouched */
  const anyLanes = spec.gates.some(gt => gt.lanes);
  const chevron = anyLanes ? tex(128, 256, c => {c.fillStyle = '#fff'; for (const y of [30, 150]) {c.beginPath(); c.moveTo(14, y + 80); c.lineTo(64, y); c.lineTo(114, y + 80); c.lineTo(114, y + 104); c.lineTo(64, y + 34); c.lineTo(14, y + 104); c.fill();}}, [1, 5]) : null;
  const stripes = anyLanes ? tex(256, 96, c => {for (let i = -2; i < 12; i++) {c.fillStyle = i % 2 ? '#f7f4ee' : '#e8352e'; c.beginPath(); c.moveTo(i * 28, 96); c.lineTo(i * 28 + 28, 96); c.lineTo(i * 28 + 60, 0); c.lineTo(i * 28 + 32, 0); c.fill();}}) : null;
  const laneFx = spec.gates.map((gt, i) => {
    if (!gt.lanes) return null;
    const lights: THREE.MeshBasicMaterial[] = [], walls: THREE.Object3D[] = [];
    [-LANE, 0, LANE].forEach((x, j) => {
      const label = gt.lanes![j];
      if (label) {const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.1, .92), new THREE.MeshBasicMaterial({map: tex(512, 152, c => {
        c.fillStyle = '#10213a'; rrect(c, 0, 0, 512, 152, 22); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 8; rrect(c, 8, 8, 496, 136, 16); c.stroke();
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, label, 256, 80, 84, 460);})}));
        sg.position.set(x, 5.3, .26); gates[i].add(sg);}
      const lm = new THREE.MeshBasicMaterial({map: chevron!, color: '#ffd23f', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 30), lm); pad.rotation.x = -Math.PI / 2; pad.position.set(x, .05, -(gt.d - 17)); scene.add(pad); lights.push(lm);
      const w = new THREE.Group();
      w.add(box(3.1, 1.0, .45, new THREE.MeshLambertMaterial({map: stripes!}), 0, .75, 0));
      for (const s of [-1, 1]) w.add(box(.16, .3, .3, lam('#30343c'), s * 1.2, .15, 0));
      w.position.set(x, 0, -(gt.d + 3)); w.visible = false; scene.add(w); walls.push(w);
    });
    return {lights, walls};
  });

  /* cars */
  const player = car(opts.player ?? {paint: '#e3663e', plate: 'OPUS 5.5'}); scene.add(player.g);
  const ghostMat = new THREE.MeshBasicMaterial({color: '#8fd3ff', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending});
  const ghost = sportsCar('#8fd3ff', 'OPUS 5', ghostMat); scene.add(ghost.g);
  const shadowTex = radial('rgba(0,0,0,.62)', 'rgba(0,0,0,0)');
  const shadow = (w: number, l: number) => {const s = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false})); s.rotation.x = -Math.PI / 2; s.position.y = .03; return s;};
  player.g.add(shadow(3.0, 6.0));
  const traffic = spec.traffic.map(t => {const c = trafficCar(t.kind, t.color); const L = t.kind === 'truck' || t.kind === 'bus' ? 13 : 6.2; c.g.add(shadow(3.2, L)); scene.add(c.g); return c;});
  const beamHead = new THREE.MeshBasicMaterial({color: '#fff3b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const headPool = new THREE.Mesh(new THREE.PlaneGeometry(6, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: radial('rgba(255,244,210,1)', 'rgba(255,244,210,0)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
  headPool.position.set(0, .04, -10); player.g.add(headPool);
  const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: radial('rgba(120,200,255,1)', 'rgba(60,140,255,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}));
  flameGlow.position.set(0, .45, 3.0); flameGlow.scale.set(3.4, 1.6, 1); player.g.add(flameGlow);

  /* coins */
  const COIN = std('#ffc933', {metalness: 1, roughness: .22, emissive: '#6a4800', emissiveIntensity: .5});
  const coinGeo = new THREE.CylinderGeometry(.44, .44, .1, 28).rotateX(Math.PI / 2);
  const coins = new THREE.InstancedMesh(coinGeo, COIN, Math.max(1, spec.coins)); coins.frustumCulled = false; scene.add(coins);

  /* the model: a blimp that flies ahead of the car; every checkpoint sends a beam up to it */
  const blimp = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), std('#f3f1ec', {roughness: .5, clearcoat: .4})); hull.scale.set(2.6, 2.6, 9.5); blimp.add(hull);
  const bandC = opts.blimp?.band ?? '#e3663e';
  const band = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI * .44, Math.PI * .12).rotateX(Math.PI / 2), std(bandC)); band.scale.set(2.62, 2.62, 9.55); blimp.add(band);
  for (const [rx, rz] of [[0, 0], [0, Math.PI / 2], [0, Math.PI], [0, -Math.PI / 2]]) {const fin = box(.12, 2.4, 2.6, std(bandC), 0, 2.2, 7.6); const p = new THREE.Group(); p.add(fin); p.rotation.set(rx, 0, rz); blimp.add(p);}
  blimp.add(box(1.1, .8, 3.4, std('#2b2f38'), 0, -2.75, -.5));
  const blimpLabel = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.7), new THREE.MeshBasicMaterial({transparent: true, map: tex(1024, 216, c => {
    c.fillStyle = '#1b2440'; rrect(c, 0, 0, 1024, 216, 60); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, opts.blimp?.label ?? 'OPUS 5.5 · THE MODEL', 512, 112, 120, 940);})}));
  blimpLabel.position.set(2.72, .2, 0);  // in front of the orange band (radius 2.62) blimpLabel.rotation.y = Math.PI / 2; blimp.add(blimpLabel);
  blimp.rotation.y = -Math.PI / 2;  // side-on to the camera, nose to the right
  const blink = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshBasicMaterial({color: '#ff3b3b'})); blink.position.set(0, -3.2, -.5); blimp.add(blink);
  scene.add(blimp);
  const beams = [...Array(6)].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1, 10, 1, true), new THREE.MeshBasicMaterial({color: '#7fe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
    const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 14, 10), beamHead.clone());
    scene.add(m, head); return {m, head};
  });
  /* the game's rivals: see-through cars in their own colours, each in its own universe (no collisions) */
  const rivals = (opts.ghosts ?? []).map(l => {
    const mat = new THREE.MeshBasicMaterial({color: l.paint, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending});
    const c = car(l, mat); scene.add(c.g); return {c, mat};
  });
  /* the game's pit stop: a tyre for each of the crew. Only built with opts.crew, so the video's world is untouched */
  const crew = opts.crew ? CREW.map(() => {const tyre = wheel(.37, .3); scene.add(tyre); return tyre;}) : [];

  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), o = new THREE.Object3D();
  function render(s: State) {
    const t = s.tod;
    /* light and air */
    const hor = pick(KEY.hor, t), top = pick(KEY.top, t), sunC = pick(KEY.sun, t);
    skyU.top.value.copy(top); skyU.hor.value.copy(hor); skyU.sunCol.value.copy(sunC);
    const el = pickN([.55, .13, .025], t);
    skyU.sunDir.value.set(.55, el, -1).normalize();
    (scene.fog as THREE.Fog).color.copy(hor); (scene.fog as THREE.Fog).far = pickN([560, 600, 480], t);
    hemi.color.copy(pick(KEY.hemiS, t)); hemi.groundColor.copy(pick(KEY.hemiG, t)); hemi.intensity = pickN([1.5, 1.25, .95], t);
    sun.color.copy(sunC); sun.intensity = pickN([2.4, 2.1, .7], t);
    mtnMats[0].color.copy(pick(KEY.mtn, t).lerp(hor, .4)); mtnMats[1].color.copy(pick(KEY.mtn, t).lerp(hor, .62));
    cloudMat.color.copy(pick(KEY.cloud, t)); cloudMat.emissive.copy(pick(KEY.cloud, t)); cloudMat.emissiveIntensity = pickN([.45, .4, .25], t); cityMat.color.copy(pick(KEY.city, t).lerp(hor, .3));
    const night = Math.max(0, t - 1);
    cityMat.emissiveIntensity = night * .9; poolMat.opacity = night * .55; glowMat.opacity = night * .9;
    lampHead.color.set(night > .3 ? '#fff0c8' : '#d9dde2');
    (headPool.material as THREE.MeshBasicMaterial).opacity = night * .5;
    TAIL.color.setScalar(1).set('#ff2a2a').multiplyScalar(1 + night * 1.2);

    /* camera */
    camera.position.set(...s.cam.pos); camera.lookAt(...s.cam.look); camera.rotateZ(s.cam.roll);
    if (camera.fov !== s.cam.fov) {camera.fov = s.cam.fov; camera.updateProjectionMatrix();}
    far.position.set(s.cam.pos[0], 0, s.cam.pos[2]);
    sun.position.set(s.cam.pos[0] + 60, 120, s.cam.pos[2] - 60); sun.target.position.set(s.cam.pos[0], 0, s.cam.pos[2] - 80);

    /* the player */
    const c = s.car;
    player.g.position.set(c.x, c.bob, -c.d); player.g.rotation.set(0, c.yaw, c.roll);
    player.wheels.forEach(w => w.rotation.x = -c.d / .37);
    player.flames!.forEach((fl, k) => {fl.visible = c.nitro > .02; const n = .75 + .25 * Math.sin(s.f * 2.1 + k * 1.7) + .15 * Math.sin(s.f * 5.3); fl.scale.set(c.nitro * (1 + .25 * n), c.nitro * (1 + .25 * n), c.nitro * (.45 + .4 * n));});
    flameGlow.material.opacity = c.nitro * .9;
    ghost.g.visible = s.ghost.o > .01; ghostMat.opacity = .38 * s.ghost.o;
    ghost.g.position.set(s.ghost.x, 0, -s.ghost.d); ghost.wheels.forEach(w => w.rotation.x = -s.ghost.d / .37);
    rivals.forEach(({c: rc, mat}, i) => {const p = s.ghosts?.[i]; rc.g.visible = !!p && p.o > .01; if (!p) return;
      mat.opacity = .4 * p.o; rc.g.position.set(p.x, 0, -p.d); rc.wheels.forEach(w => w.rotation.x = -p.d / .4);});
    traffic.forEach((tc, i) => {const p = s.traffic[i]; tc.g.visible = Math.abs(p.d - c.d) < 700; tc.g.position.set(p.x, 0, -p.d); tc.wheels.forEach(w => w.rotation.x = -p.d / .4);});

    /* coins */
    s.coins.forEach((k, i) => {o.position.set(k.x, k.y, -k.d); o.rotation.set(0, k.spin, 0); o.scale.setScalar(k.s); o.updateMatrix(); coins.setMatrixAt(i, o.matrix);});
    coins.instanceMatrix.needsUpdate = true;

    /* gantries */
    s.gates.forEach((gs, i) => {const g = gates[i]; g.visible = gs.s > .01; g.scale.setScalar(Math.max(.001, gs.s)); g.rotation.y = gs.spin || 0; signs[i].color.setScalar(1 + gs.flash * .9);});
    startLamps.forEach((m, i) => m.color.set(s.lamps >= 4 ? '#35ff7a' : s.lamps > i ? '#ff2a2a' : '#3a0d0d'));
    laneFx.forEach((fx, i) => {if (!fx) return; const st = s.lanes?.[i];
      for (let j = 0; j < 3; j++) {
        fx.lights[j].opacity = st ? st.light[j] : 0; if (st) fx.lights[j].color.set(st.col[j]);
        const w = st ? st.wall[j] : 0; fx.walls[j].visible = w > .01; fx.walls[j].scale.set(1, Math.max(.001, w), 1);
      }});
    crew.forEach((tyre, i) => {
      const p = s.pit, w = p && crewAt(p, i); tyre.visible = !!w && w.work; if (!p || !w) return;
      tyre.position.set(p.x + w.sx * (.95 + .7 * w.off), .37 + .3 * w.off, w.pos[2]); tyre.rotation.x = w.off * 3;
    });

    /* the blimp and the beams */
    blimp.position.set(...s.blimp); blink.visible = Math.floor(s.f / 12) % 2 === 0;
    beams.forEach(b => {b.m.visible = b.head.visible = false;});
    for (const [k, bm] of s.beams.slice(0, beams.length).entries()) {
      const b = beams[k], from = new THREE.Vector3(...bm.from), to = new THREE.Vector3(s.blimp[0], s.blimp[1] - 2.6, s.blimp[2]);
      const grow = Math.min(1, bm.p * 2.2), fade = 1 - Math.max(0, (bm.p - .55) / .45);
      const end = from.clone().lerp(to, grow);
      tmp.subVectors(end, from); const len = tmp.length();
      if (len < .01) continue;
      b.m.visible = b.head.visible = true;
      b.m.position.copy(from).addScaledVector(tmp, .5); b.m.quaternion.setFromUnitVectors(up, tmp.clone().normalize()); b.m.scale.set(1, len, 1);
      (b.m.material as THREE.MeshBasicMaterial).opacity = .85 * fade;
      b.head.position.copy(end); (b.head.material as THREE.MeshBasicMaterial).opacity = fade;
    }
    renderer.render(scene, camera);
  }
  /** The game: draw every object once, hidden and out of view included, so no shader or texture is first met mid-race.
   *  Without it the countdown's camera swing stalled for about 0.7 s when the road ahead first came into view. */
  function warm() {
    const was: [THREE.Object3D, boolean, boolean][] = [];
    scene.traverse(ob => {was.push([ob, ob.visible, ob.frustumCulled]); ob.visible = true; ob.frustumCulled = false;});
    renderer.render(scene, camera);
    for (const [ob, v, f] of was) {ob.visible = v; ob.frustumCulled = f;}
  }
  return {render, camera, warm};
}
