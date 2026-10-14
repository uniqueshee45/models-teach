/**
 * The pixel kit of universe two (the item shop), shared with the game (channel/game, the front desk): sprites as rows
 * of palette letters merged into one path per colour, the pixel text, the boxes, and the shop's cast.
 * Lifted out of uni2.tsx unchanged (2026-10-01); uni2's stills were compared before and after.
 */
import React from 'react';
import {PAL, clamp, meb} from '../meb-hatch/rig';
import type {Pose} from '../meb-hatch/rig';
import {textD, tw} from './pixfont';

/* ---------- pixel kit: every sprite is rows of palette letters, merged into one path per colour ---------- */
export type Runs = [string, string][];
export const toRuns = (rows: string[], pal: Record<string, string>): Runs => {
  const d: Record<string, string> = {};
  rows.forEach((r, y) => {for (let x = 0; x < r.length;) {let e = x + 1; while (e < r.length && r[e] === r[x]) e++;
    const c = pal[r[x]]; if (c) d[c] = (d[c] || '') + `M${x} ${y}h${e - x}v1h${x - e}z`; x = e;}});
  return Object.entries(d);
};
export const Sp: React.FC<{r: Runs; x: number; y: number; k?: number; flip?: number; o?: number}> = ({r, x, y, k = 1, flip, o}) =>
  <g transform={`translate(${Math.round(x)} ${Math.round(y)})${flip ? ` translate(${flip * k} 0) scale(${-k} ${k})` : k !== 1 ? ` scale(${k})` : ''}`} opacity={o}>
    {r.map(([c, d]) => <path key={c} d={d} fill={c}/>)}</g>;
export const raster = (w: number, h: number, fn: (x: number, y: number) => string) =>
  [...Array(h)].map((_, y) => [...Array(w)].map((_, x) => fn(x + .5, y + .5)).join(''));
/** Adds a 1px outline round every shape (the sprite needs a pixel of margin). */
export const outline = (rows: string[], o = 'o') => rows.map((r, y) => [...r].map((c, x) => c !== '.' ? c
  : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {const n = rows[y + b]?.[x + a]; return n !== undefined && n !== '.' && n !== o;}) ? o : '.').join(''));
export const circ = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const cap = (x: number, y: number, ax: number, ay: number, bx: number, by: number, r: number) => {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= r * r;
};
export const hash = (i: number) => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};
export const chop = (f: number, n: number) => Math.floor(f / n) * n;   // a handheld animates in steps, not smoothly
export const q = (o: number, n = 4) => Math.round(clamp(o) * n) / n;  // palette fades come in a few steps
export const R = (x: number) => Math.round(x);

/** Text: `n` letters typed so far; `sh` a drop shadow, `out` a 1px outline (`ow` thick). */
export const Tx: React.FC<{s: string; x: number; y: number; c?: string; sh?: string; out?: string; ow?: number; k?: number; n?: number; align?: 'l' | 'c' | 'r'}> =
  ({s, x, y, c = TXT, sh, out, ow = 1, k = 1, n, align = 'l'}) => {
    const d = textD(n === undefined ? s : s.slice(0, Math.max(0, Math.floor(n))));
    if (!d) return null;
    const x0 = R(align === 'l' ? x : align === 'c' ? x - tw(s) * k / 2 : x - tw(s) * k), y0 = R(y);
    const at = (dx: number, dy: number, col: string, key: string) => <path key={key} d={d} fill={col} transform={`translate(${x0 + dx} ${y0 + dy}) scale(${k})`}/>;
    const ring: number[][] = [];
    if (out) for (let a = -ow; a <= ow; a++) for (let b = -ow; b <= ow; b++) if (a || b) ring.push([a, b]);
    const dr = R(Math.max(1, k / 2));
    return <g>{ring.map(([a, b], i) => at(a, b, out!, `o${i}`))}{out && at(0, ow + dr, out, 'od')}{sh && at(dr, dr, sh, 'sh')}{at(0, 0, c, 'c')}</g>;
  };
export const typed = (f: number, a: number, cps = 1.5) => Math.max(0, (f - a) * cps);

/* ---------- colours ---------- */
export const TXT = '#3a3a48', TSH = '#d8d4c8', RED = '#e04848', GOLD = '#ffd23f', NAVY = '#1b2440', ORANGE = '#e3663e', INK = '#232838';
export type Theme = {o: string; a: string; f: string};
export const LIGHT: Theme = {o: '#2c3350', a: '#79a7ea', f: '#fbfbf6'}, BATTLE: Theme = {o: '#171c2b', a: '#e8a53a', f: '#2b3d60'};
export const CARD_A: Theme = {o: '#3a1f14', a: ORANGE, f: '#fff6ec'}, CARD_B: Theme = {o: '#241a3a', a: '#9a7cf0', f: '#f6f2ff'};

/* ---------- boxes and pointers ---------- */
export const rr = (x: number, y: number, w: number, h: number, r: number, fill: string) => r === 2
  ? <g fill={fill}><rect x={x + 2} y={y} width={w - 4} height={h}/><rect x={x + 1} y={y + 1} width={w - 2} height={h - 2}/><rect x={x} y={y + 2} width={w} height={h - 4}/></g>
  : <g fill={fill}><rect x={x + 1} y={y} width={w - 2} height={h}/><rect x={x} y={y + 1} width={w} height={h - 2}/></g>;
export const Box: React.FC<{x: number; y: number; w: number; h: number; t?: Theme; children?: React.ReactNode}> = ({x, y, w, h, t = LIGHT, children}) => <g>
  {rr(x + 1, y + 2, w, h, 2, 'rgba(10,12,30,.28)')}{rr(x, y, w, h, 2, t.o)}{rr(x + 1, y + 1, w - 2, h - 2, 2, t.a)}{rr(x + 3, y + 3, w - 6, h - 6, 1, t.f)}{children}</g>;
export const MEMO = new Map<string, Runs>();
/** Meb, from the rig; `back` wipes the face for the view from behind. */
export const mebR = (pose: Pose, back = false) => {
  const key = JSON.stringify(pose) + back;
  if (!MEMO.has(key)) MEMO.set(key, toRuns(meb(pose).map(r => r.map(k => !k ? '.' : back && (k === 'E' || k === 'P') ? 'W' : k).join('')), PAL));
  return MEMO.get(key)!;
};
export const Shadow: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => <g fill="rgba(20,30,20,.28)">
  <rect x={R(x - w / 2 + 2)} y={R(y)} width={w - 4} height={3}/><rect x={R(x - w / 2)} y={R(y) + 1} width={w} height={1}/></g>;
export const leaves = (w: number, h: number, cl: [number, number, number][], trunk?: [number, number, number, number]) => outline(raster(w, h, (x, y) => {
  let k = -1; cl.forEach(([cx, cy, r], i) => {if (circ(x, y, cx, cy, r)) k = i;});
  if (k >= 0) {
    let under = -1; cl.forEach(([cx, cy, r], i) => {if (circ(x, y + 1, cx, cy, r)) under = i;});
    if (under >= 0 && under < k) return 'D';                     // the lower edge of a clump over the one behind
    const [cx, cy, r] = cl[k], dx = (x - cx) / r, dy = (y - cy) / r;
    if (dy > .5 || (dy > .22 && (Math.floor(x) + Math.floor(y)) % 2)) return 'd';
    if (dy < -.38 && dx < .3) return 'h';
    return 'm';
  }
  if (trunk && x > trunk[0] && x < trunk[1] && y > trunk[2] && y < trunk[3]) return x < trunk[0] + 2 ? 'b' : x > trunk[1] - 2 ? 'B' : 't';
  return '.';
}));
export const LEAF = {o: '#1d3b27', h: '#a6e27c', m: '#58b24f', d: '#378641', D: '#266a33', b: '#b27e4a', t: '#8e5e34', B: '#64401f'};
export const TREE = toRuns(leaves(32, 40, [[16, 23, 10], [8, 21, 7], [24, 21, 7], [10, 13.5, 7.5], [22, 13.5, 7.5], [16, 8.5, 7]], [12, 20, 28, 38]), LEAF);
export const BUSH = toRuns(leaves(20, 15, [[10, 9, 5.5], [5, 10, 4], [15, 10, 4], [10, 6, 4.5]]), LEAF);
export const COINP = {o: '#5a3a08', y: '#ffc933', Y: '#d89a1a', h: '#fff3b0', e: '#1a1826', f: '#6a4410', w: '#fff'};
export const coinAt = (x: number, y: number, cx: number, cy: number, r: number) => !circ(x, y, cx, cy, r) ? '' : !circ(x, y, cx, cy, r - 1.4) ? 'Y'
  : circ(x, y, cx - r * .38, cy - r * .38, r * .32) ? 'h' : 'y';
export const critter = (s: number) => toRuns(outline(raster(14, 17, (x, y) => {
  const c = coinAt(x, y, 7, 6.5, 5.6);
  if (c) return (x > 4.6 && x < 5.8 || x > 8.2 && x < 9.4) && y > 5.5 && y < 8.2 ? 'e' : c;
  const l = s ? [[4, 12, 15], [8.5, 12, 14]] : [[4.5, 12, 14], [8, 12, 15]];
  return l.some(([a, b, c2]) => x > a && x < a + 2 && y > b && y < c2) ? 'f' : '.';
})), COINP);
export const CRIT = [critter(0), critter(1)];
export const ROBOP = {o: '#1f2636', s: '#aebfd8', S: '#8093b2', h: '#e3ebf6', k: '#18263a', g: '#6ef2a0', y: '#ffc933', a: ORANGE, A: '#b04a2a', w: '#fff'};
/** The shop's robot clerk. The game repaints it per model (`pal`); the video's is ROBOP. */
export const clerk = (face: 'open' | 'blink' | 'happy', pal: Record<string, string> = ROBOP) => toRuns(outline(raster(30, 34, (x, y) => {
  if (circ(x, y, 15, 3, 2)) return 'y';
  if (x > 14.4 && x < 15.6 && y > 4.5 && y < 8) return 'S';
  const corner = (x < 6 || x > 24) && (y < 10 || y > 20);
  if (x > 4 && x < 26 && y > 8 && y < 22 && !corner) {
    if (x > 7 && x < 23 && y > 10.5 && y < 19.5) {
      const ex = [10.5, 19.5].some(c => Math.abs(x - c) < 1.5);
      if (face === 'open' && ex && y > 12 && y < 16) return 'g';
      if (face === 'blink' && ex && y > 14 && y < 15.2) return 'g';
      if (face === 'happy' && ex && ((y > 12.5 && y < 13.6 && Math.abs(x - (x < 15 ? 10.5 : 19.5)) < .9) || (y > 13.5 && y < 14.6 && Math.abs(x - (x < 15 ? 10.5 : 19.5)) > .6))) return 'g';
      if (y > 16.6 && y < 17.8 && x > 13 && x < 17) return 'g';
      return 'k';
    }
    return y < 10.4 ? 'h' : y > 20 ? 'S' : 's';
  }
  if ((x > 1.5 && x < 5 || x > 25 && x < 28.5) && y > 22 && y < 30) return 'S';
  if (x > 5 && x < 25 && y > 21.5 && y < 34) {
    if (x > 8 && x < 22 && y > 23) return x > 12 && x < 18 && y > 26 && y < 31 ? 'A' : 'a';
    return 's';
  }
  return '.';
})), pal);
export const CLERK = {open: clerk('open'), blink: clerk('blink'), happy: clerk('happy')};
export const FLOOR = toRuns(raster(32, 32, (x, y) => {const X = Math.floor(x), Y = Math.floor(y);
  if (X % 16 === 15 || Y % 16 === 15) return 'g';
  if (X % 16 === 0 || Y % 16 === 0) return 'h';
  return (Math.floor(X / 16) + Math.floor(Y / 16)) % 2 ? 'b' : 'a';}), {a: '#f4e9d4', b: '#eadcc0', g: '#d4c09c', h: '#fbf4e6'});
