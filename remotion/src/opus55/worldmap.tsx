/**
 * The level-select map of the ending, shared with the game (channel/game, where it is the first screen): the
 * palette, the six levels' places and dioramas, the island, the flags and plates.
 * Lifted out of ending.tsx unchanged (2026-10-01); the ending's stills were compared before and after.
 */
import React from 'react';
import {clamp, lerp, outBack, outC} from '../meb-hatch/rig';
import type {P2} from '../meb-hatch/rig';
import {INK, f2, poly} from './mebvec';

export const C = {sea: '#3d9be0', wave: '#72bdf0', sand: '#f5dc9a', grass: '#79cc4e', grass2: '#5aad38', lite: '#8fdc63', stone: '#f1e8d4', stone2: '#cdbf9f',
  yel: '#ffd23f', red: '#e8323f', green: '#4fd36b', wood: '#c98f4e', wood2: '#9c6a34', plate: '#241c3a', hud: 'rgba(22,16,40,.84)'};
export const NODES: P2[] = [[300, 900], [800, 620], [1300, 900], [1800, 620], [2300, 900], [2800, 620]];
export const TREES: P2[] = [[620, 1200], [1550, 1180], [2550, 1180], [3000, 1000], [4150, 1000]];
export const blob = (cx: number, cy: number, a: number, b: number, n: number, pad: number, seed: number) => poly([...Array(140)].map((_, i) => {
  const t = i / 140 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), w = 1 + .016 * Math.sin(t * 7 + seed) + .01 * Math.sin(t * 13 + seed * 2);
  return [cx + (a + pad) * w * Math.sign(c) * Math.abs(c) ** (2 / n), cy + (b + pad) * w * Math.sign(s) * Math.abs(s) ** (2 / n)] as P2;}));
export const ISLES = [[1500, 800, 1650, 520, 4, 1], [3780, 840, 500, 400, 2.4, 3]] as const;
export const bez = (p0: P2, p1: P2, p2: P2, p3: P2, t: number): P2 => {const u = 1 - t;
  return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as P2;};
export const MAIN_DOTS: P2[] = NODES.slice(1).flatMap((n, i) => {const a = NODES[i]; return [...Array(12)].map((_, k) => bez(a, [a[0] + 250, a[1]], [n[0] - 250, n[1]], n, (k + .5) / 12));});
export const Platform: React.FC<{x: number; y: number}> = ({x, y}) => <g>
  <ellipse cx={x} cy={y + 28} rx={158} ry={54} fill={C.stone2} stroke={INK} strokeWidth={6}/>
  <ellipse cx={x} cy={y + 10} rx={158} ry={54} fill={C.stone} stroke={INK} strokeWidth={6}/></g>;
export const cube = (cx: number, cy: number, s = 58): string[] => {const d = s * .58, h = s * 1.15;
  return [poly([[cx, cy - d], [cx + s, cy], [cx, cy + d], [cx - s, cy]]), poly([[cx - s, cy], [cx, cy + d], [cx, cy + d + h], [cx - s, cy + h]]), poly([[cx + s, cy], [cx, cy + d], [cx, cy + d + h], [cx + s, cy + h]])];};
export const Diorama: React.FC<{i: number; x: number; y: number}> = ({i, x, y}) => {
  const st = {stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' as const};
  switch (i) {
    case 0: return <g>   {/* the highway */}
      <path d={`M${x - 120} ${y + 30} L${x + 120} ${y + 30} L${x + 50} ${y - 170} L${x - 50} ${y - 170} Z`} fill="#4b4d5e" {...st}/>
      {[-1, 1].map(s => <path key={s} d={`M${x + s * 40} ${y + 26} L${x + s * 17} ${y - 166}`} stroke="#fff" strokeWidth={5} strokeDasharray="22 18"/>)}
      <g transform={`translate(${x - 4} ${y - 30})`}><rect x={-30} y={-12} width={10} height={22} fill={INK}/><rect x={20} y={-12} width={10} height={22} fill={INK}/>
        <rect x={-26} y={-40} width={52} height={72} rx={14} fill={C.red} {...st} strokeWidth={5}/><rect x={-18} y={-30} width={36} height={18} rx={5} fill="#bfe6ff" stroke={INK} strokeWidth={4}/></g>
      <circle cx={x + 34} cy={y - 124} r={15} fill={C.yel} stroke={INK} strokeWidth={4}/></g>;
    case 1: return <g>   {/* the item shop */}
      <rect x={x - 85} y={y - 120} width={170} height={118} fill="#f7dcaa" {...st}/>
      <rect x={x - 22} y={y - 72} width={44} height={70} fill="#8a5a33" stroke={INK} strokeWidth={5}/>
      {[-1, 1].map(s => <rect key={s} x={x + s * 55 - 16} y={y - 100} width={32} height={28} fill="#bfe6ff" stroke={INK} strokeWidth={4}/>)}
      {[...Array(6)].map((_, k) => <path key={k} d={poly([[x - 104 + k * 34.7, y - 122], [x - 104 + (k + 1) * 34.7, y - 122], [x - 88 + (k + 1) * 29.3, y - 162], [x - 88 + k * 29.3, y - 162]])} fill={k % 2 ? '#fff' : C.red}/>)}
      <path d={`M${x - 104} ${y - 122} H${x + 104} L${x + 88} ${y - 162} H${x - 88} Z`} fill="none" {...st}/>
      <circle cx={x} cy={y - 196} r={26} fill={C.yel} {...st} strokeWidth={5}/><text x={x} y={y - 184} textAnchor="middle" fontFamily="BVP" fontSize={34} fill={INK}>$</text></g>;
    case 2: return <g>   {/* the block world */}
      {[[x - 30, 0], [x - 30, 1], [x - 30, 2], [x + 60, 0], [x + 60, 1]].map(([cx, k], j) => {const cy = (cx < x ? y - 70 : y - 50) - k * 66.7, [top, l, r] = cube(cx, cy);
        return <g key={j}><path d={l} fill="#a8733f" {...st} strokeWidth={5}/><path d={r} fill="#8a5b2f" {...st} strokeWidth={5}/><path d={top} fill="#72cf4a" {...st} strokeWidth={5}/></g>;})}</g>;
    case 3: return <g>   {/* the fighting game */}
      <path d={poly([...Array(28)].map((_, k) => {const a = k / 28 * Math.PI * 2, r = k % 2 ? 60 : 96; return [x + r * Math.cos(a), y - 140 + r * Math.sin(a)] as P2;}))} fill={C.yel} {...st}/>
      <text x={x} y={y - 112} textAnchor="middle" fontFamily="BVP" fontSize={76} fill={C.red} stroke={INK} strokeWidth={8} paintOrder="stroke">VS</text>
      <rect x={x - 120} y={y - 40} width={240} height={50} rx={6} fill="#595e7d" {...st}/><path d={`M${x - 110} ${y - 26} H${x + 110}`} stroke="#8f95b8" strokeWidth={5}/></g>;
    case 4: return <g>   {/* the courtroom */}
      <rect x={x - 120} y={y - 22} width={240} height={26} fill="#e9e3d6" {...st}/>
      {[0, 1, 2, 3].map(k => <rect key={k} x={x - 92 + k * 54} y={y - 128} width={26} height={106} fill="#fbf7ee" stroke={INK} strokeWidth={5}/>)}
      <rect x={x - 118} y={y - 146} width={236} height={22} fill="#fbf7ee" {...st}/>
      <path d={`M${x - 128} ${y - 146} L${x + 128} ${y - 146} L${x} ${y - 205} Z`} fill="#fbf7ee" {...st}/></g>;
    default: return <g>   {/* the spaceship */}
      <ellipse cx={x} cy={y + 6} rx={112} ry={34} fill="#9aa3b5" stroke={INK} strokeWidth={5}/>
      {[-1, 1].map(s => <path key={s} d={`M${x + s * 40} ${y - 60} L${x + s * 70} ${y}`} stroke={INK} strokeWidth={7} strokeLinecap="round"/>)}
      <path d={`M${x - 100} ${y - 120} L${x - 150} ${y - 165} L${x - 132} ${y - 96} Z`} fill={C.red} {...st}/>
      <path d={`M${x - 110} ${y - 100} Q${x - 110} ${y - 152} ${x - 40} ${y - 152} H${x + 40} Q${x + 122} ${y - 150} ${x + 132} ${y - 102} Q${x + 122} ${y - 56} ${x + 40} ${y - 56} H${x - 40} Q${x - 110} ${y - 56} ${x - 110} ${y - 100} Z`} fill="#dfe5ef" {...st}/>
      <ellipse cx={x + 62} cy={y - 108} rx={30} ry={20} fill="#7fd8ff" stroke={INK} strokeWidth={5}/></g>;
  }
};
export const Flag: React.FC<{x: number; y: number; u: number; f: number; i: number; left?: boolean; s?: string}> = ({x, y, u, f, i, left, s = 'CLEAR'}) => {
  const top = y - 245, ty = lerp(y - 90, top, outC(u)), w = 6 * Math.sin(f / 6 + i), d = left ? -1 : 1;
  return <g>
    <path d={`M${x} ${y} V${top}`} stroke={INK} strokeWidth={7} strokeLinecap="round"/>
    {u > 0 && <g opacity={clamp(u * 3)}><path d={`M${x} ${ty} Q${x + d * 75} ${ty - w} ${x + d * 150} ${ty + w} V${ty + 80 + w} Q${x + d * 75} ${ty + 80 - w} ${x} ${ty + 80} Z`} fill={C.yel} stroke={INK} strokeWidth={5} strokeLinejoin="round"/>
      <text x={x + d * 75} y={ty + 54} textAnchor="middle" fontFamily="BVP" fontSize={38} fill={INK}>{s}</text></g>}
    <circle cx={x} cy={top} r={9} fill={C.yel} stroke={INK} strokeWidth={4}/></g>;
};
export const Plate: React.FC<{x: number; y: number; s: string; u: number}> = ({x, y, s, u}) => {
  if (u <= 0) return null;
  const w = s.length * 50 * .62 + 56;
  return <g transform={`translate(${x} ${y}) scale(${f2(outBack(u))})`}>
    <rect x={-w / 2} y={-42} width={w} height={78} rx={18} fill={C.plate} stroke="#fff" strokeWidth={5}/>
    <text x={0} y={15} textAnchor="middle" fontFamily="BVP" fontSize={50} fill="#fff">{s}</text></g>;
};
export const Tree: React.FC<{x: number; y: number}> = ({x, y}) => <g>
  <rect x={x - 10} y={y - 62} width={20} height={62} fill={C.wood2} stroke={INK} strokeWidth={5}/>
  <circle cx={x} cy={y - 104} r={58} fill={C.grass2} stroke={INK} strokeWidth={6}/><circle cx={x - 18} cy={y - 120} r={22} fill={C.lite}/></g>;
export const Cloud: React.FC<{x: number; y: number; w?: number}> = ({x, y, w = 160}) => {
  const parts: [number, number, number][] = [[x - w * .28, y - w * .02, w * .2], [x, y - w * .12, w * .28], [x + w * .28, y - w * .02, w * .2]];
  const shapes = (fill: string, sw: number) => <>{parts.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={fill} stroke={fill} strokeWidth={sw}/>)}
    <rect x={x - w * .46} y={y - w * .08} width={w * .92} height={w * .2} rx={w * .1} fill={fill} stroke={fill} strokeWidth={sw}/></>;
  return <g>{shapes(INK, 11)}{shapes('#fff', 0)}<ellipse cx={x - w * .08} cy={y - w * .22} rx={w * .1} ry={w * .05} fill="#eaf3ff"/></g>;
};
export const Pal: React.FC<{x: number; y: number; c: string; s?: number; look?: number}> = ({x, y, c, s = 1, look = 0}) => <g transform={`translate(${f2(x)} ${f2(y)}) scale(${s})`}>
  <ellipse cx={0} cy={-22} rx={22} ry={21} fill={c} stroke={INK} strokeWidth={4.5}/>
  <circle cx={-7 + look} cy={-25} r={3.4} fill={INK}/><circle cx={7 + look} cy={-25} r={3.4} fill={INK}/></g>;
