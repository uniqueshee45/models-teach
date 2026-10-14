/**
 * Universe four's cast, lifted out of uni4.tsx so the game's arena (channel/game/src/arenaview.tsx) draws the same
 * fighter and the same boss: the five effort levels and their colours, the effort aura, Meb with his headband, and
 * the hard job. uni4.tsx imports them back; nothing here changed in the move.
 */
import React from 'react';
import {MONO} from '../meb-hatch/rig';
import type {P2} from '../meb-hatch/rig';
import {HEAD_D, INK, MebVec, PALS, f2, hash, mixW, poly} from './mebvec';
import type {FP} from './mebvec';

/* ---------- the effort levels ---------- */
export const LV = [
  {name: 'LOW', c: '#4fb3ff'}, {name: 'MEDIUM', c: '#3fe07f'}, {name: 'HIGH', c: '#ffd23f'},
  {name: 'X-HIGH', c: '#ff8c2e'}, {name: 'MAX', c: '#ff3d6e'},
];
export const lvCol = (l: number) => LV[Math.max(0, Math.min(4, Math.ceil(l - .001) - 1))].c;

/* ---------- Meb: the shared smooth drawing (mebvec.tsx), with the effort aura and a headband ---------- */
export const Aura: React.FC<{lvl: number; f: number; id: string}> = ({lvl, f, id}) => {
  if (lvl <= .02) return null;
  const c = lvCol(lvl), Lv = Math.min(5.5, lvl);
  const ring = (sc: number, ph: number) => {
    const N = 22, pts: P2[] = [];
    for (let i = 0; i < N * 2; i++) {
      const th = i / (N * 2) * Math.PI * 2 - Math.PI / 2, tip = i % 2 === 0, up = Math.max(0, -Math.sin(th));
      const fl = .5 + .5 * Math.sin(f * .75 + i * 1.9 + ph);
      const ext = tip ? (1 + Lv * 1.25) * (.5 + .5 * fl) * (.3 + up * 1.2) : 0;
      pts.push([20 + Math.cos(th) * (16.6 * sc + ext * .6), 21.5 + Math.sin(th) * (18.6 * sc + ext) - (tip ? up * ext * .6 : 0)]);
    }
    return poly(pts);
  };
  const sparks = Lv >= 2 ? [...Array(10)].map((_, j) => {const ph = (f * .03 + j * .1 + hash(j)) % 1;
    return <path key={j} d={`M0 -1.1L.55 0L0 1.1L-.55 0Z`} fill={j % 3 ? c : '#fff'} opacity={(1 - ph) * .9}
      transform={`translate(${f2(20 + Math.sin(j * 2.4) * (13 + Lv * 1.4) + Math.sin(f * .2 + j) * 1.2)} ${f2(37 - ph * (30 + Lv * 6))}) scale(${.7 + Lv * .12})`}/>;}) : null;
  const bolts = Lv >= 4.5 ? [0, 1].map(j => {const s0 = Math.floor(f / 3) * 7 + j * 31, a0 = hash(s0) * Math.PI * 2;
    const pts: P2[] = [[20 + Math.cos(a0) * 12, 21 + Math.sin(a0) * 14]];
    for (let q = 1; q < 5; q++) pts.push([pts[q - 1][0] + Math.cos(a0) * 1.6 + (hash(s0 + q) - .5) * 2.6, pts[q - 1][1] + Math.sin(a0) * 1.6 + (hash(s0 + q * 3) - .5) * 2.6]);
    return <polyline key={j} points={pts.map(p => p.map(f2).join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={.55} strokeLinejoin="round" opacity={.9}/>;}) : null;
  return <g>
    <defs><filter id={id + 'bl'} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={.55}/></filter></defs>
    <ellipse cx={20} cy={37.8} rx={13 + Lv * 2.2} ry={2 + Lv * .35} fill={c} opacity={.18 + Lv * .06}/>
    <g filter={`url(#${id}bl)`}>
      <path d={ring(1.02, 0)} fill={c} opacity={.55}/>
      <path d={ring(.94, 2)} fill={mixW(c, .55)} opacity={.55}/>
      {Lv >= 3 && <path d={ring(.86, 4)} fill="#fff" opacity={.4}/>}
    </g>
    {sparks}{bolts}
  </g>;
};

export type Look = {ghost?: boolean; aura?: number; band?: boolean | string; flip?: boolean; o?: number; flash?: number};   // band: false for none, or its colour (the game's fighters)
/** Meb (or the ghost) with his feet at screen (x, y), k px per rig cell. */
export const Fighter: React.FC<{id: string; x: number; y: number; k: number; p: FP; look?: Look; f: number}> = ({id, x, y, k, p, look = {}, f}) => {
  const pal = look.ghost ? PALS.ghost : PALS.meb, P = typeof look.band === 'string' ? {...pal, band: look.band} : pal;
  const wv = (ph: number) => Math.sin(f * .45 + ph);
  const knot: P2 = [5.7, 10.1];
  const band = look.band !== false && <g>
    <clipPath id={id + 'hc'}><path d={HEAD_D}/></clipPath>
    <path d={`M${knot[0]} ${knot[1]} Q${f2(2.4)} ${f2(10.8 + wv(0) * .9)} ${f2(-1.4)} ${f2(12 + wv(1.2) * 1.3)} M${knot[0]} ${knot[1]} Q${f2(3)} ${f2(12.6 + wv(2) * .8)} ${f2(-.2)} ${f2(14.9 + wv(3) * 1.2)}`}
      stroke={P.o} strokeWidth={2.5} fill="none" strokeLinecap="round"/>
    <path d={`M${knot[0]} ${knot[1]} Q${f2(2.4)} ${f2(10.8 + wv(0) * .9)} ${f2(-1.4)} ${f2(12 + wv(1.2) * 1.3)} M${knot[0]} ${knot[1]} Q${f2(3)} ${f2(12.6 + wv(2) * .8)} ${f2(-.2)} ${f2(14.9 + wv(3) * 1.2)}`}
      stroke={P.band} strokeWidth={1.35} fill="none" strokeLinecap="round"/>
    <g clipPath={`url(#${id}hc)`}><path d="M1 8.1 Q20 4.3 39 8.1 L39 10.7 Q20 6.9 1 10.7 Z" fill={P.band} stroke={P.o} strokeWidth={.75}/></g>
    <circle cx={knot[0]} cy={knot[1]} r={1.2} fill={P.band} stroke={P.o} strokeWidth={.7}/>
  </g>;
  return <MebVec id={id} x={x} y={y} k={k} p={p} f={f} ghost={look.ghost} flip={look.flip} o={look.o ?? 1} flash={look.flash ?? 0}
    behind={<Aura lvl={look.aura ?? 0} f={f} id={id}/>} onHead={band}/>;
};

/** The hard job: universe three's job block, grown into a boss. Units: rig cells, feet at (0, 0). */
export const Boss: React.FC<{x: number; y: number; k: number; f: number; flash: number; sq: number}> = ({x, y, k, f, flash, sq}) => {
  const b = Math.sin(f / 7) * .8, blink = f % 70 < 4, arm = Math.sin(f / 9) * 4;
  const rivets = [[-23, -67], [23, -67], [-23, -18], [23, -18]];
  return <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(k)} ${f2(k * sq)})`}>
    <g transform={`translate(0 ${f2(b)})`} style={flash > 0 ? {filter: `brightness(${1 + flash * 2})`} : undefined}>
      {[-1, 1].map(s => <g key={s} transform={`rotate(${f2(s * arm)} ${s * 27} -60)`}>
        <rect x={s > 0 ? 25 : -37} y={-62} width={12} height={26} rx={2} fill="#343a45" stroke={INK} strokeWidth={1.4}/>
        <rect x={s > 0 ? 23 : -39} y={-38} width={16} height={14} rx={3} fill="#252a33" stroke={INK} strokeWidth={1.4}/>
        {[0, 1, 2].map(q => <rect key={q} x={(s > 0 ? 25 : -37) + q * 4.4} y={-35.5} width={2.6} height={2.2} fill="#39ff88"/>)}</g>)}
      <rect x={-18} y={-16} width={12} height={16} fill="#2b3039" stroke={INK} strokeWidth={1.4}/><rect x={6} y={-16} width={12} height={16} fill="#2b3039" stroke={INK} strokeWidth={1.4}/>
      <rect x={-27} y={-72} width={54} height={58} rx={3} fill="#3d434e" stroke={INK} strokeWidth={1.6}/>
      <rect x={-27} y={-72} width={54} height={4} fill="#5a6272"/>
      <rect x={-27} y={-22} width={54} height={6} fill="#ffd23f"/>
      {[...Array(9)].map((_, q) => <path key={q} d={`M${-27 + q * 6.4} -16 l3.2 -6 h3.2 l-3.2 6 z`} fill="#222"/>)}
      {rivets.map(([a, c], q) => <circle key={q} cx={a} cy={c} r={1.1} fill="#9aa3b2"/>)}
      <rect x={-20} y={-64} width={40} height={36} rx={2} fill="#0b1310" stroke="#151920" strokeWidth={2}/>
      {[...Array(7)].map((_, q) => <rect key={q} x={-19} y={-63 + q * 5} width={38} height={.6} fill="#39ff88" opacity={.06}/>)}
      {blink ? <><rect x={-13} y={-51} width={8} height={1.4} fill="#39ff88"/><rect x={5} y={-51} width={8} height={1.4} fill="#39ff88"/></>
        : <><path d="M-14 -55 L-5 -52 V-46 H-14 Z" fill="#39ff88"/><path d="M14 -55 L5 -52 V-46 H14 Z" fill="#39ff88"/></>}
      <text x={0} y={-33} textAnchor="middle" fontFamily={MONO} fontSize={6.5} fill="#39ff88">{'>_' + '▮▯'[Math.floor(f / 8) % 2]}</text>
      <rect x={-1} y={-82} width={2} height={10} fill="#252a33"/><circle cx={0} cy={-83} r={2.2} fill={f % 20 < 10 ? '#ff3040' : '#7a1820'}/>
    </g>
  </g>;
};
