/** Shared by the long film (index.tsx) and the Short (short.tsx): palette, timing, chrome, and the pixel-pet rig. */
import React from 'react';
import {AbsoluteFill} from 'remotion';

export const BG = '#0d0b1c', INK = '#15131F', SUN = '#FFD44F', PINK = '#FFB8C6', GLOW = '#6EF2DC', VIOLET = '#8f7cff', RED = '#ff6b6b';
export const MONO = 'Consolas, "Cascadia Mono", monospace', HAND = '"Ink Free", "Segoe Script", cursive', BOLD = 'BVP';

/* ---------- timing ---------- */
export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const outC = (t: number) => 1 - Math.pow(1 - t, 3);
export const inC = (t: number) => t * t * t;
export const outBack = (t: number) => {const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);};
export const zoom = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));
export type Sc = {f: number; L: number[]; E: number[]; len: number};
/** Frame at fraction `p` of line k — a stand-in for word timing inside a line. */
export const at = (s: Sc, k: number, p = 0) => s.L[k] + p * (s.E[k] - s.L[k]);
export const Ink: React.FC<{o: number}> = ({o}) => o > 0 ? <AbsoluteFill style={{background: INK, opacity: o}}/> : null;

/* ---------- chrome ---------- */
export const Stage: React.FC<{children: React.ReactNode}> = ({children}) =>
  <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, #1d1842, ${BG} 70%)`}}>
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(#ffffff10 1px, transparent 1px)', backgroundSize: '28px 28px'}}/>
    {children}
  </AbsoluteFill>;
export const Tag: React.FC<{children: React.ReactNode}> = ({children}) =>
  <div style={{position: 'absolute', left: 40, top: 32, fontFamily: MONO, fontSize: 17, letterSpacing: '.22em',
    color: '#fff', opacity: .55, textTransform: 'uppercase'}}>{children}</div>;
/** Pops in at frame `at` and, if `until` is given, fades out there. */
export const Pop: React.FC<{f: number; at: number; until?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({f, at: a, until, style, children}) => {
  const t = seg(f, a, a + 14), p = outBack(t), o = clamp(t * 3) * (until === undefined ? 1 : 1 - seg(f, until - 6, until));
  if (o <= 0) return null;
  return <div style={{position: 'absolute', opacity: o, transform: `translateY(${(1 - p) * 40}px) scale(${lerp(.85, 1, p)})`, ...style}}>{children}</div>;
};
export const Big: React.FC<{size?: number; color?: string; children: React.ReactNode}> = ({size = 120, color = '#fff', children}) =>
  <div style={{fontFamily: BOLD, fontSize: size, lineHeight: 1.04, color, letterSpacing: '-.01em', whiteSpace: 'nowrap'}}>{children}</div>;
export const Mono: React.FC<{size?: number; color?: string; o?: number; children: React.ReactNode}> = ({size = 24, color = '#fff', o = .8, children}) =>
  <div style={{fontFamily: MONO, fontSize: size, color, opacity: o, whiteSpace: 'nowrap', letterSpacing: '.04em'}}>{children}</div>;
export const Strike: React.FC<{f: number; at: number; w: number}> = ({f, at: a, w}) =>
  <div style={{position: 'absolute', left: -10, top: '52%', height: 6, borderRadius: 3, background: RED, width: (w + 20) * outC(seg(f, a, a + 10))}}/>;

/* ---------- the pixel pet ---------- */
export type Grid = (string | null)[][];
export const G = 40;
export const PAL: Record<string, string> = {O: '#2A2540', W: '#FFFFFF', L: '#ECE9F3', S: '#C8C1D8', E: '#1A1826', P: PINK, Y: SUN, C: GLOW};
export const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, p = 2) => Math.abs((x - cx) / rx) ** p + Math.abs((y - cy) / ry) ** p <= 1;
export const inCap = (x: number, y: number, ax: number, ay: number, bx: number, by: number, r: number) => {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= r * r;
};
export type P2 = [number, number];
export const inTri = (x: number, y: number, [a, b, c]: P2[]) => {
  const s = (p: P2, q: P2, r: P2) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([x, y], a, b), d2 = s([x, y], b, c), d3 = s([x, y], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
export const rot = (p: P2, o: P2, deg: number): P2 => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = p[0] - o[0], dy = p[1] - o[1];
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c];
};
export type Face = 'neutral' | 'blink' | 'happy' | 'shocked' | 'sad' | 'side' | 'failed';
export type Pose = {face?: Face; ear?: number; armL?: number; armR?: number; lift?: number; sx?: number; sy?: number; hw?: number};
export const HW = 14.6;  // head half-width: the number the "wider head" beat changes
export const armCap = (s: number, a: number): [P2, P2] => {const sh: P2 = [20 + s * 7.6, 24.5]; return [sh, rot([20 + s * 9.2, 30.5], sh, -s * a)];};
export const earTri = (s: number, ear: number, k: number): P2[] =>
  ([[20 + s * 7 * k, 10], [20 + s * 12.6 * k, 1.6], [20 + s * 15.6 * k, 9]] as P2[]).map(p => rot(p, [20 + s * 11 * k, 8.5], s * ear));

/** Rasterizes Meb. Layers: 1 body+legs, 2 arms, 3 head+ears, 4 a raised arm. A pixel next to
 *  empty space or a higher layer becomes outline; a pixel at a part's bottom becomes shade. */
export function meb({face = 'neutral', ear = 0, armL = 0, armR = 0, lift = 0, sx = 1, sy = 1, hw = HW}: Pose = {}): Grid {
  const k = hw / HW;
  const layer = (xs: number, ys: number) => {
    const x = 20 + (xs - 20) / sx, y = 37.5 + (ys + lift - 37.5) / sy;
    for (const s of [-1, 1]) {const a = s < 0 ? armL : armR; if (a > 90) {const [p, q] = armCap(s, a); if (inCap(x, y, p[0], p[1], q[0], q[1], 1.7)) return 4;}}
    if (inEll(x, y, 20, 15, hw, 10.2, 2.6) || inTri(x, y, earTri(-1, ear, k)) || inTri(x, y, earTri(1, ear, k))) return 3;
    for (const s of [-1, 1]) {const [a, b] = armCap(s, s < 0 ? armL : armR); if (inCap(x, y, a[0], a[1], b[0], b[1], 1.7)) return 2;}
    if (inEll(x, y, 20, 29, 6.6 + Math.max(0, y - 26) * .28, 7.2) || inCap(x, y, 16.3, 33, 16.3, 35.6, 2.2) || inCap(x, y, 23.7, 33, 23.7, 35.6, 2.2)) return 1;
    return 0;
  };
  const Lr = [...Array(G)].map((_, j) => [...Array(G)].map((_, i) => layer(i + .5, j + .5)));
  const lay = (i: number, j: number) => i < 0 || j < 0 || i >= G || j >= G ? 0 : Lr[j][i];
  const px: Grid = [...Array(G)].map(() => Array(G).fill(null));
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const n = Lr[j][i], nb = [lay(i + 1, j), lay(i - 1, j), lay(i, j + 1), lay(i, j - 1)];
    if (!n) {if (nb.some(v => v)) px[j][i] = 'O'; continue;}
    if (nb.some(v => v > n)) {px[j][i] = 'O'; continue;}
    const b1 = lay(i, j + 1) !== n, b2 = lay(i, j + 2) !== n || lay(i, j + 3) !== n;
    px[j][i] = b1 ? 'S' : b2 && n !== 3 ? 'L' : (n === 3 && lay(i, j + 2) !== 3) ? 'L' : 'W';
  }
  const put = (i: number, j: number, c: string) => {
    const x0 = Math.round(20 + (i - 20) * sx), x1 = Math.max(x0 + 1, Math.round(20 + (i + 1 - 20) * sx));
    const y0 = Math.round(37.5 + (j - 37.5) * sy - lift), y1 = Math.max(y0 + 1, Math.round(37.5 + (j + 1 - 37.5) * sy - lift));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (px[y] && x >= 0 && x < G) px[y][x] = c;
  };
  const EYE = ['.EE.', 'EWEE', 'EEEE', 'EEEE', '.EE.'];
  const eo = Math.round((hw - HW) * .45);
  const eyes = (ox = 0) => {for (const [cx, d] of [[12 + ox, -eo], [26 + ox, eo]]) EYE.forEach((r, j) => [...r].forEach((c, i) => {if (c !== '.') put(Math.round(cx) + d - 2 + i, 12 + j, c);}));};
  const mouth = () => {for (let i = 18; i <= 21; i++) put(i, 19, 'E');};
  const smile = () => {put(18, 19, 'E'); put(19, 20, 'E'); put(20, 20, 'E'); put(21, 19, 'E');};
  const frown = () => {put(18, 20, 'E'); put(19, 19, 'E'); put(20, 19, 'E'); put(21, 20, 'E');};
  ({
    neutral: () => {eyes(); mouth();},
    blink: () => {for (const [cx, d] of [[12, -eo], [26, eo]]) for (let i = cx - 2; i <= cx + 1; i++) put(i + d, 15, 'E'); mouth();},
    happy: () => {for (const [cx, d] of [[12, -eo], [26, eo]]) {put(cx + d - 2, 15, 'E'); put(cx + d - 1, 14, 'E'); put(cx + d, 14, 'E'); put(cx + d + 1, 15, 'E');} smile();},
    shocked: () => {for (const cx of [12, 26]) for (const [a, b] of [[-1, 13], [0, 13], [-2, 14], [-1, 14], [0, 14], [1, 14], [-1, 15], [0, 15]]) put(cx + a, b, 'E'); put(19, 19, 'E'); put(20, 19, 'E'); put(19, 20, 'E'); put(20, 20, 'E');},
    sad: () => {eyes(); for (const a of [10, 24]) for (let i = a; i < a + 4; i++) put(i, 12, 'W'); put(10, 13, 'W'); put(27, 13, 'W'); frown();},
    side: () => {eyes(1.5); for (let i = 10; i <= 30; i++) put(i, 12, 'W'); for (let i = 19; i <= 22; i++) put(i, 19, 'E');},
    failed: () => {for (const cx of [12, 26]) for (const [a, b] of [[-2, 13], [1, 13], [-1, 14], [0, 14], [-1, 15], [0, 15], [-2, 16], [1, 16]]) put(cx + a, b, 'E'); frown();},
  } as Record<Face, () => void>)[face]();
  if (face !== 'failed') {put(8 - eo, 18, 'P'); put(9 - eo, 18, 'P'); put(30 + eo, 18, 'P'); put(31 + eo, 18, 'P');}
  return px;
}
export const Pixels: React.FC<{px: Grid; x: number; y: number; scale: number; rows?: number; flip?: boolean; style?: React.CSSProperties}> =
  ({px, x, y, scale, rows = G, flip, style}) => {
    const d: Record<string, string> = {};
    px.forEach((row, j) => {if (j >= rows) return; row.forEach((k, i) => {if (k) d[k] = (d[k] || '') + `M${i} ${j}h1v1h-1z`;});});
    return <svg viewBox={`0 0 ${G} ${G}`} width={G * scale} height={G * scale} shapeRendering="crispEdges"
      style={{position: 'absolute', left: x, top: y, overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style}}>
      {Object.entries(d).map(([k, p]) => <path key={k} d={p} fill={PAL[k]}/>)}
    </svg>;
  };
export const Shadow: React.FC<{x: number; y: number; scale: number; k?: number}> = ({x, y, scale, k = 1}) =>
  <div style={{position: 'absolute', left: x + 12 * scale + (1 - k) * 8 * scale, top: y + 37.6 * scale, width: 16 * scale * k,
    height: 1.4 * scale, borderRadius: '50%', background: 'rgba(0,0,0,.45)'}}/>;
export const eyeAt = (x: number, y: number, scale: number): [number, number] => [x + 12 * scale, y + 14.5 * scale];
export const blinkAt = (f: number, every = 75, phase = 0) => ((f + phase) % every) < 5;
/** Cyan outline of the rig's shapes, drawn on in order; d(i) is how undrawn shape i still is (1 → 0). */
export const Shapes: React.FC<{x: number; y: number; scale: number; d: (i: number) => number; o?: number; hw?: number}> = ({x, y, scale, d, o = 1, hw = HW}) => {
  const k = hw / HW, ear = (s: number) => earTri(s, 0, k).map(p => p.join(',')).join(' ');
  return <svg viewBox={`0 0 ${G} ${G}`} width={G * scale} height={G * scale} style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity: o}}>
    <g fill="none" stroke={GLOW} strokeWidth={.22} strokeLinecap="round">
      <ellipse cx={20} cy={15} rx={hw} ry={10.2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(0)}/>
      <polygon points={ear(-1)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(1)}/>
      <polygon points={ear(1)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(1)}/>
      <ellipse cx={20} cy={29} rx={7.2} ry={7.2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(2)}/>
      <path d="M12.4 24.5 L10.8 30.5 M27.6 24.5 L29.2 30.5" pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(3)}/>
      <path d="M16.3 33 V35.6 M23.7 33 V35.6" pathLength={1} strokeDasharray="1 1" strokeDashoffset={d(4)}/>
    </g></svg>;
};

/* ---------- the nine Codex states, as poses of one rig ---------- */
export type StateFn = (t: number) => {pose: Pose; dx?: number; dy?: number; flip?: boolean; tilt?: number};
export const STATES: [string, StateFn][] = [
  ['idle', t => ({pose: {face: blinkAt(t, 50) ? 'blink' : 'neutral', lift: Math.round(Math.sin(t / 8) * .6 + .4)}})],
  ['running-right', t => ({pose: {face: 'happy', armL: Math.sin(t / 3) * 30, armR: -Math.sin(t / 3) * 30, ear: -6}, dx: ((t * 3) % 260) - 90, dy: -Math.abs(Math.sin(t / 3)) * 14})],
  ['running-left', t => ({pose: {face: 'happy', armL: Math.sin(t / 3) * 30, armR: -Math.sin(t / 3) * 30, ear: -6}, dx: 170 - ((t * 3) % 260), dy: -Math.abs(Math.sin(t / 3)) * 14, flip: true})],
  ['waving', t => ({pose: {face: 'happy', ear: -6, armR: 125 + Math.sin(t / 4) * 22}})],
  ['jumping', t => {const c = (t % 40) / 40, air = c < .7 ? Math.sin(c / .7 * Math.PI) : 0, sq = c >= .7 ? Math.sin((c - .7) / .3 * Math.PI) * .16 : 0;
    return {pose: {face: 'happy', ear: air > .2 ? 12 : 0, armL: air * 40, armR: air * 40, sx: 1 + sq, sy: 1 - sq}, dy: -air * 80};}],
  ['failed', t => ({pose: {face: 'failed', ear: -60}, dx: Math.sin(t * 1.3) * (t % 45 < 12 ? 4 : 0)})],
  ['waiting', t => ({pose: {face: blinkAt(t, 40, 12) ? 'blink' : 'neutral', ear: Math.sin(t / 5) > .6 ? 12 : 0}, tilt: Math.sin(t / 14) * 5})],
  ['running', t => ({pose: {face: 'side', armL: 20 + Math.sin(t * .9) * 12, armR: 20 - Math.sin(t * .9) * 12, ear: 4}})],
  ['review', t => ({pose: {face: 'side', ear: 6}, tilt: 6 + Math.sin(t / 20) * 2})],
];
