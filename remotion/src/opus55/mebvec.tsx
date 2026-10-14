/**
 * Meb drawn smooth from the rig's own shapes (meb-hatch/rig.tsx): the same head, ears, body, arms and legs, the same
 * white, with cel-shade bands. Shared by universe four (the fighter) and five (the lawyer); each world adds its props
 * through the slots, never by changing the body (MASCOT.md). The ghost is Opus 5: the same shapes, see-through, blue edge.
 * Units are rig cells (40×40 grid), feet at (20, 37.8).
 */
import React from 'react';
import {PINK, armCap, earTri, lerp, rot} from '../meb-hatch/rig';
import type {P2} from '../meb-hatch/rig';

export type Face = 'neutral' | 'blink' | 'fierce' | 'shout' | 'focus' | 'hurt' | 'ko' | 'shocked' | 'happy';
export type FP = {face?: Face; ear?: number; armL?: number; armR?: number; reachL?: number; reachR?: number; legL?: number; legR?: number;
  kick?: number; lift?: number; sx?: number; sy?: number; tilt?: number; look?: number; sweat?: boolean};
export const f2 = (v: number) => v.toFixed(2);
export const poly = (pts: P2[]) => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z';
export const cap = (a: P2, b: P2, r: number) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6, nx = -dy / l * r, ny = dx / l * r;
  return `M${f2(a[0] + nx)} ${f2(a[1] + ny)}L${f2(b[0] + nx)} ${f2(b[1] + ny)}A${r} ${r} 0 0 0 ${f2(b[0] - nx)} ${f2(b[1] - ny)}L${f2(a[0] - nx)} ${f2(a[1] - ny)}A${r} ${r} 0 0 0 ${f2(a[0] + nx)} ${f2(a[1] + ny)}Z`;
};
export const HEAD_D = poly([...Array(80)].map((_, i) => {const t = i / 80 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  return [20 + 14.6 * Math.sign(c) * Math.abs(c) ** (2 / 2.6), 15 + 10.2 * Math.sign(s) * Math.abs(s) ** (2 / 2.6)] as P2;}));
export const BODY_D = poly([...Array(64)].map((_, i) => {const t = i / 64 * Math.PI * 2, y = 29 + 7.2 * Math.sin(t), rx = 6.6 + Math.max(0, y - 26) * .28; return [20 + rx * Math.cos(t), y] as P2;}));
export const INK = '#2A2540', EYE = '#1A1826';
export const PALS = {
  meb: {o: INK, w: '#FFFFFF', l: '#ECE9F3', s: '#C8C1D8', band: '#e8323f'},
  ghost: {o: '#2f7fd6', w: '#f4faff', l: '#e0eefb', s: '#bcd8f3', band: '#3d86d6'},
};
export type Pal = typeof PALS.meb;
export const mixW = (hex: string, t: number) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(hex.slice(i, i + 2), 16), 255, t)).toString(16).padStart(2, '0')).join('');
export const hash = (i: number) => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};

export const FaceG: React.FC<{p: FP; w: string}> = ({p, w}) => {
  const lk = (p.look ?? 0) * 1.3, face = p.face ?? 'neutral', ex = [12 + lk, 26 + lk];
  const eye = (cx: number, i: number) => {
    switch (face) {
      case 'blink': return <path key={i} d={`M${cx - 2} 15 H${cx + 2}`} stroke={EYE} strokeWidth={1.1} strokeLinecap="round"/>;
      case 'focus': return <path key={i} d={`M${cx - 2.1} 14.6 Q${cx} 16.4 ${cx + 2.1} 14.6`} stroke={EYE} strokeWidth={1.1} fill="none" strokeLinecap="round"/>;
      case 'happy': return <path key={i} d={`M${cx - 2.1} 15.6 Q${cx} 12.4 ${cx + 2.1} 15.6`} stroke={EYE} strokeWidth={1.15} fill="none" strokeLinecap="round"/>;
      case 'hurt': {const s = i ? -1 : 1; return <path key={i} d={`M${cx - 1.8 * s} 12.7 L${cx + 1.6 * s} 14.6 L${cx - 1.8 * s} 16.5`} stroke={EYE} strokeWidth={1.15} fill="none" strokeLinecap="round" strokeLinejoin="round"/>;}
      case 'ko': return <path key={i} d={`M${cx - 1.8} 12.8 L${cx + 1.8} 16.4 M${cx + 1.8} 12.8 L${cx - 1.8} 16.4`} stroke={EYE} strokeWidth={1.1} strokeLinecap="round"/>;
      case 'shocked': return <g key={i}><circle cx={cx} cy={14.4} r={1.45} fill={EYE}/><circle cx={cx - .5} cy={13.9} r={.45} fill="#fff"/></g>;
      default: {
        const angry = face === 'fierce' || face === 'shout', s = i ? -1 : 1;
        return <g key={i}><rect x={cx - 2} y={12} width={4} height={5} rx={1.7} fill={EYE}/><circle cx={cx - .75} cy={13.4} r={.72} fill="#fff"/>
          {angry && <><path d={`M${cx - 2.8} 10.6 L${cx + 2.8} 10.6 L${cx + 2.8} ${i ? 12.6 : 14.1} L${cx - 2.8} ${i ? 14.1 : 12.6} Z`} fill={w}/>
            <path d={`M${cx - 2.4 * s} ${s > 0 ? 12.5 : 12.5} L${cx + 2.3 * s} 14`} stroke={EYE} strokeWidth={.75} strokeLinecap="round"/></>}</g>;
      }
    }
  };
  const mouth = face === 'shout' ? <g><path d="M18.3 18.7 H21.7 L21 21.6 H19 Z" fill={EYE} strokeLinejoin="round" stroke={EYE} strokeWidth={.4}/><ellipse cx={20} cy={21} rx={.9} ry={.45} fill="#ff7f97"/></g>
    : face === 'happy' ? <path d="M18.2 19.2 Q20 21.2 21.8 19.2" stroke={EYE} strokeWidth={1} fill="none" strokeLinecap="round"/>
    : face === 'shocked' ? <ellipse cx={20} cy={20.1} rx={1.15} ry={1.45} fill={EYE}/>
    : face === 'ko' || face === 'hurt' ? <path d="M18.3 20.4 Q20 18.8 21.7 20.4" stroke={EYE} strokeWidth={1} fill="none" strokeLinecap="round"/>
    : face === 'fierce' ? <path d="M18.4 19.9 Q20 19.1 21.6 19.9" stroke={EYE} strokeWidth={1} fill="none" strokeLinecap="round"/>
    : <path d="M18.4 19.5 H21.6" stroke={EYE} strokeWidth={1} strokeLinecap="round"/>;
  return <g>{ex.map(eye)}{mouth}
    {face !== 'ko' && <><ellipse cx={9 + lk * .4} cy={18.6} rx={1.25} ry={.6} fill={PINK}/><ellipse cx={31 + lk * .4} cy={18.6} rx={1.25} ry={.6} fill={PINK}/></>}</g>;
};

/** Meb (or the ghost) with his feet at screen (x, y), k px per rig cell. The slots are drawn in rig cells:
 *  `behind` under everything and untilted, `onBody` over the body (under the arms), `onHead` over the face. */
export const MebVec: React.FC<{id: string; x: number; y: number; k: number; p: FP; f: number; ghost?: boolean; flip?: boolean; o?: number; flash?: number;
  behind?: React.ReactNode; onBody?: React.ReactNode; onHead?: React.ReactNode}> = ({id, x, y, k, p, f, ghost, flip, o = 1, flash = 0, behind, onBody, onHead}) => {
  const P = ghost ? PALS.ghost : PALS.meb;
  const reach = (c: [P2, P2], kk = 1): [P2, P2] => [c[0], [c[0][0] + (c[1][0] - c[0][0]) * kk, c[0][1] + (c[1][1] - c[0][1]) * kk]];
  const arm = (s: number) => {const a = (s < 0 ? p.armL : p.armR) ?? 0, [a0, a1] = reach(armCap(s, a), (s < 0 ? p.reachL : p.reachR) ?? 1); return {d: cap(a0, a1, 1.7), hi: a > 90};};
  const leg = (s: number) => {const a = (s < 0 ? p.legL : p.legR) ?? 0, hip: P2 = [20 + s * 3.7, 33], kk = s > 0 ? p.kick ?? 1 : 1; return cap(hip, rot([hip[0], 33 + 2.6 * kk], hip, -s * a), 2.2);};
  const arms = [arm(-1), arm(1)], ear = p.ear ?? 0;
  const bodyD = [leg(-1), leg(1), BODY_D], headD = [HEAD_D, poly(earTri(-1, ear, 1)), poly(earTri(1, ear, 1))];
  const out = (ds: string[], key: string) => ds.map((d, i) => <path key={key + i} d={d} fill="none" stroke={P.o} strokeWidth={1.7} strokeLinejoin="round"/>);
  const fill = (ds: string[], c: string, key: string) => ds.map((d, i) => <path key={key + i} d={d} fill={c}/>);
  const shade = (ds: string[], cid: string) => <>
    <clipPath id={cid}>{ds.map((d, i) => <path key={i} d={d}/>)}</clipPath>
    <g clipPath={`url(#${cid})`}><rect x={-5} y={-5} width={50} height={50} fill={P.s}/>
      <g transform="translate(0 -1)">{fill(ds, P.l, 'l')}</g><g transform="translate(0 -2.3)">{fill(ds, P.w, 'w')}</g></g></>;
  const sx = p.sx ?? 1, sy = p.sy ?? 1, fl = flip ? -1 : 1;
  return <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(k * fl)} ${f2(k)}) translate(-20 -37.8)`} opacity={o}>
    {behind}
    <g transform={`translate(20 37.8) rotate(${f2(p.tilt ?? 0)}) scale(${f2(sx)} ${f2(sy)}) translate(-20 ${f2(-37.8 - (p.lift ?? 0))})`}>
      {ghost && <defs><filter id={id + 'gl'} x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius=".5" result="d"/>
        <feGaussianBlur in="d" stdDeviation=".7" result="b"/><feFlood floodColor="#5ab4ff"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>}
      <g opacity={ghost ? .76 : 1} filter={ghost ? `url(#${id}gl)` : undefined}>
        {out(bodyD, 'bo')}{fill(bodyD, P.w, 'bf')}{shade(bodyD, id + 'bc')}
        {onBody}
        {arms.filter(a => !a.hi).map((a, i) => <g key={'al' + i}><path d={a.d} fill="none" stroke={P.o} strokeWidth={1.7}/><path d={a.d} fill={P.w}/></g>)}
        {out(headD, 'ho')}{fill(headD, P.w, 'hf')}{shade(headD, id + 'hs')}
        <FaceG p={p} w={P.w}/>
        {onHead}
        {arms.filter(a => a.hi).map((a, i) => <g key={'ah' + i}><path d={a.d} fill="none" stroke={P.o} strokeWidth={1.7}/><path d={a.d} fill={P.w}/></g>)}
        {p.sweat && <path d="M34.5 5.5 Q36.6 9.4 34.5 10.6 Q32.4 9.4 34.5 5.5 Z" fill="#9fdcff" stroke={P.o} strokeWidth={.6}/>}
        {flash > 0 && <g opacity={flash}>{fill([...bodyD, ...headD], '#fff', 'x')}</g>}
      </g>
    </g>
  </g>;
};
