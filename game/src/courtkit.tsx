/**
 * The courtroom's cast, for the game's court (courtview.tsx): the judge (an owl in a robe, THE READER), Meb the lawyer
 * (the shared drawing with a tie and a badge) and the game's shout.
 * ponytail: a copy of the film's own (remotion/src/opus55/uni5.tsx, lines 111 to 268), line for line, with the owl's
 * gavel angle passed in (`ga`, degrees from pointing at the block) because the film times its bangs to the voice. The
 * film file is NOT shared: lifting these out of it changed 7 edge pixels of the film's title by one step on one of 13
 * stills (2026-10-06), and the film stays byte-identical. Share them from one file if the film is ever re-cut.
 */
import React from 'react';
import {lerp, outC, seg} from '../../remotion/src/meb-hatch/rig';
import type {P2} from '../../remotion/src/meb-hatch/rig';
import {EYE, INK, MebVec, f2, hash, poly} from '../../remotion/src/opus55/mebvec';
import type {FP} from '../../remotion/src/opus55/mebvec';

/* ---------- the judge: an owl in a robe, THE READER ---------- */
export type OwlFace = 'stern' | 'squint' | 'wide' | 'happy' | 'dizzy' | 'read';
const OWL = {body: '#8d6a4b', dark: '#6b4c33', disc: '#efe0c4', robe: '#24212d', robeL: '#3b3548', gold: '#d9a93a', beak: '#e3a232', iris: '#ffc93c', brow: '#4a3220'};
const OWL_HEAD = poly([...Array(72)].map((_, i) => {const t = i / 72 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
  return [14.5 * Math.sign(c) * Math.abs(c) ** (2 / 2.5), -30 + 11.8 * Math.sign(s) * Math.abs(s) ** (2 / 2.5)] as P2;}));
export const Owl: React.FC<{x: number; y: number; k: number; f: number; ga: number; face: OwlFace; look?: number; lookY?: number; glint?: number; doc?: boolean; nod?: number}> =
  ({x, y, k, f, ga, face, look = 0, lookY = 0, glint = 0, doc, nod = 0}) => {
    const bob = Math.sin(f / 13) * .25;
    const eyeAt = (cx: number, i: number) => {
      const cy = -29.6;
      if (face === 'happy') return <path key={i} d={`M${cx - 3.4} ${cy + 1} Q${cx} ${cy - 3.2} ${cx + 3.4} ${cy + 1}`} stroke={EYE} strokeWidth={1.3} fill="none" strokeLinecap="round"/>;
      if (face === 'dizzy') {const pts: P2[] = [...Array(30)].map((_, j) => {const a = j * .55 + f * .4 * (i ? -1 : 1), r = .2 + j * .12; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];});
        return <g key={i}><circle cx={cx} cy={cy} r={4.3} fill="#fff" stroke={INK} strokeWidth={.7}/><polyline points={pts.map(p => p.map(f2).join(',')).join(' ')} fill="none" stroke={EYE} strokeWidth={.8}/></g>;}
      const lid = face === 'stern' ? 3.1 : face === 'squint' ? 5.1 : face === 'read' ? 3.9 : 0, pr = face === 'wide' ? 3.0 : 2.3;
      return <g key={i}>
        <clipPath id={`owe${i}`}><circle cx={cx} cy={cy} r={4.3}/></clipPath>
        <circle cx={cx} cy={cy} r={4.3} fill={OWL.iris}/>
        <circle cx={cx + look * 1.4} cy={cy + lookY * 1.3 + (face === 'read' ? 1.2 : 0)} r={pr} fill={EYE}/>
        <circle cx={cx + look * 1.4 - .8} cy={cy + lookY * 1.3 - .9} r={.75} fill="#fff"/>
        {lid > 0 && <g clipPath={`url(#owe${i})`}><rect x={cx - 5} y={cy - 4.5} width={10} height={lid} fill={OWL.dark}/><path d={`M${cx - 5} ${cy - 4.5 + lid} H${cx + 5}`} stroke={INK} strokeWidth={.7}/></g>}
        <circle cx={cx} cy={cy} r={4.3} fill="none" stroke={INK} strokeWidth={.7}/>
      </g>;
    };
    const brow = (s: number) => {  // s = -1 left eye, 1 right; the inner end is near x = 0
      const o = s * 10, n = s * 1.8;
      const d = face === 'stern' ? `M${o} -36.4 L${n} -34.9` : face === 'squint' ? `M${o} -37 L${n} -34.2` : face === 'wide' ? `M${o} -36.8 Q${s * 6} -39.2 ${n} -37.2`
        : face === 'dizzy' ? `M${o} -35.8 Q${s * 6} -38 ${n} -36.2` : `M${o} -36.3 Q${s * 6} -37.6 ${n} -36.3`;
      return <path key={s} d={d} stroke={OWL.brow} strokeWidth={1.4} fill="none" strokeLinecap="round"/>;
    };
    const wingR = <g transform={`rotate(${f2(ga)} 12.5 -16)`}>
      <rect x={21.6} y={-17.4} width={6.6} height={2.8} rx={.8} fill="#6b3a1e" stroke={INK} strokeWidth={.6}/>{/* handle, then the head across it */}
      <rect x={21.8} y={-19.6} width={3.6} height={7.2} rx={1.3} fill="#7a4424" stroke={INK} strokeWidth={.7}/>
      <rect x={21.8} y={-17.1} width={3.6} height={1.1} fill={OWL.gold}/>
      <path d="M12.5 -18.7 L20.5 -18.2 Q23 -16 20.5 -13.8 L12.5 -13.3 Z" fill={OWL.robe} stroke={INK} strokeWidth={.9}/>
      <path d="M19.8 -18.4 L23.2 -17.6 L21.6 -16 L23.4 -14.6 L20 -13.6 Z" fill={OWL.body} stroke={INK} strokeWidth={.6}/>
    </g>;
    return <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(k)}) translate(0 ${f2(bob)})`}>
      {/* the robe, with a lit edge, the chest feathers and the jabot */}
      <path d="M-17 8 C-17.5 -6 -15 -17 -7 -20.5 L7 -20.5 C15 -17 17.5 -6 17 8 Z" fill={OWL.robe} stroke={INK} strokeWidth={1.1}/>
      <path d="M8 -19 C14 -15 15.5 -6 15.2 8 L12.6 8 C12.8 -4 11.4 -13 6.4 -18 Z" fill={OWL.robeL}/>
      <path d="M-6.5 -20.5 L0 -9.5 L6.5 -20.5 Z" fill={OWL.disc} stroke={INK} strokeWidth={.8}/>
      {[-3, 0, 3].map((dx, i) => <path key={i} d={`M${dx - 1.4} ${-18.6 + Math.abs(dx) * .1} q1.4 1.3 2.8 0`} stroke={OWL.dark} strokeWidth={.5} fill="none"/>)}
      <path d="M-2.6 -13.4 Q0 -11.6 2.6 -13.4 L1.9 -9.8 Q0 -8.4 -1.9 -9.8 Z" fill="#fff" stroke={INK} strokeWidth={.6}/>
      <path d="M-14 -16 C-19 -10 -18 -2 -12 1 C-9 -3 -9 -10 -11 -16 Z" fill={OWL.robe} stroke={INK} strokeWidth={1}/>
      {doc && <g transform="translate(-16 -21) rotate(-8)"><rect x={0} y={0} width={13} height={16} rx={.6} fill="#fbf7ec" stroke={INK} strokeWidth={.7}/>
        <rect x={1.6} y={2.2} width={9.6} height={2.2} fill="#ffe066"/>{[6.4, 8.6, 10.8, 13].map(yy => <rect key={yy} x={1.6} y={yy} width={yy > 12 ? 6 : 9.6} height={1} fill="#9a938a"/>)}
        <path d="M-1.5 14 C1 12 3.5 13 4 16 L0 17.5 Z" fill={OWL.body} stroke={INK} strokeWidth={.6}/></g>}
      {wingR}
      {/* the head */}
      <g transform={`rotate(${f2(nod)} 0 -20)`}>
        <path d="M-13.2 -36 L-11.2 -45.8 L-6.4 -39.6 Z" fill={OWL.dark} stroke={INK} strokeWidth={.9} strokeLinejoin="round"/>
        <path d="M13.2 -36 L11.2 -45.8 L6.4 -39.6 Z" fill={OWL.dark} stroke={INK} strokeWidth={.9} strokeLinejoin="round"/>
        <path d={OWL_HEAD} fill={OWL.body} stroke={INK} strokeWidth={1.1}/>
        {[-4, 0, 4].map(dx => <path key={dx} d={`M${dx - 1.2} -39.4 l1.2 1.2 l1.2 -1.2`} stroke={OWL.dark} strokeWidth={.6} fill="none"/>)}
        {[-1, 1].map(s => <circle key={s} cx={s * 5.9} cy={-29.6} r={6.9} fill={OWL.disc}/>)}
        {[-5.9, 5.9].map(eyeAt)}
        {[-1, 1].map(brow)}
        {[-1, 1].map(s => <circle key={'g' + s} cx={s * 5.9} cy={-29.6} r={5.5} fill="rgba(210,235,255,.12)" stroke={OWL.gold} strokeWidth={1.1}/>)}
        <path d="M-.5 -30.6 Q0 -31.8 .5 -30.6" stroke={OWL.gold} strokeWidth={1} fill="none"/>
        <path d="M-11.3 -30.8 L-14.2 -31.8 M11.3 -30.8 L14.2 -31.8" stroke={OWL.gold} strokeWidth={.9}/>
        <path d="M0 -28.6 L1.9 -26.2 L0 -22.4 L-1.9 -26.2 Z" fill={OWL.beak} stroke={INK} strokeWidth={.7} strokeLinejoin="round"/>
        {glint > 0 && <path d={`M8.6 -36.8 l.7 2.2 l2.2 .7 l-2.2 .7 l-.7 2.2 l-.7 -2.2 l-2.2 -.7 l2.2 -.7 Z`} fill="#fff" transform={`rotate(${f2(glint * 90)} 8.6 -33.9) translate(${f2(8.6 * (1 - glint))} ${f2(-33.9 * (1 - glint))}) scale(${f2(glint)})`}/>}
      </g>
    </g>;
  };

/* ---------- Meb the lawyer: the shared drawing with a tie and a badge ---------- */
const TIE = '#c8243a';
export const Lawyer: React.FC<{id: string; x: number; y: number; k: number; p: FP; f: number}> = ({id, x, y, k, p, f}) =>
  <MebVec id={id} x={x} y={y} k={k} p={p} f={f} onBody={<g>
    <path d="M19.1 26.6 L20.9 26.6 L22.1 31.4 L20 33.2 L17.9 31.4 Z" fill={TIE} stroke={INK} strokeWidth={.6} strokeLinejoin="round"/>
    <path d="M19.4 28.4 L21.3 27.9 M18.9 30.3 L21.8 29.6" stroke="#8e1426" strokeWidth={.5}/>
    <path d="M18.3 25 L21.7 25 L20.9 26.9 L19.1 26.9 Z" fill={TIE} stroke={INK} strokeWidth={.6} strokeLinejoin="round"/>
    <circle cx={25.4} cy={28.2} r={1.55} fill="#f2c14e" stroke={INK} strokeWidth={.5}/>
    <path d="M24.5 27.7 H26.3 M25.4 27.3 V29.1 M24.4 27.7 L24.1 28.5 H24.9 Z M26.4 27.7 L26.1 28.5 H26.9 Z" stroke="#8a6118" strokeWidth={.3} fill="#8a6118"/>
  </g>}/>;

/** The game's shout: a spiky bubble, the word slammed in, a shake. */
export const Shout: React.FC<{s: string; x: number; y: number; a: number; until: number; f: number; size?: number; tilt?: number; id: string}> = ({s, x, y, a, until, f, size = 170, tilt = -6, id}) => {
  const t = f - a;
  if (t < 0 || f >= until) return null;
  const sc = t < 4 ? lerp(1.8, 1, outC(t / 4)) : 1, out = seg(f, until - 4, until), sh = t < 12 ? (1 - t / 12) * 16 : 0;
  const rx = size * s.length * .36 + 80, ry = size * .95;
  const spikes = (k: number) => poly([...Array(44)].map((_, i) => {const th = i / 44 * Math.PI * 2, r = (i % 2 ? .86 : 1.08 + .14 * hash(i + 3)) * k; return [Math.cos(th) * rx * r, Math.sin(th) * ry * r] as P2;}));
  return <g transform={`translate(${f2(x + (hash(f) - .5) * sh)} ${f2(y + (hash(f + 9) - .5) * sh)}) rotate(${tilt}) scale(${f2(sc * (1 + out * .15))})`} opacity={1 - out}>
    <defs><linearGradient id={id} x1={0} y1={-size * .75} x2={0} y2={size * .1} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff5a6e"/><stop offset="1" stopColor="#9e0c24"/></linearGradient></defs>
    <path d={spikes(1)} fill="#fff" stroke={INK} strokeWidth={size * .08} strokeLinejoin="round"/>
    <path d={spikes(.9)} fill="none" stroke="#e8323f" strokeWidth={size * .03} strokeLinejoin="round"/>
    <text x={0} y={size * .34} textAnchor="middle" fontFamily="BVP" fontStyle="italic" fontSize={size} fill="none" stroke={INK} strokeWidth={size * .2} strokeLinejoin="round">{s}</text>
    <text x={0} y={size * .34} textAnchor="middle" fontFamily="BVP" fontStyle="italic" fontSize={size} fill={`url(#${id})`} stroke="#fff" strokeWidth={size * .05} paintOrder="stroke" strokeLinejoin="round">{s}</text>
  </g>;
};
