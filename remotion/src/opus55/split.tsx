/** The Split: shared by every opus55 composition. Left = Opus 5 (faded), right = Opus 5.5, a rift between. */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BOLD, G, Grid, MONO, clamp, lerp, outBack, outC, seg} from '../meb-hatch/rig';
export const W = 1920, H = 1080, FPS = 30, HALF = 960, TEAR = 16;
export const NAVY = '#1f2a44', RED = '#d9482b', CREAM = '#f2e3c4', PAPER = '#fbf8f1', INKC = '#15131F';
export type Style = 'home' | 'print' | 'manga';
export const FADE: Record<Style, string> = {  // the Opus 5 universe: same place, older print
  home: 'grayscale(.6) sepia(.3) brightness(.96)', print: 'grayscale(.75) sepia(.45) contrast(.8) brightness(1.02)', manga: 'contrast(.55) brightness(1.12)'};

/* ---------- drawing helpers ---------- */
/** Meb's grid drawn with any palette; `tone` fills with a screentone. */
export const Px: React.FC<{px: Grid; x: number; y: number; scale: number; pal: Record<string, string>; flip?: boolean}> = ({px, x, y, scale, pal, flip}) => {
  const d: Record<string, string> = {};
  px.forEach((row, j) => row.forEach((k, i) => {if (k && pal[k]) d[k] = (d[k] || '') + `M${i} ${j}h1v1h-1z`;}));
  return <svg viewBox={`0 0 ${G} ${G}`} width={G * scale} height={G * scale} shapeRendering="crispEdges"
    style={{position: 'absolute', left: x, top: y, overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined}}>
    <defs><pattern id="tone" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".5" height=".5" fill="#fff"/><circle cx=".25" cy=".25" r=".11" fill="#000"/></pattern></defs>
    {Object.entries(d).map(([k, p]) => <path key={k} d={p} fill={pal[k]}/>)}
  </svg>;
};
/** Halftone Meb: every pixel becomes a dot, darker = bigger. */
export const DOT: Record<string, [number, string]> = {O: [.56, NAVY], E: [.56, NAVY], S: [.36, NAVY], L: [.2, NAVY], P: [.42, RED]};
export const BODY: Record<string, string> = {O: CREAM, E: CREAM, W: CREAM, L: CREAM, S: CREAM, P: CREAM};
export const Dots: React.FC<{px: Grid; x: number; y: number; scale: number}> = ({px, x, y, scale}) => <>
  <Px px={px} x={x} y={y} scale={scale} pal={BODY}/>
  <svg viewBox={`0 0 ${G} ${G}`} width={G * scale} height={G * scale} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
    {px.flatMap((row, j) => row.map((k, i) => k && DOT[k] ? <circle key={`${i},${j}`} cx={i + .5} cy={j + .5} r={DOT[k][0]} fill={DOT[k][1]}/> : null))}
  </svg></>;
/** Stroke that draws itself on between frames a and b. */
export const draw = (f: number, a: number, b: number) => ({pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - outC(seg(f, a, b))});
export const walk = (f: number) => ({armL: Math.sin(f / 3) * 28, armR: -Math.sin(f / 3) * 28, lift: Math.round(Math.abs(Math.sin(f / 3)) * 1.2)});

/* ---------- the split, the rift, the tear ---------- */
/** Draws `panel(u)` twice: u=0 left (faded), u=1 right. `over` is drawn in global coords in both, so it can cross the rift. */
export const Split: React.FC<{style: Style; panel: (u: 0 | 1) => React.ReactNode; over?: React.ReactNode; fade?: number}> = ({style, panel, over, fade}) => <>
  {([0, 1] as const).map(u => <AbsoluteFill key={u} style={{clipPath: u ? `inset(0 0 0 ${HALF}px)` : `inset(0 ${HALF}px 0 0)`, filter: u ? undefined : fade === undefined ? FADE[style] : `grayscale(${.6 * fade}) sepia(${.3 * fade}) brightness(${1 - .04 * fade})`}}>
    <div style={{position: 'absolute', left: u * HALF, top: 0, width: HALF, height: H, overflow: 'hidden'}}>{panel(u)}</div>
    {over}
    <div style={{position: 'absolute', left: u ? HALF + 28 : 28, bottom: 22, fontFamily: MONO, fontSize: 20, letterSpacing: '.18em',
      color: style === 'print' ? NAVY : '#000', opacity: .55}}>{u ? 'OPUS 5.5' : 'OPUS 5'}</div>
  </AbsoluteFill>)}
</>;
export const Rift: React.FC<{f: number; style: Style; draw?: number; amp?: number}> = ({f, style, draw: d = 1, amp = 1}) => {
  const pts = [...Array(40)].map((_, i) => {const y = -20 + i * 30; return `${HALF + (Math.sin(y * .02 + f * .15) * 6 + Math.sin(y * .07 - f * .3) * 3) * amp},${y}`;}).join(' ');
  const core = style === 'print' ? RED : style === 'manga' ? '#fff' : '#ffb938';
  return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
    <defs><clipPath id="rd"><rect x={0} y={0} width={W} height={H * d}/></clipPath><filter id="gl"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <g clipPath="url(#rd)" fill="none">
      {style === 'manga' && <polyline points={pts} stroke="#000" strokeWidth={26}/>}
      <polyline points={pts} stroke={core} strokeWidth={14} filter="url(#gl)" opacity={.9}/>
      <polyline points={pts} stroke={style === 'manga' ? '#fff' : '#fff8e0'} strokeWidth={3}/>
    </g></svg>;
};
/** The next place tears in through the rift: a jagged opening that widens to the whole frame. */
export const tearClip = (f: number) => {
  const w = outC(seg(f, 0, TEAR)) * 1150, jag = (y: number) => (((y * 7919) % 37) - 18) * Math.min(1, w / 60);
  const ys = [...Array(29)].map((_, i) => i * 40 - 20);
  return `polygon(${[...ys.map(y => `${HALF + w + jag(y)}px ${y}px`), ...ys.reverse().map(y => `${HALF - w - jag(y + 11)}px ${y}px`)].join(',')})`;
};

/* ---------- the changelog ---------- */
export type Entry = {at: number; minus?: string; plus: string};
export const Changelog: React.FC<{frame: number; style: Style; since: number; entries: Entry[]}> = ({frame, style, since, entries}) => {
  const o = outBack(seg(frame, since, since + 12));
  if (frame < since) return null;
  const skin: React.CSSProperties = style === 'print' ? {background: CREAM, border: `3px solid ${NAVY}`, color: NAVY, fontFamily: MONO}
    : style === 'manga' ? {background: '#fff', border: '5px solid #000', color: '#000', fontFamily: BOLD, fontStyle: 'italic', boxShadow: '6px 6px 0 #000'}
    : {background: '#fff', border: `2px solid ${INKC}`, color: INKC, fontFamily: MONO};
  return <div style={{position: 'absolute', left: 40, top: 26, display: 'flex', alignItems: 'center', gap: 22, padding: '12px 22px', borderRadius: style === 'manga' ? 0 : 10,
    fontSize: 28, transform: `translateY(${(1 - o) * -90}px)`, ...skin}}>
    <span style={{opacity: .6}}>opus-5 → opus-5.5</span>
    {entries.filter(e => frame >= e.at).map((e, i) => {const p = outBack(seg(frame, e.at, e.at + 10));
      return <span key={i} style={{transform: `scale(${lerp(.6, 1, p)})`, display: 'inline-block', opacity: clamp(p * 2)}}>
        {e.minus && <span style={{color: '#c0392b', textDecoration: 'line-through', marginRight: 12}}>− {e.minus}</span>}
        <span style={{color: '#1e9e55'}}>+ {e.plus}</span></span>;})}
  </div>;
};

/* ---------- 00 · home: the same job, twice ---------- */
export const Room: React.FC<{f: number; u: 0 | 1; E: number}> = ({f, u, E}) => {
  const fill = clamp(seg(f, 22, E) * (u ? 1 : 1 / 1.3));  // the same job; 5.5 finishes it 30% sooner
  return <>
    <AbsoluteFill style={{background: PAPER}}/>
    <svg width={HALF} height={H} style={{position: 'absolute'}}>
      <g fill="none" stroke={INKC} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 840 H920" {...draw(f, 0, 14)}/>
        <path d="M110 180 h190 v230 h-190 z M205 180 v230 M110 295 h190" {...draw(f, 4, 20)}/>
        <circle cx={760} cy={230} r={62} {...draw(f, 6, 20)}/>
        <path d="M250 640 h480 M280 640 v200 M700 640 v200" {...draw(f, 8, 22)}/>
        <path d="M330 390 h320 v210 h-320 z M490 600 v40 M430 640 h120" {...draw(f, 10, 24)}/>
      </g>
      <g stroke={INKC} strokeWidth={6} strokeLinecap="round" opacity={seg(f, 18, 22)}>
        <line x1={760} y1={230} x2={760 + Math.sin(fill * 6.28) * 44} y2={230 - Math.cos(fill * 6.28) * 44}/><line x1={760} y1={230} x2={790} y2={230}/></g>
      <rect x={360} y={480} width={260} height={24} rx={6} fill="none" stroke={INKC} strokeWidth={4} opacity={seg(f, 20, 24)}/>
      <rect x={364} y={484} width={252 * fill} height={16} rx={4} fill={fill >= 1 ? '#1e9e55' : INKC}/>
      {fill >= 1 && <text x={490} y={455} textAnchor="middle" fontFamily={MONO} fontSize={26} fill="#1e9e55">done ✓</text>}
    </svg>
  </>;
};
