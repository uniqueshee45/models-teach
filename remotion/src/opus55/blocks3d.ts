/**
 * Universe three's world: a voxel block world in plain three.js (see memory three-inside-remotion).
 * build() makes the ground, trees, lake, clouds and sky ONCE; render(state) places everything that moves.
 * One block = one unit. Block (i, j, k) fills [i, i+1] × [j, j+1] × [k, k+1]; the plateau's top is y = 0.
 * Every texture is a 16×16 canvas drawn here and filtered NEAREST, so each texel stays a hard square.
 * Meb is his own 40×40 rig grid, every cell a small cube (an extruded sprite, the way block games draw items).
 */
import * as THREE from 'three';
import {G, PAL} from '../meb-hatch/rig';
import type {Grid} from '../meb-hatch/rig';

export type V3 = [number, number, number];
export const KINDS = ['p5', 'p55', 'gold', 'fable', 'job', 'old', 'new', 'glass'] as const;
export type Kind = typeof KINDS[number];
/** A block that moves: p = its centre; s = scale; ry / rx = turn; crack 0..1 = how far it is dug. */
export type Blk = {k: Kind; p: V3; s?: number; ry?: number; rx?: number; crack?: number};
export type Bit = {p: V3; s: number; c: string};
export type Sign = {p: V3; lines: [string, string]; color?: string};
export type State = {
  f: number;
  cam: {pos: V3; look: V3; fov: number};
  sun: number;          // time of day in turns: 0 sunrise (east, +x), .25 noon, .5 sunset, .75 midnight
  blocks: Blk[];
  bits: Bit[];
  meb: {p: V3; yaw: number; grid: Grid} | null;   // p = the point between his feet
  signs: number[];      // each sign's scale, 0 = gone
};
export const CELL = .056, DEPTH = 6;  // Meb: one grid cell, and how many cells deep he is extruded

/* ---------- seeded helpers ---------- */
let seed = 3;
const rnd = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
const h2 = (x: number, z: number) => {const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s);};
const vnoise = (x: number, z: number) => {
  const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
};
const fbm = (x: number, z: number) => vnoise(x / 23, z / 23) * .6 + vnoise(x / 11, z / 11) * .28 + vnoise(x / 5, z / 5) * .12;
const col = (c: string) => new THREE.Color(c);

/* ---------- 16×16 textures ---------- */
type Paint = (set: (x: number, y: number, c: string) => void) => void;
const tex16 = (paint: Paint) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const c = cv.getContext('2d')!;
  paint((x, y, s) => {c.clearRect(x, y, 1, 1); c.fillStyle = s; c.fillRect(x, y, 1, 1);});
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.anisotropy = 8;
  return t;
};
const pickc = (cs: string[]) => cs[Math.floor(rnd() * cs.length)];
const noisy = (cs: string[]): Paint => set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, pickc(cs));};
const GRASS = ['#5d9c43', '#6aa84f', '#79b85a', '#548f3c', '#6aa84f'], DIRT = ['#86603e', '#7a5534', '#946b47', '#6d4b2e'];
const STONE = ['#8a8a8a', '#7f7f7f', '#959595', '#777777', '#8a8a8a'];
const T_GRASS = tex16(noisy(GRASS)), T_DIRT = tex16(noisy(DIRT)), T_STONE = tex16(noisy(STONE));
const T_SIDE = tex16(set => {noisy(DIRT)(set); for (let x = 0; x < 16; x++) {const d = 2 + Math.floor(rnd() * 3); for (let y = 0; y < d; y++) set(x, y, pickc(GRASS));}});
const T_SAND = tex16(noisy(['#dbcf8e', '#d4c783', '#e3d899', '#cbbd78']));
const T_SNOW = tex16(noisy(['#f4f8fb', '#e9eff5', '#ffffff']));
const T_SNOWSIDE = tex16(set => {noisy(STONE)(set); for (let x = 0; x < 16; x++) {const d = 3 + Math.floor(rnd() * 3); for (let y = 0; y < d; y++) set(x, y, pickc(['#f4f8fb', '#e9eff5']));}});
const T_LOG = tex16(set => {for (let x = 0; x < 16; x++) {const b = x % 4 === 0 ? '#4d3620' : x % 2 ? '#6b4f2f' : '#5d4428'; for (let y = 0; y < 16; y++) set(x, y, rnd() < .12 ? '#4a331e' : b);}});
const T_LOGTOP = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  set(x, y, r > 6.5 ? '#5d4428' : Math.floor(r) % 2 ? '#b08b57' : '#9c7746');}});
const T_LEAVES = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, rnd() < .1 ? '#1f5418' : pickc(['#3f8a2f', '#4b9a37', '#35782a', '#2d6a24']));});
const T_PLANKS = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const seam = y % 4 === 3 || (x === ((Math.floor(y / 4) * 7) % 16) );
  set(x, y, seam ? '#7d5c33' : rnd() < .15 ? '#a07a45' : '#b58b52');}});
const cobble = (moss: boolean): Paint => set => {
  const S = [...Array(8)].map(() => [rnd() * 16, rnd() * 16, rnd()]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ds = S.map(([sx, sy, k]) => {let dx = Math.abs(x + .5 - sx), dy = Math.abs(y + .5 - sy); dx = Math.min(dx, 16 - dx); dy = Math.min(dy, 16 - dy); return [Math.hypot(dx, dy), k];}).sort((a, b) => a[0] - b[0]);
    const edge = ds[1][0] - ds[0][0] < 1.1;
    const g = ['#9a9a9a', '#8a8a8a', '#7b7b7b', '#a6a6a6'][Math.floor(ds[0][1] * 4)];
    set(x, y, edge ? '#4f4f4f' : moss && vnoise(x / 3 + 9, y / 3) > .58 ? pickc(['#4f7d34', '#5c8c3c']) : rnd() < .12 ? '#6e6e6e' : g);
  }
};
const T_OLD = tex16(cobble(true));
const T_NEW = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const e = x === 0 || y === 0, e2 = x === 15 || y === 15, inner = (x === 3 || x === 12) && y > 2 && y < 13 || (y === 3 || y === 12) && x > 2 && x < 13;
  set(x, y, e ? '#ffffff' : e2 ? '#8fc9d4' : inner ? '#9ee3e0' : rnd() < .1 ? '#e2f4f6' : '#eefafb');}});
/** A solid colour with a 1-texel bevel and a little grain: the score blocks. */
const bevel = (base: string, hi: string, lo: string, grain: string) => tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
  set(x, y, x === 0 || y === 0 ? hi : x === 15 || y === 15 ? lo : rnd() < .14 ? grain : base);});
const T_P5 = bevel('#8fa6c4', '#b9cbe2', '#6a7f9c', '#86a0bf'), T_P55 = bevel('#e3663e', '#ff9a74', '#b04a2a', '#d95d36');
const T_FABLE = bevel('#9a7cf0', '#c4b2ff', '#6f55c4', '#9072e6');
const T_GOLD = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const e = x === 0 || y === 0, e2 = x === 15 || y === 15, shine = (x + y === 5 || x + y === 6) && x > 1 && y > 1 || (x + y === 20 && x > 8);
  set(x, y, e ? '#fff39a' : e2 ? '#c98f10' : shine ? '#fffbe0' : rnd() < .15 ? '#f0c52c' : '#f7d33a');}});
const T_GLASS = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const e = x === 0 || y === 0 || x === 15 || y === 15, streak = (x - y === 4 || x - y === 5) && x > 5 && x < 11;
  set(x, y, e ? 'rgba(235,248,255,.85)' : streak ? 'rgba(255,255,255,.55)' : 'rgba(200,230,255,.07)');}});
const T_JOBF = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const frame = x < 2 || x > 13 || y < 2 || y > 13, rim = x === 2 || x === 13 || y === 2 || y === 13;
  const gx = x - 3, gy = y - 4, g = gy >= 0 && gy < 7 && gx >= 0 && gx < 10 && ['#.........', '.#........', '..#.......', '...#......', '..#.......', '.#........', '#...####..'][gy][gx] === '#';
  set(x, y, frame ? (x + y) % 5 === 0 ? '#4a505c' : '#3a3f4a' : rim ? '#151920' : g ? '#39ff88' : (y % 2 ? '#0b1310' : '#0e1813'));}});
const T_JOBS = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const e = x === 0 || y === 0 || x === 15 || y === 15, rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
  set(x, y, e ? '#252a33' : rivet ? '#9aa3b2' : y % 5 === 0 ? '#343944' : rnd() < .1 ? '#454b57' : '#3d434e');}});
const T_JOBT = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const e = x === 0 || y === 0 || x === 15 || y === 15, vent = x > 2 && x < 13 && y > 2 && y < 13 && y % 2 === 0;
  set(x, y, e ? '#252a33' : vent ? '#1c2027' : '#3d434e');}});
const T_WATER = tex16(set => {for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, rnd() < .15 ? 'rgba(120,170,255,.8)' : 'rgba(50,100,215,.72)');});
T_WATER.wrapS = T_WATER.wrapT = THREE.RepeatWrapping;
const crackTex = (n: number) => tex16(set => {
  // the same crack grows: a branching walk from the centre, n of 4 stages drawn
  seed = 91;
  const pts: [number, number][] = [];
  for (let b = 0; b < 6; b++) {let x = 8, y = 8; for (let k = 0; k < 9; k++) {x += Math.round(rnd() * 2 - 1); y += Math.round(rnd() * 2 - 1); pts.push([x, y]);}}
  pts.slice(0, Math.round(pts.length * n / 4)).forEach(([x, y]) => {if (x >= 0 && y >= 0 && x < 16 && y < 16) set(x, y, 'rgba(10,10,14,.75)');});
});

/* ---------- materials ---------- */
const lam = (map: THREE.Texture, o: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({map, ...o});
const faces = (side: THREE.Material, top: THREE.Material, bottom: THREE.Material, front = side) => [side, side, top, bottom, front, side];
const M = {
  grass: faces(lam(T_SIDE), lam(T_GRASS), lam(T_DIRT)), dirt: lam(T_DIRT), stone: lam(T_STONE), sand: lam(T_SAND),
  snow: faces(lam(T_SNOWSIDE), lam(T_SNOW), lam(T_STONE)), log: faces(lam(T_LOG), lam(T_LOGTOP), lam(T_LOGTOP)), leaves: lam(T_LEAVES),
};
const DYN: Record<Kind, THREE.Material | THREE.Material[]> = {
  p5: lam(T_P5), p55: lam(T_P55), fable: lam(T_FABLE), gold: lam(T_GOLD, {emissive: '#6a4a00', emissiveIntensity: .35}),
  job: faces(lam(T_JOBS), lam(T_JOBT), lam(T_JOBT), lam(T_JOBF, {emissive: '#ffffff', emissiveMap: T_JOBF, emissiveIntensity: .55})),
  old: lam(T_OLD), new: lam(T_NEW, {emissive: '#1a5a60', emissiveIntensity: .12}),
  glass: lam(T_GLASS, {transparent: true, depthWrite: false, side: THREE.DoubleSide}),
};
const CAP: Record<Kind, number> = {p5: 110, p55: 110, gold: 30, fable: 110, job: 24, old: 700, new: 700, glass: 320};

/* ---------- the land ---------- */
export const PLATEAU = {x0: -27, x1: 27, z0: -36, z1: 44};   // flat, top at y = 0; deep in front so the camera never flies through a tree
const N0 = -80, N1 = 80;
const LAKE: [number, number, number] = [44, 6, 13];
function heightAt(x: number, z: number) {
  const dx = Math.max(PLATEAU.x0 - x, 0, x - PLATEAU.x1), dz = Math.max(PLATEAU.z0 - z, 0, z - PLATEAU.z1), d = Math.hypot(dx, dz);
  const lake = Math.hypot(x - LAKE[0], z - LAKE[1]);
  if (lake < LAKE[2]) return lake < LAKE[2] - 3 ? -3 : -2;
  if (d <= 0) return -1;
  const rise = Math.min(1, d / 14), n = fbm(x + 200, z + 50);
  let h = -1 + Math.round(rise * (n * n * 30 + d * .12));
  if (lake < LAKE[2] + 4) h = Math.min(h, -1);
  return Math.min(h, 24);
}

export type Rig = ReturnType<typeof build>;
export function build(canvas: HTMLCanvasElement, W: number, H: number, signs: Sign[]) {
  seed = 3;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, W / H, .1, 900);
  scene.fog = new THREE.Fog('#b8d8ff', 45, 125);
  const hemi = new THREE.HemisphereLight('#dfefff', '#6b5a3a', 1.35), sun = new THREE.DirectionalLight('#fff4d6', 1.9);
  scene.add(hemi, sun, sun.target);
  const cube = new THREE.BoxGeometry(1, 1, 1);

  /* terrain: every column from its top down to where its lowest neighbour's side is exposed */
  const HS = new Map<string, number>(), key = (x: number, z: number) => `${x},${z}`;
  for (let x = N0; x < N1; x++) for (let z = N0; z < N1; z++) HS.set(key(x, z), heightAt(x, z));
  const hAt = (x: number, z: number) => HS.get(key(x, z)) ?? heightAt(x, z);
  const cells: Record<string, V3[]> = {grass: [], dirt: [], stone: [], sand: [], snow: [], log: [], leaves: []};
  for (let x = N0; x < N1; x++) for (let z = N0; z < N1; z++) {
    const h = hAt(x, z), low = Math.min(h, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => hAt(x + a, z + b) + 1));
    const nearLake = Math.hypot(x - LAKE[0], z - LAKE[1]) < LAKE[2] + 1.5;
    for (let j = low; j <= h; j++) {
      const d = h - j;
      const kind = nearLake && h <= -1 ? (d < 3 ? 'sand' : 'stone') : h >= 13 ? (d === 0 ? 'snow' : 'stone') : h >= 9 ? 'stone' : d === 0 ? 'grass' : d < 4 ? 'dirt' : 'stone';
      cells[kind].push([x, j, z]);
    }
  }
  /* trees: on the hills and a few along the plateau's edges */
  const leafSet = new Set<string>();
  for (let x = N0 + 2; x < N1 - 2; x++) for (let z = N0 + 2; z < N1 - 2; z++) {
    const h = hAt(x, z), onEdge = (x === PLATEAU.x0 + 1 || x === PLATEAU.x1 - 1) && h2(x, z * 3) < .22 && z > -30;
    const inPlateau = x > PLATEAU.x0 && x < PLATEAU.x1 && z > PLATEAU.z0 && z < PLATEAU.z1;
    if ((inPlateau && !onEdge) || h < -1 || h >= 9 || Math.hypot(x - LAKE[0], z - LAKE[1]) < LAKE[2] + 2) continue;
    if (!onEdge && h2(x * 1.7, z * 2.3) > .035) continue;
    const tall = 4 + Math.floor(h2(x, z) * 2), top = h + tall;
    for (let j = h + 1; j <= top; j++) cells.log.push([x, j, z]);
    for (let j = top - 2; j <= top + 1; j++) {
      const r = j >= top ? 1 : 2;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        if (Math.abs(a) === r && Math.abs(b) === r && (j === top + 1 || h2(x + a * 7, z + b * 5 + j) < .6)) continue;
        if (!a && !b && j <= top) continue;
        leafSet.add(key(x + a, z + b) + ',' + j);
      }
    }
  }
  leafSet.forEach(s => {const [x, z, j] = s.split(',').map(Number); cells.leaves.push([x, j, z]);});
  const o = new THREE.Object3D();
  for (const [kind, list] of Object.entries(cells)) {
    const im = new THREE.InstancedMesh(cube, (M as any)[kind], Math.max(1, list.length));
    list.forEach(([x, y, z], i) => {o.position.set(x + .5, y + .5, z + .5); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);});
    im.frustumCulled = false; scene.add(im);
  }
  /* the lake's surface, just under the plateau */
  const waterGeo = new THREE.PlaneGeometry(LAKE[2] * 2 + 4, LAKE[2] * 2 + 4).rotateX(-Math.PI / 2);
  T_WATER.repeat.set(LAKE[2] * 2 + 4, LAKE[2] * 2 + 4);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({map: T_WATER, transparent: true, depthWrite: false}));
  water.position.set(LAKE[0], -.14, LAKE[1]); scene.add(water);

  /* sky: a gradient dome, a square sun and moon, stars; flat blocky clouds */
  const skyU = {top: {value: col('#4f8ff7')}, hor: {value: col('#b8d8ff')}};
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; varying vec3 vD;
      void main(){ float h = normalize(vD).y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h * 1.8, 0.0, 1.0), 0.7)) : hor; gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`}));
  scene.add(dome);
  const disc = (c: string, s: number) => {const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({color: c, fog: false, transparent: true, depthWrite: false})); scene.add(m); return m;};
  const sunGlow = disc('#fff3b0', 90), sunDisc = disc('#fffbe6', 46), moon = disc('#dfe6f5', 34);
  (sunGlow.material as THREE.MeshBasicMaterial).opacity = .25;
  const starPos: number[] = [];
  for (let i = 0; i < 700; i++) {const u = rnd() * 2 - 1, a = rnd() * 6.283, r = 560; if (u < .05) continue; const s = Math.sqrt(1 - u * u); starPos.push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r);}
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0});
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
  const cloudMat = new THREE.MeshLambertMaterial({color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .55, transparent: true, opacity: .88, fog: false});
  const cl: V3[] = [];
  for (let i = -14; i < 14; i++) for (let k = -14; k < 14; k++) if (vnoise(i / 2.6 + 40, k / 2.6) > .6) cl.push([i * 12, 44, k * 12]);
  const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 3, 12), cloudMat, Math.max(1, cl.length));
  cl.forEach(([x, y, z], i) => {o.position.set(x, y, z); o.updateMatrix(); clouds.setMatrixAt(i, o.matrix);});
  clouds.frustumCulled = false; scene.add(clouds);

  /* signs: a plank board on a post, lettered on both sides */
  const signMeshes = signs.map(s => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.3, .16), lam(T_LOG)); post.position.y = .65; g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, .14), lam(T_PLANKS)); board.position.y = 1.85; g.add(board);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 224;
    const c = cv.getContext('2d')!; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = s.color || '#2a1c0c'; c.font = 'bold 92px Consolas, monospace'; c.fillText(s.lines[0], 256, 74);
    c.fillStyle = '#2a1c0c'; c.font = 'bold 58px Consolas, monospace'; c.fillText(s.lines[1], 256, 168);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.36), new THREE.MeshLambertMaterial({map: t, transparent: true}));
    face.position.set(0, 1.85, .075); g.add(face);
    g.position.set(...s.p); scene.add(g); return g;
  });

  /* the moving things */
  const dyn = Object.fromEntries(KINDS.map(k => {
    const im = new THREE.InstancedMesh(cube, DYN[k] as any, CAP[k]); im.count = 0; im.frustumCulled = false; scene.add(im); return [k, im];
  })) as unknown as Record<Kind, THREE.InstancedMesh>;
  const cracks = [1, 2, 3, 4].map(n => {const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({map: crackTex(n), transparent: true, depthWrite: false}), 8); im.count = 0; im.frustumCulled = false; scene.add(im); return im;});
  const bits = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({color: '#ffffff'}), 500); bits.count = 0; bits.frustumCulled = false; scene.add(bits);
  const mebMesh = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({color: '#ffffff'}), G * G); mebMesh.count = 0; mebMesh.frustumCulled = false; scene.add(mebMesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: .28, depthWrite: false}));
  scene.add(shadow);
  const mebPal = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, col(v)]));
  const tmpC = new THREE.Color();

  /* time of day */
  const DAY = {top: col('#4f8ff7'), hor: col('#b8d8ff')}, DUSK = {top: col('#4a5aa0'), hor: col('#ffab70')}, NIGHT = {top: col('#070b1e'), hor: col('#18223f')};
  function sky(t: number) {
    const a = t * Math.PI * 2, dir = new THREE.Vector3(Math.cos(a), Math.sin(a), -.3).normalize(), e = dir.y;
    const day = THREE.MathUtils.smoothstep(e, -.12, .3), dusk = Math.max(0, 1 - Math.abs(e) / .28) * .9;
    const top = NIGHT.top.clone().lerp(DAY.top, day).lerp(DUSK.top, dusk * .5), hor = NIGHT.hor.clone().lerp(DAY.hor, day).lerp(DUSK.hor, dusk);
    return {dir, day, dusk, top, hor};
  }

  function render(s: State) {
    const k = sky(s.sun), cp = new THREE.Vector3(...s.cam.pos);
    skyU.top.value.copy(k.top); skyU.hor.value.copy(k.hor);
    (scene.fog as THREE.Fog).color.copy(k.hor);
    renderer.setClearColor(k.hor);
    hemi.intensity = .45 + .95 * k.day; hemi.color.copy(col('#dfefff').lerp(col('#ffd2a8'), k.dusk * .6));
    sun.intensity = 2.0 * k.day; sun.color.copy(col('#fff4d6').lerp(col('#ffb36b'), k.dusk));
    // the light comes from over the camera's shoulder whatever the sun disc does: from behind, Meb's white went grey
    sun.position.copy(cp).addScaledVector(new THREE.Vector3(k.dir.x * .5, .85, .6).normalize(), 80); sun.target.position.copy(cp);
    dome.position.copy(cp); stars.position.copy(cp); starMat.opacity = (1 - k.day) * .9;
    const place = (m: THREE.Mesh, d: THREE.Vector3, r: number) => {m.position.copy(cp).addScaledVector(d, r); m.lookAt(cp);};
    place(sunGlow, k.dir, 520); place(sunDisc, k.dir, 510); place(moon, k.dir.clone().negate(), 510);
    (sunDisc.material as THREE.MeshBasicMaterial).color.copy(col('#fffbe6').lerp(col('#ffcf7a'), k.dusk));
    cloudMat.color.copy(col('#ffffff').lerp(col('#ffc9a0'), k.dusk * .7).multiplyScalar(.35 + .65 * k.day)); cloudMat.emissiveIntensity = .15 + .4 * k.day;
    clouds.position.x = (s.f * .04) % 12;
    T_WATER.offset.set(s.f * .004, s.f * .002);

    camera.position.copy(cp); camera.lookAt(...s.cam.look);
    if (camera.fov !== s.cam.fov) {camera.fov = s.cam.fov; camera.updateProjectionMatrix();}

    /* moving blocks */
    const n: Record<string, number> = {}, cn = [0, 0, 0, 0];
    for (const b of s.blocks) {
      const im = dyn[b.k], i = n[b.k] || 0;
      if (i >= CAP[b.k]) continue;
      o.position.set(...b.p); o.rotation.set(b.rx || 0, b.ry || 0, 0); o.scale.setScalar(Math.max(.001, b.s ?? 1)); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); n[b.k] = i + 1;
      if (b.crack && b.crack > 0) {const st = Math.min(3, Math.floor(b.crack * 4)); if (cn[st] < 8) cracks[st].setMatrixAt(cn[st]++, o.matrix);}
    }
    for (const kk of KINDS) {dyn[kk].count = n[kk] || 0; dyn[kk].instanceMatrix.needsUpdate = true;}
    cracks.forEach((c, i) => {c.count = cn[i]; c.instanceMatrix.needsUpdate = true;});
    bits.count = Math.min(500, s.bits.length);
    s.bits.slice(0, 500).forEach((b, i) => {o.position.set(...b.p); o.rotation.set(0, 0, 0); o.scale.setScalar(b.s); o.updateMatrix(); bits.setMatrixAt(i, o.matrix); bits.setColorAt(i, tmpC.set(b.c));});
    bits.instanceMatrix.needsUpdate = true; if (bits.instanceColor) bits.instanceColor.needsUpdate = true;

    /* Meb: every filled cell of his grid, extruded */
    mebMesh.count = 0; shadow.visible = false;
    if (s.meb) {
      const {p, yaw, grid} = s.meb;
      let bottom = 0; grid.forEach((row, j) => {if (row.some(Boolean)) bottom = j;});
      const base = new THREE.Object3D(); base.position.set(...p); base.rotation.y = yaw; base.updateMatrix();
      let i = 0;
      grid.forEach((row, j) => row.forEach((c, x) => {
        if (!c || !mebPal[c]) return;
        const face = c === 'E' || c === 'P', d = face ? DEPTH + .6 : DEPTH;   // the face sits a hair proud, so it never z-fights
        o.position.set((x - G / 2 + .5) * CELL, (bottom - j + .5) * CELL, 0); o.rotation.set(0, 0, 0); o.scale.set(CELL, CELL, d * CELL); o.updateMatrix();
        o.matrix.premultiply(base.matrix); mebMesh.setMatrixAt(i, o.matrix); mebMesh.setColorAt(i, mebPal[c]); i++;
      }));
      mebMesh.count = i; mebMesh.instanceMatrix.needsUpdate = true; if (mebMesh.instanceColor) mebMesh.instanceColor.needsUpdate = true;
      shadow.visible = true; shadow.position.set(p[0], Math.floor(p[1] + .01) + .02, p[2]);
      (shadow.material as THREE.MeshBasicMaterial).opacity = .28 * Math.max(0, 1 - (p[1] - Math.floor(p[1] + .01)) / 2);
    }
    signMeshes.forEach((g, i) => {const v = s.signs[i] ?? 0; g.visible = v > .01; g.scale.setScalar(Math.max(.001, v));});
    renderer.render(scene, camera);
  }
  return {render, camera, heightAt: hAt};
}
