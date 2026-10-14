/**
 * The spaceship world's kit (universe six, uni6.tsx): its palette, Meb in crew gear, the walking note, the floor
 * patterns, the back wall, a window and the emergency button. Lifted out of uni6.tsx as they were, for the game's
 * world 6 (channel/game/src/shipview.tsx); uni6.tsx imports them back, so the film draws the same pixels.
 */
import React from 'react';
import {EYE, INK, MebVec, f2, hash} from './mebvec';
import type {FP} from './mebvec';

export const C = {space: '#070a1a', ink: '#141826', hull: '#dbe2ec', hullS: '#aab4c4', red: '#e8323f', yel: '#FFD44F', cyan: '#5ff2ff', green: '#3fd46f',
  blue: '#2f7fd6', orange: '#ff8a3d', wall: '#5b6886', wallD: '#4a5672', cap: '#262d40', fab: '#9a7cf0', panel: 'rgba(16,20,34,.84)'};

export const WALL = 250;   // the back wall's height

export const Harness: React.FC<{c: string}> = ({c}) => <g>
  {['M15.6 25.2 L17.4 33.2', 'M24.4 25.2 L22.6 33.2', 'M16.2 29 H23.8'].map(d => <g key={d}><path d={d} stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
    <path d={d} stroke={c} strokeWidth={1.3} strokeLinecap="round"/></g>)}
  <circle cx={20} cy={29} r={1.6} fill={c} stroke={INK} strokeWidth={.55}/>
</g>;
export const Antenna: React.FC<{c: string; f: number}> = ({c, f}) => <g>
  <path d="M20 5.4 V.9" stroke={INK} strokeWidth={.9} strokeLinecap="round"/>
  <path d="M17.7 5.9 Q20 3.9 22.3 5.9 Z" fill={c} stroke={INK} strokeWidth={.5} strokeLinejoin="round"/>
  <circle cx={20} cy={.5} r={1.4} fill={c} stroke={INK} strokeWidth={.5}/>
  <circle cx={19.6} cy={.1} r={.5} fill="#fff" opacity={.45 + .45 * Math.sin(f / 5)}/>
</g>;
/** Meb (or the ghost) in crew gear: a harness and an antenna, between the ears (MASCOT.md: two props, eyes and ears clear). */
export const Crew: React.FC<{id: string; x: number; y: number; k: number; p: FP; f: number; ghost?: boolean; flip?: boolean; o?: number; flash?: number}> = ({ghost, f, ...r}) => {
  const c = ghost ? '#a8d4ff' : C.yel;
  return <MebVec {...r} f={f} ghost={ghost} onBody={<Harness c={c}/>} onHead={<Antenna c={c} f={f}/>}/>;
};

export const NOTE_D = 'M-11 -34 H5 L11 -28 V-3 H-11 Z';
/** The impostor: a message, disguised in the crew's own antenna. Feet at (x, y); about 40 units tall.
 *  `paper` is the game's (one colour per file); the film never sets it. */
export const Note: React.FC<{x: number; y: number; k: number; f: number; look?: number; sus?: number; rot?: number; o?: number; shock?: boolean; paper?: string}> = ({x, y, k, f, look = 0, sus = 0, rot = 0, o = 1, shock, paper = '#fbf7ec'}) => {
  const bob = Math.sin(f / 7) * .4, blink = f % 70 < 3;
  return <g transform={`translate(${f2(x)} ${f2(y)}) rotate(${f2(rot)}) scale(${f2(k)})`} opacity={o}>
    <path d="M-5 -4 V0 M5 -4 V0" stroke={INK} strokeWidth={2.8} strokeLinecap="round"/><path d="M-5 -4 V0 M5 -4 V0" stroke="#fbf7ec" strokeWidth={1.4} strokeLinecap="round"/>
    <g transform={`translate(0 ${f2(bob)})`}>
      {sus > 0 && <path d={NOTE_D} fill="none" stroke={C.red} strokeWidth={4.5} opacity={sus * (.55 + .45 * Math.sin(f / 3))} strokeLinejoin="round"/>}
      <path d="M0 -34 V-39" stroke={INK} strokeWidth={.9}/><circle cx={0} cy={-39.6} r={1.4} fill={C.yel} stroke={INK} strokeWidth={.5}/>
      <path d={NOTE_D} fill={paper} stroke={INK} strokeWidth={1.1} strokeLinejoin="round"/>
      <path d="M5 -34 V-28 H11" fill="#e4dccb" stroke={INK} strokeWidth={.9} strokeLinejoin="round"/>
      {[-15, -11.8, -8.6, -5.4].map((yy, i) => <rect key={i} x={-8} y={yy} width={i === 3 ? 9 : 16} height={1.2} fill="#b9b1a4"/>)}
      {[-4.2, 4.2].map(ex => <g key={ex}>
        <ellipse cx={ex} cy={-24} rx={2.6} ry={blink ? .3 : shock ? 2.8 : 2.3} fill="#fff" stroke={INK} strokeWidth={.6}/>
        {!blink && <circle cx={ex + look * 1.2} cy={-23.5} r={shock ? .9 : 1.2} fill={EYE}/>}
        {!blink && !shock && <path d={`M${ex - 2.7} -24.3 A2.7 2.4 0 0 1 ${ex + 2.7} -24.3 Z`} fill="#e4dccb" stroke={INK} strokeWidth={.5}/>}
      </g>)}
      {shock ? <ellipse cx={0} cy={-18.6} rx={1.1} ry={1.4} fill={EYE}/> : <path d="M-2.4 -19 Q0 -18 2.4 -19.8" stroke={INK} strokeWidth={.7} fill="none" strokeLinecap="round"/>}
    </g>
  </g>;
};

export const MapDefs: React.FC = () => <defs>
  <pattern id="pCaf" width={140} height={140} patternUnits="userSpaceOnUse"><rect width={140} height={140} fill="#aab4c6"/><path d="M70 0 L140 70 L70 140 L0 70 Z" fill="#9da8bc"/>
    <path d="M0 0 H140 M0 0 V140" stroke="rgba(20,24,38,.14)" strokeWidth={3}/></pattern>
  <pattern id="pMed" width={90} height={90} patternUnits="userSpaceOnUse"><rect width={90} height={90} fill="#bcd5d5"/><path d="M0 0 H90 M0 0 V90" stroke="rgba(20,50,60,.16)" strokeWidth={4}/></pattern>
  <pattern id="pBr" width={180} height={180} patternUnits="userSpaceOnUse"><rect width={180} height={180} fill="#7f8ba2"/><rect x={5} y={5} width={170} height={170} rx={8} fill="#8d99b0"/>
    {[[18, 18], [162, 18], [18, 162], [162, 162]].map(([a, b]) => <circle key={a + '' + b} cx={a} cy={b} r={5} fill="#6c778e"/>)}</pattern>
  <pattern id="pHall" width={64} height={64} patternUnits="userSpaceOnUse"><rect width={64} height={64} fill="#7b879d"/>
    {[12, 32, 52].map(y => <rect key={y} x={8} y={y - 3} width={48} height={6} rx={3} fill="#626d83"/>)}</pattern>
  <pattern id="pHaz" width={36} height={36} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={36} height={36} fill={C.yel}/><rect width={18} height={36} fill="#1b1f2c"/></pattern>
  <pattern id="pWin" width={300} height={220} patternUnits="userSpaceOnUse"><rect width={300} height={220} fill="#0b1030"/>
    {[...Array(22)].map((_, i) => <circle key={i} cx={hash(i + 90) * 300} cy={hash(i + 40) * 220} r={1 + hash(i + 7) * 2.2} fill="#fff" opacity={.5 + .5 * hash(i)}/>)}</pattern>
</defs>;

/** The back wall: panels, rivets, a baseboard. Floor line at y. */
export const Face: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => <g>
  <rect x={x} y={y - WALL} width={w} height={WALL} fill={C.wall}/>
  {[...Array(Math.ceil(w / 160))].map((_, i) => {const px = x + i * 160, pw = Math.min(160, x + w - px); return <g key={i}>
    <rect x={px + 10} y={y - WALL + 30} width={Math.max(0, pw - 20)} height={WALL - 84} rx={8} fill="#63708f"/>
    <path d={`M${px} ${y - WALL} V${y}`} stroke="#46516b" strokeWidth={4}/>
    <circle cx={px + 20} cy={y - WALL + 16} r={4} fill="#46516b"/><circle cx={px + pw - 20} cy={y - WALL + 16} r={4} fill="#46516b"/></g>;})}
  <rect x={x} y={y - 38} width={w} height={38} fill={C.wallD}/><path d={`M${x} ${y - 38} H${x + w}`} stroke="#8490ab" strokeWidth={3}/>
  <path d={`M${x} ${y - WALL + 4} H${x + w}`} stroke="#7a87a4" strokeWidth={5}/>
  <rect x={x} y={y} width={w} height={22} fill="rgba(0,0,0,.16)"/>
</g>;

export const Window: React.FC<{x: number; y: number; w: number; h: number}> = ({x, y, w, h}) => <g>
  <rect x={x} y={y} width={w} height={h} rx={18} fill="url(#pWin)" stroke="#2b3246" strokeWidth={12}/>
  <path d={`M${x + w * .15} ${y + h} L${x + w * .45} ${y} H${x + w * .58} L${x + w * .28} ${y + h} Z`} fill="#fff" opacity={.08}/>
  <rect x={x} y={y} width={w} height={h} rx={18} fill="none" stroke="#8490ab" strokeWidth={3}/>
</g>;

export const Button: React.FC<{x: number; y: number; f: number; hot: number}> = ({x, y, f, hot}) => <g>
  <ellipse cx={x} cy={y + 6} rx={58} ry={28} fill="url(#pHaz)" stroke={C.ink} strokeWidth={5}/>
  <rect x={x - 36} y={y - 22} width={72} height={24} fill="#b3121f" stroke={C.ink} strokeWidth={4}/>
  <ellipse cx={x} cy={y - 22} rx={36} ry={15} fill={hot > 0 && Math.floor(f / 4) % 2 ? '#ff8a94' : '#ff4455'} stroke={C.ink} strokeWidth={4}/>
  <path d={`M${x - 52} ${y + 2} L${x - 40} ${y - 58} H${x + 40} L${x + 52} ${y + 2}`} fill="rgba(190,235,255,.2)" stroke="rgba(255,255,255,.75)" strokeWidth={4} strokeLinejoin="round"/>
</g>;
