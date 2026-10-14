/**
 * World 5, the court: the screen. The rules are court.ts; the look is the video's courtroom game
 * (remotion/src/opus55): its set in three.js (court3d.ts, as it is) and, drawn over it through the same camera, the
 * cast (courtkit.tsx): Meb the lawyer, the owl on the bench (THE READER, who stands for Claude) and, on the stand,
 * your own first draft: a second Meb in a nightcap, holding the sheet.
 * First the cards ("Law school"), once. Then the docket: pick a case. In court the draft reads itself out a line at a
 * time, and each line lands on the record. For the line on the stand you go on (→), shout WAIT! (W: it has to be said
 * better; then pick one of three cards) or OBJECTION! (O: it has to go). A shout cuts to Meb, then to the bench for the
 * ruling, as the genre does. When the record is clean you rest (R), and the verdict plays what the Reader did with
 * your words. This world has no model to pick: what changes is what you wrote.
 */
import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {DESK, SPOT, build} from '../../remotion/src/opus55/court3d';
import type {Box, Rig, V3} from '../../remotion/src/opus55/court3d';
import {Slam} from '../../remotion/src/opus55/chrome';
import {MebVec, f2, hash} from '../../remotion/src/opus55/mebvec';
import type {FP} from '../../remotion/src/opus55/mebvec';
import {BOLD, MONO, clamp, lerp, outC} from '../../remotion/src/meb-hatch/rig';
import {Tx} from '../../remotion/src/opus55/pixkit';
import {Lawyer, Owl, Shout as Bubble} from './courtkit';
import type {OwlFace} from './courtkit';
import {Btn, H, TOUCH, W} from './race';
import {Button, GOLD, Hit, INK, Icon, Keys, MUTE, Proof, Sheet, Star, Stars, TAP, UI, WORLD_BLUR, cap, outline, txt} from './ui';
import {DT, rng} from './rules';
import {BY, CASES, GOALS, MARKS, POST, STAMPS, botStep, leftOf, live, makeTrial, moveAt, newIn, pick, rest, shout, stars, tipOf} from './court';
import type {Bot, CEv, Case, Row, Shout, Stamp, Trial} from './court';
import {loop, sfx} from './sound';
import {ANIM, Count, Explain, In, Moves, markSeen, seen, useT} from './explain';
import type {Card} from './explain';

/* ---------- the set: the film's own shots, with the middle of the picture moved left to clear the record ---------- */
const CW = 1600, CH = 900;   // the canvas draws at this size and is stretched to the stage
const OFF = 320;             // the record covers the right third, so the scene's middle sits at x = 640
type Cam = {pos: V3; look: V3; fov: number};
const SHOTS: Record<'wit' | 'def' | 'judge' | 'wide', Cam> = {
  wit: {pos: [.4, 1.42, 2.5], look: [0, 1.75, -3.15], fov: 28},        // a step to the right, so the bench's nameplate clears the witness
  def: {pos: [-2.8, 1.65, 1.0], look: [-5.45, 1.45, -1.95], fov: 33},
  judge: {pos: [0, 2.3, -3.6], look: [0, 2.95, -7.25], fov: 46},      // from behind the stand, so the witness is never in it
  wide: {pos: [0, 3.3, 7.8], look: [0, 1.6, -4.5], fov: 50},           // behind the menus
};
const eye = new THREE.PerspectiveCamera(40, W / H, .05, 200), v3 = new THREE.Vector3();
eye.setViewOffset(W, H, OFF, 0, W, H);
const aim = (s: Cam) => {eye.position.set(...s.pos); eye.lookAt(...s.look); eye.fov = s.fov; eye.updateProjectionMatrix(); eye.updateMatrixWorld();};
const project = (p: V3) => {v3.set(...p).project(eye); return {x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H};};
const UNIT = 1.5 / 36.2;     // metres per rig cell: Meb stands 1.5 m
const LIFT = .81;            // the witness stands on a box: the stand's top comes to its waist, and the sheet shows
/** The witness stand with its cap (court3d draws the cap; DESK.witness is the box under it). */
const STAND: Box = {min: [-.83, .35, -2.84], max: [.83, 1.27, -2.26]};
/** Screen position of a point on the set and the rig scale there (px per cell). */
const at = (p: V3) => {const a = project(p), b = project([p[0], p[1] + 1, p[2]]); return {x: a.x, y: a.y, k: (a.y - b.y) * UNIT};};
/** The screen minus a desk's silhouette, so whoever is clipped by it stands behind the desk (the film's own trick). */
const behind = (b: Box) => {
  const c: {x: number; y: number}[] = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) c.push(project([x, y, z]));
  c.sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: typeof c[0], a: typeof c[0], b2: typeof c[0]) => (a.x - o.x) * (b2.y - o.y) - (a.y - o.y) * (b2.x - o.x);
  const half = (pts: typeof c) => {const h: typeof c = []; for (const p of pts) {while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p);} h.pop(); return h;};
  return `M-600 -600 H${W + 600} V${H + 600} H-600 Z M` + [...half(c), ...half([...c].reverse())].map(p => `${f2(p.x)} ${f2(p.y)}`).join(' L') + ' Z';
};

/* ---------- the witness: your first draft, a second Meb in a nightcap, holding the sheet ---------- */
const INKV = '#2A2540';
const Draft: React.FC<{id: string; x: number; y: number; k: number; p: FP; f: number}> = ({id, x, y, k, p, f}) =>
  <MebVec id={id} x={x} y={y} k={k} p={p} f={f}
    onBody={<g transform="rotate(-7 20 29)"><rect x={14.6} y={24.2} width={10.8} height={9.6} rx={.5} fill="#fbf7ec" stroke={INKV} strokeWidth={.6}/>
      {[26, 27.6, 29.2, 30.8].map((yy, i) => <rect key={yy} x={16} y={yy} width={i === 1 ? 5 : i === 3 ? 6.4 : 8} height={.7} fill={i === 1 ? '#e8a0a0' : '#9a938a'}/>)}
      <circle cx={23.6} cy={32} r={1.1} fill="none" stroke="#c9a37a" strokeWidth={.4}/></g>}
    onHead={<g>{/* between the ears, which stay clear (MASCOT.md) */}
      <path d="M14.8 6.1 Q15.4 -.6 21.4 -3.2 Q26.2 -4.8 29 -2.2 Q25.6 -2.2 25.3 6.1 Q20 3.3 14.8 6.1 Z" fill="#6f8fd8" stroke={INKV} strokeWidth={.8} strokeLinejoin="round"/>
      <path d="M17.2 2.2 Q20 .6 24.9 1.2 M19.3 -1.3 Q22 -2.4 26.2 -2" stroke="#4f6fb8" strokeWidth={.6} fill="none"/>
      <path d="M14.3 7 Q20 3.6 25.8 7 L25.7 5 Q20 1.7 14.4 5 Z" fill="#fff" stroke={INKV} strokeWidth={.7} strokeLinejoin="round"/>
      <circle cx={29.6} cy={-1.7} r={1.7} fill="#fff" stroke={INKV} strokeWidth={.7}/></g>}/>;
const POINT: FP = {face: 'shout', armR: 90, reachR: 1.9, armL: 25, tilt: 5, look: 1, ear: -6};   // the film's
const RESTS: FP = {face: 'happy', armR: 128, reachR: 1.3, armL: 18, ear: -8, look: .6};
const idle = (f: number, o: FP = {}): FP => {const b = Math.sin(f / 9); return {face: 'neutral', armL: 18 + b * 2, armR: 18 - b * 2, sy: 1 + b * .008, look: .8, ...o};};

/* ---------- the looks ---------- */
const ABS = (left: number, top: number, s: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left, top, ...s});
const col = (gap: number): React.CSSProperties => ({display: 'flex', flexDirection: 'column', alignItems: 'center', gap});
const SHOUT = (size: number, c = GOLD): React.CSSProperties => ({...txt(size, 700, c), textShadow: outline(INK, size / 20) + ',0 12px 0 #000', whiteSpace: 'nowrap', pointerEvents: 'none'});
const PAPER = '#fbf7ec', RED = '#c8243a', GREEN = '#157a43', BLUE = '#2f6fd6';
const MOVE_C: Record<Shout, string> = {wait: BLUE, object: RED};
/** A rule's name as a rubber stamp. */
const Ink: React.FC<{s: Stamp; size?: number; rot?: number; c?: string}> = ({s, size = 22, rot = -3, c}) =>
  <span style={{display: 'inline-block', flex: 'none', padding: `${size * .12}px ${size * .5}px`, border: `${Math.max(2, size * .12)}px solid`, borderRadius: size * .3, transform: `rotate(${rot}deg)`,
    fontFamily: BOLD, fontSize: size, letterSpacing: 1, whiteSpace: 'nowrap', color: c ?? MOVE_C[STAMPS[s].move], lineHeight: 1.15}}>{STAMPS[s].name}</span>;
/** The mono chip a Claude Code move is written in. */
const Code: React.FC<{s: string; size?: number}> = ({s, size = 28}) =>
  <span style={{flex: 'none', padding: '2px 16px', borderRadius: 10, background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: size, color: '#39ff88', whiteSpace: 'nowrap'}}>{s}</span>;

/* ---------- cases 3 and 4 build a game: its screens, drawn small (the exhibit, the cards, the verdict) ---------- */
const NIGHT = '#141a40';
const SKY = [[12, 9], [31, 22], [52, 6], [74, 30], [97, 12], [118, 26], [139, 8], [150, 40], [22, 44], [66, 50]];
/** mock: the title screen a friend drew (Exhibit A). words: a title screen built from "big pixel letters, night sky",
 *  which fits the words and is not the drawing. night, office: the rest of the game in its own look and in the default
 *  one (the guide's list: a cream background, pill-shaped buttons, 01/02/03 labels). grey: the next default along. */
const Screen: React.FC<{v: 'mock' | 'words' | 'night' | 'office'; w: number; grey?: boolean}> = ({v, w, grey}) => {
  const sky = (c: string) => SKY.map(([x, y], i) => <rect key={i} x={x} y={y} width={i % 3 ? 1 : 2} height={i % 3 ? 1 : 2} fill={c}/>);
  const cloud = (x: number, y: number) => <g fill="#fff"><rect x={x} y={y} width={26} height={6}/><rect x={x + 4} y={y - 3} width={10} height={3}/><rect x={x + 12} y={y - 5} width={9} height={5}/></g>;
  return <svg width={w} height={w * 9 / 16} viewBox="0 0 160 90" shapeRendering="crispEdges" style={{display: 'block', flex: 'none', borderRadius: w * .03, boxShadow: `0 0 0 ${Math.max(2, Math.round(w * .012))}px ${INKV}`}}>
    {v === 'mock' && <><rect width={160} height={90} fill={NIGHT}/>{sky('#fff')}
      <Tx s="CLOUD" x={80} y={9} k={3} c="#fff" out="#5b3fd0" align="c"/><Tx s="HOP" x={80} y={36} k={3} c="#ffd23f" out="#5b3fd0" align="c"/>
      {cloud(14, 80)}{cloud(64, 73)}{cloud(116, 66)}<rect x={22} y={68} width={7} height={9} fill="#f6e7c8" stroke={INKV} strokeWidth={1}/></>}
    {v === 'words' && <><rect width={160} height={90} fill="#3a1650"/>{sky('#ffb3ec')}<circle cx={122} cy={30} r={21} fill="#ffe9a8" shapeRendering="auto"/>
      <Tx s="CLOUD HOP" x={8} y={68} k={2} c="#ff7ad1" sh="#1a0b2a"/></>}
    {v === 'night' && <><rect width={160} height={90} fill={NIGHT}/>{sky('#fff')}<Tx s="LEVELS" x={80} y={12} k={2} c="#fff" out="#5b3fd0" align="c"/>
      {[0, 1, 2].map(i => <g key={i}><rect x={27 + i * 40} y={42} width={26} height={26} fill="#2a3a8a" stroke="#ffd23f" strokeWidth={2}/><Tx s={`${i + 1}`} x={40 + i * 40} y={48} k={2} c="#ffd23f" align="c"/></g>)}</>}
    {v === 'office' && <g shapeRendering="auto"><rect width={160} height={90} fill={grey ? '#e3e4e8' : '#f3ecdc'}/>
      <text x={14} y={24} fontFamily="Georgia, serif" fontStyle="italic" fontSize={13} fill="#3a3226">Levels</text><path d="M14 31 H146" stroke="#3a3226" strokeWidth={.6}/>
      {[0, 1, 2].map(i => <g key={i}><text x={18 + i * 46} y={48} fontFamily={MONO} fontSize={7} fill="#8a7f6c">0{i + 1}</text>
        <rect x={16 + i * 46} y={54} width={36} height={14} rx={7} fill="none" stroke="#3a3226" strokeWidth={1}/><text x={34 + i * 46} y={63.5} textAnchor="middle" fontFamily={UI} fontSize={7} fill="#3a3226">Start</text></g>)}</g>}
  </svg>;
};
/** Case 4's job, drawn: the last jump, too far; fixed, the far cloud has come closer. */
const Jump: React.FC<{fixed: boolean}> = ({fixed}) => <svg width={170} height={60} viewBox="0 0 170 60" style={{flex: 'none', overflow: 'visible'}}>
  <rect x={4} y={40} width={50} height={12} rx={6} fill="#fff" stroke={INKV} strokeWidth={3}/>
  <g style={{transition: 'transform .5s', transform: fixed ? 'translateX(-34px)' : 'none'}}><rect x={116} y={40} width={50} height={12} rx={6} fill="#fff" stroke={INKV} strokeWidth={3}/></g>
  <path d={fixed ? 'M30 34 Q68 -4 106 34' : 'M30 34 Q62 -2 96 50'} fill="none" stroke={fixed ? GREEN : RED} strokeWidth={4} strokeLinecap="round" strokeDasharray="1 9"/>
  <rect x={22} y={23} width={13} height={16} rx={3} fill="#f6e7c8" stroke={INKV} strokeWidth={3}/></svg>;

/* ---------- the cards it opens with (explain.tsx): every rule is a sentence from one of two Anthropic posts ---------- */
const TRACK = {x0: 150, x1: 1150};
/** A run along a track: a dot from x0 that stops at each of `stops` for `hold` s, then goes on to `end`. */
const Run: React.FC<{y: number; from: number; speed: number; stops: number[]; hold: number; end: number; c: string}> = ({y, from, speed, stops, hold, end, c}) => {
  const t = useT() - from; let x = TRACK.x0, left = Math.max(0, t), o = 1;
  for (const s of [...stops, end]) {const d = (s - x) / speed; if (left <= d) {x += left * speed; left = -1; break;} x = s; left -= d; if (s !== end) {if (left <= hold) {left = -1; break;} left -= hold;}}
  if (left > 0 && end > TRACK.x1) o = clamp(1 - left / .5);
  return t < 0 ? null : <g opacity={o}><circle cx={x} cy={y} r={22} fill={c} opacity={.3}/><circle cx={x} cy={y} r={12} fill="#fff"/></g>;
};
const Rail: React.FC<{y: number; label: string}> = ({y, label}) => <g>
  <path d={`M${TRACK.x0} ${y} H${TRACK.x1}`} stroke="rgba(255,255,255,.3)" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 18"/>
  <text x={TRACK.x0 - 20} y={y - 34} fontFamily={UI} fontWeight={700} fontSize={26} fill="#fff">{label}</text></g>;
const Flag: React.FC<{x: number; y: number; c: string}> = ({x, y, c}) => <g transform={`translate(${x} ${y})`}>
  <path d="M0 14 V-62" stroke="#fff" strokeWidth={6} strokeLinecap="round"/><path d="M3 -60 L52 -46 L3 -30 Z" fill={c} stroke={INK} strokeWidth={3} strokeLinejoin="round"/></g>;
const StopSign: React.FC<{x: number; y: number}> = ({x, y}) => <g transform={`translate(${x} ${y - 46})`}>
  <path d="M0 24 V46" stroke="#fff" strokeWidth={5}/><path d="M-9 -22 H9 L22 -9 V9 L9 22 H-9 L-22 9 V-9 Z" fill="#e8323f" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round"/>
  <path d="M-11 0 H11" stroke="#fff" strokeWidth={6} strokeLinecap="round"/></g>;
const CHIP: React.CSSProperties = {padding: '6px 24px', background: PAPER, border: `3px solid ${INK}`, borderRadius: 8};
const STEPS = [530, 660, 790, 920, 1050];   // all to the right of the label
const RULES10 = ['What the repo is for', 'The code is in src', 'One gotcha', 'Tests are in tests', 'ALWAYS think first', 'Never add comments', 'Add comments', 'Remember the gotcha!', 'Use TypeScript', 'It is a git repo'];
const KEPT = new Set([0, 2]);
const CARDS: Card[] = [
  {title: 'The Reader only gets your words', lines: ['Claude starts from *what you wrote*. The rest it has to *guess*.'], qAt: 3,
    quote: {text: 'Give the whole task in one message.', who: BY.guide, to: POST.guide},
    art: <LookArt/>},
  {title: 'Name the finish line', lines: ['Say what *done* looks like. Then it knows *when to stop*.'], qAt: 3.4,
    quote: {text: STAMPS.finish.quote, who: BY.guide, to: POST.guide},
    art: <svg width={1300} height={300} style={{overflow: 'visible'}}>
      <In g at={.6} how="left"><Rail y={80} label="Make sure it all works."/></In><Run y={80} from={1} speed={520} stops={[]} hold={0} end={1250} c="#ff8a7a"/>
      <In g at={3.1} snd="buzz" vol={.15}><text x={1270} y={98} fontFamily={UI} fontWeight={700} fontSize={54} fill="#ff8a7a">?</text></In>
      <In g at={.9} how="left"><Rail y={230} label="Done means: the tests pass."/></In><In g at={1.5} how="drop" snd="land" vol={.2}><Flag x={900} y={230} c={GOLD}/></In>
      <Run y={230} from={2.1} speed={520} stops={[]} hold={0} end={900} c={GOLD}/>
      <In g at={3.6} how="slam" snd="check" vol={.25}><g transform="translate(980 222)"><circle r={26} fill="#1f9e55" stroke="#fff" strokeWidth={4}/><path d="M-12 1 L-3 10 L13 -9" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round"/></g></In></svg>},
  {title: 'Say when to stop', lines: ['One stop, *before anything destructive*. Everything else, it just does.'], qAt: 4.4,
    quote: {text: STAMPS.stop.quote, who: BY.guide, to: POST.guide},
    art: <svg width={1300} height={300} style={{overflow: 'visible'}}>
      <In g at={.6} how="left"><Rail y={80} label="Ask me before every step."/></In>
      {STEPS.map((x, i) => <In key={x} g at={.8 + i * .1} snd="pop" vol={.1}><StopSign x={x} y={80}/></In>)}<Run y={80} from={1.5} speed={520} stops={STEPS.map(x => x - 34)} hold={.45} end={1150} c="#ff8a7a"/>
      <In g at={1} how="left"><Rail y={230} label="Stop and ask only before anything destructive."/></In>
      <In g at={1.3} snd="pop" vol={.1}><StopSign x={1050} y={230}/></In><In g at={1.4} how="up"><text x={1050} y={278} textAnchor="middle" fontFamily={UI} fontWeight={700} fontSize={24} fill="#ff8a7a">deleting data</text></In>
      <Run y={230} from={1.5} speed={520} stops={[]} hold={0} end={1016} c={GOLD}/></svg>},
  {title: 'It already thinks', lines: ['Delete *"think carefully"* lines. Anthropic found replies then *start sooner*.'], qAt: 2.8,
    quote: {text: STAMPS.thinks.quote, who: BY.guide, to: POST.guide},
    art: <ThinkArt/>},
  {title: 'Fewer orders, better work', lines: ['Anthropic cut *over 80%* of Claude Code\'s own system prompt.'], qAt: 3.4,
    quote: {text: 'with no measurable loss on our coding evaluations', who: BY.context, to: POST.context},
    art: <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 22px'}}>{RULES10.map((r, i) => {const cut = !KEPT.has(i), n = RULES10.slice(0, i).filter((_, j) => !KEPT.has(j)).length;
        return <In key={r} at={.5 + i * .06} how="left"><div style={{position: 'relative', width: 380, padding: '8px 18px', borderRadius: 10, background: PAPER, ...txt(26, 700, INK)}}>{r}
          {cut && <In at={1.3 + n * .2} how="left" snd="tick" vol={.15} style={{position: 'absolute', left: 8, right: 8, top: '50%', height: 5, marginTop: -2, borderRadius: 3, background: RED}}><span/></In>}</div></In>;})}</div>
      <div style={col(18)}><In at={1.3}><div style={txt(150, 700, GOLD)}><Count to={80} at={1.4}/>%</div></In>
        <In at={3} how="up"><div style={{display: 'flex', alignItems: 'center', gap: 14, ...txt(28, 500, MUTE)}}>on your own files: <Code s="/doctor" size={30}/></div></In></div></div>},
  {title: 'In court, and in Claude Code', lines: ['A line to *say better*: WAIT! A line that *has to go*: OBJECTION! *Five* wrong shouts and the case is thrown out.'],
    art: <Moves chip={CHIP} at={.9} rows={[['WAIT!', 'Done means: the tests pass.', 'add what was missing'], ['OBJECTION!', '', 'delete the line'],
      ['The house rules', 'CLAUDE.md', 'keep it short. /doctor trims it'], ['Rest your case', 'Enter', 'send it, then let it work']]}/>},
];
/** Card 1: Meb hands over a sheet; two things he knows stay in his head; the owl reads, and has to guess. */
function LookArt() {
  const t = useT(), fr = t * 30, u = clamp((t - 1.4) / .9), e = u * u * (3 - 2 * u), sx = 330 + 560 * e, guess = t > 2.6;
  return <svg width={1300} height={340} style={{overflow: 'visible'}}>
    <In g at={.5}><Lawyer id="c1m" x={170} y={330} k={6.2} p={idle(fr, {armR: u > 0 && u < 1 ? 70 : 18, look: 1})} f={fr}/></In>
    {['what done looks like', 'when to stop and ask'].map((s, i) => <In key={s} g at={.8 + i * .25} snd="pop" vol={.12}><g transform={`translate(${290 + i * 40} ${46 + i * 72})`} opacity={.55}>
      <rect x={0} y={-30} width={330} height={52} rx={26} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="8 8"/><text x={165} y={4} textAnchor="middle" fontFamily={UI} fontWeight={700} fontSize={24} fill="#fff">{s}</text>
      <circle cx={-14} cy={30} r={6} fill="none" stroke="#fff" strokeWidth={3}/></g></In>)}
    <In g at={1.2} snd="paper" vol={.2}><g transform={`translate(${f2(sx)} ${f2(250 - Math.sin(e * Math.PI) * 30)}) rotate(${f2(-8 + e * 8)})`}>
      <rect x={-46} y={-60} width={92} height={120} rx={5} fill={PAPER} stroke={INKV} strokeWidth={4}/>{[-36, -18, 0, 18].map(yy => <rect key={yy} x={-32} y={yy} width={yy === 18 ? 40 : 64} height={7} fill="#9a938a"/>)}</g></In>
    <In g at={.6}><Owl x={1090} y={300} k={6} f={fr} ga={9} face={guess ? 'squint' : u >= 1 ? 'read' : 'stern'} look={u >= 1 ? -.6 : -1} lookY={u >= 1 ? .5 : 0}/></In>
    {[0, 1].map(i => <In key={i} g at={2.7 + i * .25} how="drop" snd="pop" vol={.15}><text x={1010 + i * 150} y={40 + i * 26} fontFamily={UI} fontWeight={700} fontSize={70} fill={GOLD} stroke={INK} strokeWidth={6} paintOrder="stroke">?</text></In>)}
  </svg>;
}
/** Card 4: the line is struck from a request, and the reply starts sooner. */
function ThinkArt() {
  const t = useT(), cut = clamp((t - 1.3) / .35), go = clamp((t - 1.9) / .5);
  return <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
    <In at={.5} how="left"><div style={{position: 'relative', padding: '22px 30px', borderRadius: 14, background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 32, lineHeight: 1.7, color: '#39ff88'}}>
      <div>Fix the login bug.</div><div style={{position: 'relative', display: 'inline-block', color: cut >= 1 ? '#5c7a68' : '#39ff88'}}>Think step by step.
        <div style={{position: 'absolute', left: -6, top: '52%', height: 5, borderRadius: 3, background: '#ff5a6e', width: `calc(${cut * 100}% + ${cut * 12}px)`}}/></div>
      <div>Done means: the tests pass.</div></div></In>
    <In at={1.3} snd="rip" vol={.2}><Icon name="arrow" size={64}/></In>
    <div style={col(16)}>{([['With the line', 1, '#ff8a7a'], ['Without it', 1 - .45 * go, '#6ef2a0']] as [string, number, string][]).map(([w, k, c], i) =>
      <In key={w} at={1.5 + i * .25} how="left"><div style={{display: 'flex', alignItems: 'center', gap: 16, width: 520}}><span style={{...txt(26, 700), width: 190}}>{w}</span>
        <div style={{color: c, display: 'flex'}}><Icon name="clock" size={40}/></div><div style={{height: 26, borderRadius: 13, background: c, width: 250 * k}}/></div></In>)}
      <In at={2.5} how="up"><div style={txt(26, 500, MUTE)}>the wait before the reply starts (a picture, not a measurement)</div></In></div>
  </div>;
}

/* ---------- two more cards before case 3 and before case 4, the first time each is taken (PLAN-court-3-4.md):
   their rules used to arrive with a stamp and no card ---------- */
const SLIP: React.CSSProperties = {...CHIP, ...txt(28, 700, INK), boxSizing: 'border-box'}, ROW: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: 30};
const CASE_CARDS: Record<string, Card[]> = {
  c3: [
    {title: 'Name what you don\'t want', lines: ['*"Not generic"* only swaps one default look for another. *List* what to leave out.'], qAt: 4.6,
      quote: {text: STAMPS.name.quote, who: BY.guide, to: POST.guide}, art: <NameArt/>},
    {title: 'If it exists, show it', lines: ['A description is a *guess*. *@mockup.html* points at *the file itself*.'], qAt: 3.9,
      quote: {text: STAMPS.show.quote, who: BY.context, to: POST.context}, art: <ShowArt/>}],
  c4: [
    {title: 'It reads these before every job', lines: ['*CLAUDE.md* is a notes file. Claude reads *all of it* before *every job*, even a tiny one.'], qAt: 4.2,
      quote: {text: 'spend most of the tokens on gotchas inside of the codebase', who: BY.context, to: POST.context}, art: <PileArt/>},
    {title: 'Point to it', lines: ['Move a long how-to into a *skill*: a how-to that opens *only when it is needed*.'], qAt: 3.6,
      quote: {text: STAMPS.point.quote, who: BY.context, to: POST.context}, art: <SkillArt/>}],
};
const caseKey = (c: Case) => `${HOW_KEY}.${c.id}`;
/** Case 3, card 1: "not generic" swaps cream for grey; a list of what to leave out gets the game its own look. */
function NameArt() {
  return <div style={{...col(30), alignItems: 'flex-start'}}>
    <div style={ROW}><In at={.6} how="left"><div style={{...SLIP, width: 400}}>Avoid a generic look.</div></In><In at={1} how="left"><Icon name="arrow" size={48}/></In>
      <In at={1.3} how="drop" snd="land" vol={.2}><Screen v="office" w={250}/></In><In at={1.9}><div style={{color: '#ff8a7a', display: 'flex'}}><Icon name="retry" size={44} w={2.6}/></div></In>
      <In at={2.2} how="drop" snd="buzz" vol={.15}><Screen v="office" grey w={250}/></In></div>
    <div style={ROW}><div style={{...col(8), alignItems: 'stretch', width: 400}}>{['No cream background', 'No pill-shaped buttons', 'No 01/02/03 labels'].map((s, i) =>
        <In key={s} at={2.9 + i * .2} how="left" snd="tick" vol={.15}><div style={{...SLIP, padding: '3px 20px', fontSize: 25}}>{s}</div></In>)}</div>
      <In at={3.5} how="left"><Icon name="arrow" size={48}/></In><In at={3.8} how="drop" snd="check" vol={.25}><Screen v="night" w={250}/></In></div>
  </div>;
}
/** Case 3, card 2: the same drawing, described and pointed at. */
function ShowArt() {
  const mark = (ok: boolean, at: number) => <In at={at}><div style={{color: ok ? '#6ef2a0' : '#ff5a6e', display: 'flex'}}><Icon name={ok ? 'check' : 'cross'} size={48} w={3.4}/></div></In>;
  return <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
    <In at={.5} snd="paper" vol={.2}><div style={col(10)}><Screen v="mock" w={380}/><span style={txt(26, 500, MUTE)}>your friend's drawing</span></div></In>
    <div style={{...col(26), alignItems: 'flex-start'}}>
      <div style={ROW}><In at={1.1} how="left"><div style={{...SLIP, width: 420}}>big pixel letters, night sky</div></In><In at={1.4} how="left"><Icon name="arrow" size={48}/></In>
        <In at={1.7} how="drop" snd="buzz" vol={.15}><Screen v="words" w={230}/></In>{mark(false, 2)}</div>
      <div style={ROW}><In at={2.5} how="left"><div style={{width: 420, display: 'flex'}}><Code s="@mockup.html" size={32}/></div></In><In at={2.8} how="left"><Icon name="arrow" size={48}/></In>
        <In at={3.1} how="drop" snd="check" vol={.25}><Screen v="mock" w={230}/></In>{mark(true, 3.4)}</div></div>
  </div>;
}
/** Case 4, card 1: the same pile of notes before every job, however small; then the notes that can go, going. */
const PILE_CUT = new Set([1, 4, 6]);   // one it can see for itself, one half of a clash, one said twice
function PileArt() {
  const cut = useT() > 3.3;
  return <div style={{display: 'flex', gap: 80}}>{['Fix one jump', 'Add a coin', 'Rename a level'].map((job, c) => <div key={job} style={col(16)}>
    <In at={.6 + c * .7} how="drop" snd="paper" vol={.2}><div style={col(6)}>{[...Array(9)].map((_, i) => {const out = PILE_CUT.has(i);
      return <div key={i} style={{width: 330, height: 20, borderRadius: 5, background: out ? '#f3b4b4' : PAPER, opacity: out && cut ? .22 : 1, transition: 'opacity .4s', display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box'}}>
        <div style={{height: 5, borderRadius: 3, width: `${45 + hash(i + 3) * 50}%`, background: out ? RED : '#9a938a'}}/></div>;})}</div></In>
    <In at={1 + c * .7} how="up"><div style={{...SLIP, padding: '4px 22px'}}>{job}</div></In></div>)}
    <In at={3.3} snd="rip" vol={.2}><span/></In></div>;
}
/** Case 4, card 2: the long how-to folds out of the notes into a skill; one line stays behind, pointing at it. */
function SkillArt() {
  const u = clamp((useT() - 1.7) / .6), e = u * u * (3 - 2 * u);
  const bar = (i: number, w: number, c = '#9a938a') => <div key={i} style={{height: 11, width: `${w}%`, borderRadius: 6, background: c, marginBottom: 11}}/>;
  return <div style={{display: 'flex', gap: 56, alignItems: 'center'}}>
    <In at={.5} how="left"><div style={{width: 560, boxSizing: 'border-box', padding: '16px 22px 8px', borderRadius: 12, background: PAPER, border: `4px solid ${INKV}`}}>
      <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 20, letterSpacing: 2, color: '#8a8478', marginBottom: 12}}>CLAUDE.md</div>{bar(0, 82)}{bar(1, 64)}
      <div style={{height: lerp(176, 46, e), overflow: 'hidden', borderRadius: 8, marginBottom: 11, padding: '9px 12px 0', boxSizing: 'border-box', background: u >= 1 ? '#d6f5e1' : '#f8d9d9'}}>
        {u >= 1 ? <div style={txt(21, 700, GREEN)}>Before you finish, use the playtest skill.</div> : [...Array(8)].map((_, i) => bar(i, 55 + hash(i) * 42, '#d08c8c'))}</div>{bar(2, 72)}</div></In>
    <In at={1.7} snd="swish" vol={.2}><Icon name="arrow" size={64}/></In>
    <In at={2.3} how="slam" snd="stamp" vol={.25}><div style={col(14)}>
      <div style={{width: 300, boxSizing: 'border-box', padding: '14px 18px 4px', borderRadius: 12, background: '#0b1310', border: '2px solid #39ff88'}}>
        <div style={{fontFamily: MONO, fontSize: 26, color: '#39ff88', marginBottom: 12}}>playtest skill</div>{[...Array(5)].map((_, i) => bar(i, 55 + hash(i) * 42, '#2f7a52'))}</div>
      <span style={txt(26, 500, MUTE)}>opens only when it is needed</span></div></In>
  </div>;
}

/* ---------- the game around the rules ---------- */
// Seconds on Meb, and on Meb when he rests; letters a second. The bench's ruling is the lesson, so it stays until the
// player taps (it left by itself after 1.7 s, and the user found that too fast to read); RULE is how long the test bot reads it.
const CUT = 1.1, RULE = 1.7, REST_HOLD = 1.6, CPS = 45;
type Ev = {ok: boolean; m: Shout | null; stamp?: Stamp; why: string; t0: number; cards: boolean; banged?: boolean; read?: boolean};
type G = {
  t: Trial; phase: 'docket' | 'play' | 'verdict'; clock: number; endT: number;
  at: number; read: number; lineT: number;   // the row on the stand, how many rows have been read out, when this one began
  ev: Ev | null; hitT: number; restT: number; shake: number; bot: Bot | null;
  start: () => void; go: (d: number) => void; jump: (r: number) => void; shout: (m: Shout) => void; card: (n: number) => void; rest: () => void;
};
/** Where a shout is in its little scene: Meb shouting, the bench ruling, or over. */
const stageOf = (g: G): 'meb' | 'bench' | null => {
  const e = g.ev; if (!e) return null;
  const u = g.clock - e.t0, cut = e.m ? CUT : 0;
  return u < cut ? 'meb' : !e.cards && !e.read ? 'bench' : null;
};
const shotOf = (g: G): keyof typeof SHOTS => {const s = stageOf(g); return g.phase !== 'play' ? 'wide' : g.restT >= 0 || s === 'meb' ? 'def' : s === 'bench' ? 'judge' : 'wit';};
const HOW_KEY = 'pym3.courthow';   // set once the cards have been read or skipped
export const caseBest = (best: Record<string, number>, c: Case) => best[c.id] ?? 0;

let picked = 0;   // the case you picked, kept while the page is open
export const Court: React.FC<{best: Record<string, number>; onEnd: (key: string, stars: number) => void; onQuit: () => void}> = ({best, onEnd, onQuit}) => {
  // the cards that are up: law school (once, and from the docket's help), or the two a case brings the first time it is taken
  const canvas = useRef<HTMLCanvasElement>(null), [, setTick] = useState(0), [run, setRun] = useState(0), [si, setSi] = useState(picked), [how, setHow] = useState<'school' | 'case' | null>(() => seen(HOW_KEY) ? null : 'school');
  const ref = useRef<G | null>(null), rigRef = useRef<Rig | null>(null), brief = useRef(true), howOn = useRef(!!how); howOn.current = !!how;
  const fresh = (c: Case) => !!CASE_CARDS[c.id] && !seen(caseKey(c));
  const take = useRef(() => {}); take.current = () => {if (fresh(CASES[si])) setHow('case'); else ref.current?.start();};
  const ended = useRef(onEnd); ended.current = onEnd;
  const quit = useRef(onQuit); quit.current = onQuit;
  const choose = (n: number) => {const k = Math.max(0, Math.min(CASES.length - 1, n)); if (k !== si) {sfx('select', .3); setSi(picked = k);}};
  const again = (docket: boolean, next = false) => {brief.current = docket; if (next) setSi(picked = Math.min(CASES.length - 1, si + 1)); setRun(r => r + 1);};

  useEffect(() => {   // the courtroom is built once and kept across cases
    const rig = rigRef.current = build(canvas.current!, CW, CH);
    rig.camera.setViewOffset(CW, CH, OFF * CW / W, 0, CW, CH);
    return () => {loop('bed-docket.mp3', 0); canvas.current?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();};
  }, []);

  useEffect(() => {
    const t = makeTrial(CASES[si], 1 + Math.floor(Math.random() * 1e6)), rnd = rng(t.seed);
    const cards = !brief.current && fresh(t.c);   // "Next case" lands here with no docket: the case waits behind its cards
    if (cards) setHow('case');
    const g: G = {t, phase: brief.current || cards ? 'docket' : 'play', clock: 0, endT: 0, at: 0, read: 1, lineT: 0, ev: null, hitT: -9, restT: -1, shake: 0, bot: null,
      start: () => {}, go: () => {}, jump: () => {}, shout: () => {}, card: () => {}, rest: () => {}};
    ref.current = g;
    let stage: ReturnType<typeof stageOf> = null, blip = -1;
    const busy = () => stageOf(g) !== null || g.restT >= 0 || g.t.end;
    const begin = () => {loop('bed-docket.mp3', 0); loop('bed-court.mp3', .1); g.lineT = g.clock + .4; sfx('gavel', .4);};
    const say = (e: CEv | null, m: Shout | null) => {
      if (!e) return;
      g.ev = {ok: e.k !== 'wrong' && e.k !== 'dismissed', m, stamp: e.stamp, why: e.why, t0: g.clock, cards: e.k === 'cards'};
      if (m) {sfx('shout', .35); sfx('deskslam', .3); g.shake = .3;}
    };
    const finish = () => {
      const n = stars(t).filter(Boolean).length;
      g.phase = 'verdict'; g.endT = g.clock; loop('bed-court.mp3', 0); loop('bed-docket.mp3', .1);
      sfx(t.dismissed ? 'fail' : n === 3 ? 'victory' : 'verdict', .4); ended.current(t.c.id, n);
    };
    g.start = () => {if (g.phase !== 'docket') return; brief.current = false; g.phase = 'play'; begin();};
    g.go = d => {
      if (g.phase !== 'play') return;
      const st = stageOf(g);   // before the "case is over" test: a DISMISSED ruling ends the case and still waits for its tap
      if (g.ev && st) {if (st === 'meb') g.ev.t0 = g.clock - CUT; else g.ev.read = true; return;}   // a tap cuts Meb short; the ruling waits for one
      if (t.end || g.restT >= 0 || t.picking !== null) return;
      const n = g.at + d;
      if (n < 0 || n >= t.rows.length) return;
      if (n >= g.read) {g.read = n + 1; g.lineT = g.clock; sfx('paper', .2);} else g.lineT = -99;
      g.at = n;
    };
    g.jump = r => {if (g.phase === 'play' && !busy() && t.picking === null && r < g.read && r !== g.at) {g.at = r; g.lineT = -99; sfx('blip', .2);}};
    g.shout = m => {
      if (g.phase !== 'play' || busy() || t.picking !== null) return;
      if (t.rows[g.at].st !== 'raw') {sfx('buzz', .12); return;}
      g.lineT = -99; say(shout(t, g.at, m, g.read), m);   // half of a pair is fine until its other half has been read out
    };
    g.card = n => {if (g.phase === 'play' && !busy() && t.picking !== null) say(pick(t, n), null);};
    g.rest = () => {if (g.phase !== 'play' || busy() || t.picking !== null || g.read < t.rows.length) return; rest(t); g.restT = g.clock; sfx('deskslam', .3); g.shake = .2;};
    const step = () => {
      g.clock += DT; g.shake = Math.max(0, g.shake - DT);
      if (g.phase !== 'play') return;
      const e = g.ev, st = stageOf(g), row = t.rows[g.at], n = Math.floor((g.clock - g.lineT) * CPS);
      if (st === null && !e && n >= 0 && n < row.text.length && n % 3 === 0 && n !== blip) {blip = n; sfx('talk', .1);}   // the draft talks
      if (e && st === 'bench') {
        if (stage !== 'bench') sfx(e.ok ? 'stamp' : 'swish', .3);
        if (!e.ok && !e.banged && g.clock - e.t0 - (e.m ? CUT : 0) >= .2) {e.banged = true; sfx('gavel', .45); g.shake = .35;}
        if (g.bot && g.clock - e.t0 - (e.m ? CUT : 0) > RULE) e.read = true;   // the test bot has no hand to tap with
      }
      if (e && st === null) {   // the scene is over
        g.ev = null;
        if (t.dismissed) return finish();
        if (e.ok && !e.cards) {g.hitT = g.clock; if (g.at < t.rows.length - 1 && g.at + 1 >= g.read) g.go(1);}
        if (e.cards) sfx('present', .25);
      }
      stage = st;
      if (g.restT >= 0 && g.clock - g.restT > REST_HOLD) return finish();
      if (g.bot && !busy()) {   // the test bot: hears the whole draft at once, then plays court.ts's bot
        g.read = t.rows.length;
        const a = botStep(t, g.bot, rnd);
        if (!a) g.rest(); else if ('card' in a) g.card(a.card); else {g.at = a.r; g.lineT = -99; g.shout(a.m);}
      }
    };
    const kd = (e: KeyboardEvent) => {
      if (howOn.current) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (e.repeat) return;
      if (g.phase === 'docket') {
        if (k === 'enter' || k === ' ') take.current(); if (k === 'escape') quit.current(); if (k === 'h') setHow('school');
        if (k >= '1' && k <= String(CASES.length)) choose(+k - 1);
        if (k === 'arrowleft' || k === 'arrowright') choose(si + (k === 'arrowleft' ? -1 : 1));
        return;
      }
      if (g.phase === 'verdict') {
        if (k === 'enter' || k === ' ') again(false, stars(t).some(Boolean) && si < CASES.length - 1); if (k === 'a') again(false); if (k === 'd' || k === 'c') again(true);
        if (k === 'escape' || k === 'l') quit.current(); return;
      }
      if (k === 'arrowright' || k === 'enter' || k === ' ') g.go(1);
      if (k === 'arrowleft') g.go(-1);
      if (k === 'w') g.shout('wait');
      if (k === 'o') g.shout('object');
      if (k === 'r') g.rest();
      if (k >= '1' && k <= '3' && t.picking !== null) g.card(t.rows[t.picking].cards[+k - 1]);
      if (k === 'escape') quit.current();
    };
    addEventListener('keydown', kd);
    if (g.phase === 'play') begin(); else loop('bed-docket.mp3', .1);   // the docket's theme; a new pick only sets its volume
    let drawn = '';   // the set stands still: it is drawn once per shot
    const draw = () => {const s = shotOf(g); if (s !== drawn) {rigRef.current?.render({f: 0, cam: SHOTS[s]}); drawn = s;} setTick(n => n + 1);};
    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      acc += Math.min(.1, (now - last) / 1000); last = now;
      while (acc >= DT) {acc -= DT; step();}
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    draw();
    // ponytail: the rally's test hook, for a hidden browser (no animation frames there); only with #test in the address.
    // F9 runs 2 s, F10 runs 10 s, F6 runs 0.2 s, F7 hands the case to a bot (reader, objector, off);
    // the state lands in document.body.dataset.pym
    const hook = (e: KeyboardEvent) => {
      const s = e.key === 'F9' ? 2 : e.key === 'F10' ? 10 : e.key === 'F6' ? .2 : 0;
      if (e.key === 'F7') g.bot = g.bot === null ? 'reader' : g.bot === 'reader' ? 'objector' : null;
      for (let i = 0; i < s / DT; i++) step();
      draw();
      document.body.dataset.pym = JSON.stringify({world: 'court', case: t.c.id, phase: g.phase, how: howOn.current, bot: g.bot, shot: shotOf(g), at: g.at, read: g.read, rows: t.rows.length,
        line: t.rows[g.at].text, move: moveAt(t, g.at, g.read), st: t.rows.map(r => r.st[0]).join(''), picking: t.picking, marks: t.marks, wrong: t.wrong, left: leftOf(t),
        end: t.end, dismissed: t.dismissed, stars: stars(t), tip: tipOf(t)});
    };
    if (location.hash === '#test') addEventListener('keyup', hook);
    return () => {cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', hook); loop('bed-court.mp3', 0); ref.current = null;};
  }, [run, si]);

  const g = ref.current, sh = g && g.shake > 0 ? [(hash(Math.floor(g.clock * 60)) - .5) * g.shake * 46, (hash(Math.floor(g.clock * 60) + 9) - .5) * g.shake * 46] : [0, 0];
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#2a1a10', userSelect: 'none', touchAction: 'none'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sh[0].toFixed(1)}px, ${sh[1].toFixed(1)}px) scale(1.02)`, ...(g && g.phase !== 'play' ? WORLD_BLUR : {})}}>
      <canvas ref={canvas} width={CW} height={CH} style={{position: 'absolute', inset: 0, width: W, height: H}}/>
      {g && g.phase === 'play' && <Scene g={g}/>}
    </div>
    {g && g.phase === 'play' && <Hud g={g} quit={onQuit}/>}
    {g && g.phase === 'docket' && !how && <Docket si={si} best={best} t={g.clock} choose={choose} start={() => take.current()} back={onQuit} how={() => setHow('school')}/>}
    {g && g.phase === 'verdict' && <Verdict g={g} last={si === CASES.length - 1} again={again}/>}
    {how === 'school' && <Explain tag="Law school" cards={[...CARDS, ...(CASE_CARDS[CASES[si].id] ?? [])]} last="The docket" done={() => {markSeen(HOW_KEY); setHow(null);}}/>}
    {how === 'case' && <Explain tag={cap(CASES[si].name)} cards={CASE_CARDS[CASES[si].id]} last="To court" done={() => {markSeen(caseKey(CASES[si])); setHow(null); ref.current?.start();}}/>}
  </div>;
};

/* ---------- the courtroom: whoever the shot is on ---------- */
const Scene: React.FC<{g: G}> = ({g}) => {
  const shot = shotOf(g), t = g.clock, fr = t * 30, e = g.ev, tr = g.t;
  aim(SHOTS[shot]);
  let who: React.ReactNode = null;
  if (shot === 'wit') {
    const row = tr.rows[g.at], typing = (t - g.lineT) * CPS < row.text.length && t >= g.lineT, hit = t - g.hitT < .8, clean = g.read === tr.rows.length && !leftOf(tr).length;
    const p: FP = hit ? {face: 'shocked', armL: 58, armR: 58, sweat: true, ear: 14, tilt: -4 * (1 - (t - g.hitT) / .8)}
      : {face: typing && Math.floor(fr / 4) % 2 === 0 ? 'shout' : clean ? 'happy' : Math.floor(fr / 70) % 2 && fr % 70 < 5 ? 'blink' : 'neutral', armL: 30, armR: 30, sy: 1 + Math.sin(fr / 9) * .008, look: 0};
    const q = at([SPOT.witness[0], SPOT.witness[1] + LIFT, SPOT.witness[2]]);
    who = <g><clipPath id="cw"><path d={behind(STAND)} clipRule="evenodd"/></clipPath><g clipPath="url(#cw)"><Draft id="wd" x={q.x} y={q.y} k={q.k} p={p} f={fr}/></g></g>;
  } else if (shot === 'def') {
    const q = at(SPOT.meb);
    who = <g><clipPath id="cm"><path d={behind(DESK.defense)} clipRule="evenodd"/></clipPath><g clipPath="url(#cm)"><Lawyer id="mb" x={q.x} y={q.y} k={q.k} p={g.restT >= 0 ? RESTS : POINT} f={fr}/></g>
      {e?.m && <Bubble s={e.m === 'wait' ? 'WAIT!' : 'OBJECTION!'} x={W / 2 - OFF + 80} y={205} a={e.t0 * 30} until={(e.t0 + CUT) * 30 + 4} f={fr} size={e.m === 'wait' ? 190 : 140} id="sh"/>}</g>;
  } else if (e) {
    const q = at(SPOT.judge), a = e.t0 + (e.m ? CUT : 0), u = t - a;
    const ga = e.ok ? 9 : u < .15 ? lerp(9, -72, outC(u / .15)) : u < .2 ? lerp(-72, 9, (u - .15) / .05) : 9 - Math.sin(clamp((u - .2) / .13) * Math.PI) * 6;
    const face: OwlFace = e.ok ? 'happy' : u < .2 ? 'wide' : 'stern';
    who = <g><clipPath id="cj"><path d={behind(DESK.judge)} clipRule="evenodd"/></clipPath>
      <g clipPath="url(#cj)"><Owl x={q.x} y={q.y} k={q.k} f={fr} ga={ga} face={face} nod={e.ok ? Math.sin(clamp(u / .7) * Math.PI * 2) * 4 : 0}/></g>
      {!e.ok && <Slam s={tr.dismissed ? 'DISMISSED' : 'OVERRULED'} x={W / 2 - OFF} y={212} size={110} a={a * 30 + 6} until={1e9} f={fr} c={['#ffe1e1', '#e8323f']} id="ov"/>}</g>;
  }
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>{who}</svg>;
};

/* ---------- the HUD: the dialogue box, the record, the two shouts, the Reader's patience ---------- */
const TAG_C = {draft: '#6a4bd6', meb: RED, reader: '#8a6118'};
const Hud: React.FC<{g: G; quit: () => void}> = ({g, quit}) => {
  const tr = g.t, c = tr.c, t = g.clock, e = g.ev, st = stageOf(g), row = tr.rows[g.at], picking = tr.picking !== null, heard = g.read === tr.rows.length;
  const idleNow = st === null && g.restT < 0 && !tr.end, can = idleNow && !picking && row.st === 'raw';
  const n = Math.max(0, Math.floor((t - g.lineT) * CPS));
  // who is talking, and what they say
  const [tag, tagC, words]: [string, string, React.ReactNode] = g.restT >= 0 ? ['MEB', TAG_C.meb, 'The defence rests.']
    : st === 'meb' ? ['MEB', TAG_C.meb, e!.m === 'wait' ? 'Wait! Say that better.' : 'Objection! Strike that line.']
    : st === 'bench' ? ['THE READER', TAG_C.reader, e!.ok ? `Sustained. ${e!.why}` : e!.why]
    : picking ? ['FIRST DRAFT', TAG_C.draft, 'Fine. How about one of these?']
    : ['FIRST DRAFT', TAG_C.draft, <span style={{color: row.st === 'struck' ? '#8f8aa3' : row.st === 'fixed' ? '#8ff0b4' : '#fff', textDecoration: row.st === 'struck' ? 'line-through' : 'none'}}>{row.st === 'raw' ? row.text.slice(0, n) : row.text}</span>];
  return <>
    <Btn label="✕ QUIT" size={18} act={quit} style={ABS(12, 6)}/>
    <div style={ABS(150, 10, {display: 'flex', alignItems: 'center', gap: 18, height: 58, padding: '0 22px', borderRadius: 14, background: 'rgba(14,8,6,.78)', border: '2px solid rgba(255,255,255,.18)'})}>
      <span style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 30, color: '#fff'}}>{c.name}</span>
      <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 17, letterSpacing: 2, color: '#ffe8b0'}}>READER'S PATIENCE</span>
      <svg width={MARKS * 38} height={36} viewBox={`0 0 ${MARKS * 38} 36`}>{[...Array(MARKS)].map((_, i) => {const on = i < tr.marks;
        return <g key={i} transform={`translate(${i * 38 + 19} 18)`}><circle r={14} fill={on ? '#ffc93c' : 'rgba(255,255,255,.12)'} stroke={on ? '#8a6118' : 'rgba(255,255,255,.25)'} strokeWidth={3}/>
          {on ? <circle r={5.5} fill="#1A1826"/> : <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#ff5a6e" strokeWidth={3.5} strokeLinecap="round"/>}</g>;})}</svg>
    </div>

    {/* the rule a sustained shout was about, stamped over the bench. ponytail: the film's Stamp guesses its width from the letter count and wide names (TWO ORDERS) ran into its tick; this one is measured by the browser */}
    {st === 'bench' && e!.ok && e!.stamp && <div key={e!.t0} style={ABS(0, 96, {width: W - 2 * OFF, display: 'flex', justifyContent: 'center', pointerEvents: 'none', animation: 'pym-slam .35s ease-out both'})}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '8px 30px 8px 20px', borderRadius: 18, background: 'rgba(255,255,255,.78)', border: '7px solid #1f9e55', transform: 'rotate(-5deg)',
        fontFamily: BOLD, fontSize: 68, letterSpacing: 2, lineHeight: 1.15, whiteSpace: 'nowrap', color: '#1f9e55'}}><Icon name="check" size={64} w={5}/>{STAMPS[e!.stamp].name}</div></div>}

    {/* the three cards a WAIT! offers */}
    {picking && st === null && <div style={ABS(0, 0, {width: W, height: H, background: 'rgba(12,8,20,.5)', pointerEvents: 'none'})}/>}
    {picking && st === null && <div style={ABS(50, 392, {width: 1210, display: 'flex', gap: 22})}>{tr.rows[tr.picking!].cards.map((opt, i) => {const gone = tr.rows[tr.picking!].gone.includes(opt);
      return <div key={opt} data-ui="btn" onClick={ev => {ev.stopPropagation(); g.card(opt);}} style={{flex: 1, height: 340, boxSizing: 'border-box', padding: '54px 26px 20px', position: 'relative', cursor: gone ? 'default' : 'pointer', borderRadius: 14,
        background: gone ? '#b9b2a4' : PAPER, border: `5px solid ${INKV}`, boxShadow: '0 12px 0 rgba(0,0,0,.4)', transform: `rotate(${[-2, 1, -1][i]}deg)`, animation: `pym-drop .35s ease-out ${i * .08}s both`}}>
        {!TOUCH && <div style={{position: 'absolute', left: 16, top: 10, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: '#8a8478'}}>{i + 1}</div>}
        <div style={{fontFamily: BOLD, fontSize: 36, lineHeight: 1.22, color: gone ? '#6f695e' : '#1e1a26', textDecoration: gone ? 'line-through' : 'none'}}>{tr.rows[tr.picking!].line.fix![opt]}</div></div>;})}</div>}

    {/* the dialogue box */}
    <div data-ui="btn" onClick={() => g.go(1)} style={ABS(50, 812, {width: 1210, height: 232, boxSizing: 'border-box', borderRadius: 16, background: 'rgba(10,14,36,.9)', border: '5px solid #fff', padding: '30px 190px 20px 40px', cursor: 'pointer'})}>
      <div style={{position: 'absolute', left: 22, top: -51, height: 50, padding: '0 26px', display: 'flex', alignItems: 'center', background: tagC, border: '4px solid #fff', borderBottom: 'none', borderRadius: '12px 12px 0 0',
        fontFamily: BOLD, fontSize: 30, letterSpacing: 2, color: '#fff'}}>{tag}</div>
      {/* the one long line is drawn long: it fills the box */}
      <div style={{fontFamily: BOLD, fontSize: tag === 'FIRST DRAFT' && !picking && row.line.long && row.st === 'raw' ? 31 : 44, lineHeight: 1.24, color: '#fff'}}>{words}</div>
      {st === null && !picking && row.st !== 'raw' && row.line.stamp && <div style={{position: 'absolute', left: 40, bottom: 22}}><Ink s={row.line.stamp} size={26} c={row.st === 'fixed' ? '#8ff0b4' : '#ff8a9a'}/></div>}
      {st === 'bench' && <div style={{position: 'absolute', right: 22, bottom: 20, animation: 'pym-nudge 1s ease-in-out infinite'}}><Button icon="arrow" act={() => g.go(1)} style={{background: '#fff', color: INK}}/></div>}
      {idleNow && !picking && <div style={{position: 'absolute', right: 22, bottom: 20, display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 20, color: '#8fa6c4', marginRight: 6}}>{g.at + 1} / {tr.rows.length}</span>
        {g.at > 0 && <Button icon="back" act={() => g.go(-1)}/>}
        {g.at < tr.rows.length - 1 && <div style={{animation: g.at + 1 >= g.read ? 'pym-nudge 1s ease-in-out infinite' : undefined}}><Button icon="arrow" act={() => g.go(1)} style={{background: g.at + 1 >= g.read ? '#fff' : undefined, color: g.at + 1 >= g.read ? INK : '#fff'}}/></div>}</div>}
    </div>

    {/* the record: every line read out so far */}
    <div style={ABS(1290, 84, {width: 600, height: 712, boxSizing: 'border-box', borderRadius: 14, background: PAPER, border: `5px solid ${INKV}`, boxShadow: '0 12px 0 rgba(0,0,0,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column'})}>
      <div style={{height: 56, flex: 'none', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#24406e', fontFamily: BOLD, fontSize: 28, letterSpacing: 1, color: '#fff'}}>
        THE RECORD<span style={{fontFamily: MONO, fontSize: 17, opacity: .8}}>{c.saved ? 'CLAUDE.md' : 'YOUR REQUEST'}</span></div>
      {/* a thing from the story, pinned above the record: case 3's exhibit with its picture, case 4's job for today */}
      {c.pinned && <div style={{flex: 'none', margin: '10px 14px 0', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 6, background: '#ffe066', transform: 'rotate(-.6deg)', boxShadow: '0 3px 0 rgba(0,0,0,.15)', ...txt(20, 700, '#3d2806')}}>
        {c.pinned.art && <Screen v="mock" w={124}/>}
        <div><span style={{fontFamily: MONO, fontSize: 16, letterSpacing: 2, color: '#8a6118', marginRight: 10, display: c.pinned.art ? 'block' : 'inline'}}>{c.pinned.tag}</span>{c.pinned.text}</div></div>}
      <div style={{flex: 1, minHeight: 0, padding: '8px 10px'}}>{tr.rows.slice(0, g.read).map((r, i) => {const on = i === g.at && !tr.end, s = r.line.stamp;
        return <div key={i} onClick={() => g.jump(i)} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 9, cursor: 'pointer', background: on ? 'rgba(255,201,63,.38)' : 'transparent',
          boxShadow: on ? `inset 0 0 0 3px #d9a93a` : 'none'}}>
          <span style={{flex: 'none', width: 26, fontFamily: MONO, fontWeight: 700, fontSize: 19, color: '#8a8478'}}>{i + 1}</span>
          {/* the long line is small print and still a tall block; a struck line keeps to one row, so nine rows and their stamps fit */}
          <span style={{flex: 1, minWidth: 0, fontFamily: UI, fontWeight: r.st === 'fixed' ? 700 : 500, fontSize: r.line.long && r.st === 'raw' ? 17 : 23, lineHeight: 1.22, color: r.st === 'struck' ? '#a39a8c' : r.st === 'fixed' ? GREEN : '#1e1a26',
            textDecoration: r.st === 'struck' ? 'line-through' : 'none', ...(r.st === 'struck' ? {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'} : {})}}>{r.text}</span>
          {r.st !== 'raw' && s && <Ink s={s} size={14} c={r.st === 'fixed' ? GREEN : RED}/>}</div>;})}</div>
      <div style={{flex: 'none', height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '3px dashed #cfc6b2'}}>
        {heard ? <Hit label="Rest your case" act={g.rest} size={40} style={{opacity: idleNow && !picking ? 1 : .45}}/> : <span style={txt(22, 500, '#8a8478')}>{tr.rows.length - g.read} more {tr.rows.length - g.read === 1 ? 'line' : 'lines'} to hear</span>}</div>
    </div>

    {/* the two shouts */}
    {(['wait', 'object'] as Shout[]).map((m, i) => <div key={m} data-ui="btn" onClick={ev => {ev.stopPropagation(); g.shout(m);}} style={ABS(1290 + i * 308, 812, {width: 292, height: 232, boxSizing: 'border-box', borderRadius: 18, cursor: 'pointer',
      background: MOVE_C[m], border: '5px solid #fff', boxShadow: '0 10px 0 rgba(0,0,0,.45)', opacity: can ? 1 : .4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, transform: `rotate(${i ? 1.5 : -1.5}deg)`})}>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: m === 'wait' ? 66 : 42, color: '#fff', textShadow: '0 4px 0 rgba(0,0,0,.35)', lineHeight: 1}}>{m === 'wait' ? 'WAIT!' : 'OBJECTION!'}</div>
      <div style={txt(22, 700, 'rgba(255,255,255,.9)')}>{m === 'wait' ? 'Say it better' : 'Strike it'}</div>
      {!TOUCH && <div style={{position: 'absolute', left: 14, top: 8, fontFamily: MONO, fontWeight: 700, fontSize: 20, color: 'rgba(255,255,255,.75)'}}>{m === 'wait' ? 'W' : 'O'}</div>}</div>)}
    <style>{ANIM}</style>
  </>;
};

/* ---------- before and after: a courtroom game's case select and verdict ---------- */
const goal = (i: number) => cap(GOALS[i]);
const WOOD = 'radial-gradient(circle at 50% 20%, rgba(120,70,36,.5), rgba(20,11,6,.93) 78%)';
/** The docket: four case folders on the bench, the open one's file under them, the Reader waiting. */
const Docket: React.FC<{si: number; best: Record<string, number>; t: number; choose: (i: number) => void; start: () => void; back: () => void; how: () => void}> = ({si, best, t, choose, start, back, how}) => {
  const c = CASES[si], fr = t * 30, fresh = newIn(c);
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <div style={{position: 'absolute', inset: 0, background: WOOD}}/>
    <Button icon="back" act={back} style={ABS(40, 40)}/>
    <Button icon="help" act={how} style={ABS(W - 40 - TAP, 40)}/>
    <div style={ABS(0, 36, {width: W, textAlign: 'center', ...SHOUT(96), transform: 'skewX(-6deg)'})}>The docket</div>
    <div style={ABS(104, 206, {display: 'flex', gap: 28})}>{CASES.map((x, k) => {const on = k === si, bg = on ? '#f2c14e' : '#b48a3c';
      return <div key={x.id} onClick={() => choose(k)} style={{width: 407, height: 250, position: 'relative', cursor: 'pointer', transform: on ? 'translateY(-16px) rotate(-1.5deg)' : 'none', transition: 'transform .15s'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 170, height: 60, borderRadius: '14px 14px 0 0', background: bg, padding: '8px 20px', boxSizing: 'border-box', ...txt(24, 700, 'rgba(27,16,51,.7)')}}>Case {k + 1}</div>
        <div style={{position: 'absolute', left: 0, top: 46, right: 0, bottom: 0, borderRadius: '0 16px 16px 16px', background: bg, padding: '20px 24px', boxSizing: 'border-box', boxShadow: on ? '0 0 0 5px #fff, 0 18px 0 rgba(0,0,0,.4)' : '0 10px 0 rgba(0,0,0,.35)'}}>
          <div style={txt(38, 700, INK)}>{cap(x.name)}</div><div style={{...txt(23, 500, 'rgba(27,16,51,.78)'), marginTop: 6}}>{x.job}</div>
          <div style={{position: 'absolute', left: 22, bottom: 14}}><Stars n={caseBest(best, x)} size={44} off="rgba(27,16,51,.18)"/></div>
          <div style={{position: 'absolute', right: 18, bottom: 14, width: 58, height: 58, borderRadius: 29, background: RED, boxShadow: 'inset 0 0 0 4px rgba(255,255,255,.35), 0 3px 0 rgba(0,0,0,.3)', display: 'grid', placeItems: 'center', ...txt(32, 700)}}>{k + 1}</div>
        </div></div>;})}</div>
    {/* the open case's file */}
    <div key={c.id} style={ABS(104, 506, {width: 1180, height: 400, boxSizing: 'border-box', padding: '26px 38px', borderRadius: 14, background: PAPER, border: `5px solid ${INKV}`, boxShadow: '0 14px 0 rgba(0,0,0,.4)', transform: 'rotate(-.4deg)', animation: 'pym-up .25s ease-out both'})}>
      <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 19, letterSpacing: 3, color: '#8a8478'}}>CASE FILE · {c.lines.length} LINES{c.pinned ? ` · ${c.pinned.tag}` : ''}</div>
      <div style={{...txt(56, 700, '#1e1a26'), marginTop: 2}}>{cap(c.name)}</div>
      <div style={{...txt(30, 500, '#4a4458'), maxWidth: c.pinned?.art ? 760 : undefined}}>{c.job} {c.line}</div>
      {c.pinned?.art && <div style={{position: 'absolute', right: 34, top: 28, transform: 'rotate(1.5deg)'}}><Screen v="mock" w={290}/></div>}
      <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 22, flexWrap: 'wrap'}}><span style={txt(24, 700, '#8a8478')}>New rules:</span>{fresh.map((s, i) => <Ink key={s} s={s} size={25} rot={i % 2 ? 2 : -3}/>)}</div>
      <div style={{position: 'absolute', left: 38, right: 38, bottom: 24, display: 'flex', gap: 14}}>{GOALS.map((_, i) => <span key={i} style={{display: 'flex', alignItems: 'center', gap: 8, height: 56, padding: '0 20px 0 10px', borderRadius: 28,
        background: '#1e1a26', ...txt(24, 700)}}><Star on size={34}/>{goal(i)}</span>)}</div>
    </div>
    <svg width={520} height={420} style={ABS(1330, 470, {overflow: 'visible'})}><Owl x={260} y={420} k={8.2} f={fr} ga={9} face={Math.floor(fr / 90) % 2 ? 'read' : 'stern'} look={-.8} lookY={.3} doc/></svg>
    <Hit label="Take the case" icon="arrow" act={start} size={54} style={ABS(1340, 876, {width: 480, height: 130})}/>
    <Keys text="← → case   ·   Enter take it   ·   H law school"/>
  </div>;
};

/** Case 3's verdict, in place of the run's lines: Exhibit A, and what the Reader built from the record as it stood.
 *  The title screen follows the drawing only if the record points at it; the rest of the game gets the default look
 *  unless the record names what to leave out; with both orders about levels still there, it stops to ask. */
const Built: React.FC<{left: Stamp[]; done: boolean}> = ({left, done}) => {
  const TW = 300, show = !left.includes('show'), name = !left.includes('name'), two = left.includes('two');
  const note = (ok: boolean | null, s: string) => <div style={{display: 'flex', alignItems: 'center', gap: 8, ...txt(23, 700, ok === false ? '#ff8a9a' : '#fff')}}>
    {ok !== null && <span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff5a6e'}}><Icon name={ok ? 'check' : 'cross'} size={26} w={3.4}/></span>}{s}</div>;
  const soon = (s: string) => <div style={col(8)}><div style={{width: TW, height: TW * 9 / 16, boxSizing: 'border-box', borderRadius: 9, border: '3px dashed rgba(255,255,255,.3)'}}/>{note(null, s)}</div>;
  return <div style={{display: 'flex', gap: 26}}>
    <div style={col(8)}><Screen v="mock" w={TW}/>{note(null, 'Exhibit A: the drawing')}</div>
    {!done ? <>{soon('the title it builds')}{soon('the rest of the game')}</> : <>
      <div style={{...col(8), animation: 'pym-drop .4s ease-out both'}} onAnimationStart={() => sfx(show ? 'check' : 'buzz', .2)}><Screen v={show ? 'mock' : 'words'} w={TW}/>{note(show, show ? 'matches the drawing' : 'not the drawing')}</div>
      <div style={{...col(8), position: 'relative', animation: 'pym-drop .4s ease-out .35s both'}} onAnimationStart={() => sfx(name && !two ? 'check' : 'buzz', .2)}><Screen v={name ? 'night' : 'office'} w={TW}/>
        {two && <div style={{position: 'absolute', left: 22, top: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px 4px 10px', borderRadius: 14, background: '#fff', border: `3px solid ${RED}`, transform: 'rotate(-3deg)', ...txt(23, 700, INK)}}>
          <span style={{display: 'flex', color: RED}}><Icon name="cross" size={26} w={3.4}/></span>One level, or ten?</div>}
        {note(name, name ? 'the game\'s own look' : 'the default look')}</div></>}
  </div>;
};

/** The verdict: the record goes past the Reader a line at a time, and what is still wrong on it shows in the run. */
const Verdict: React.FC<{g: G; last: boolean; again: (docket: boolean, next?: boolean) => void}> = ({g, last, again}) => {
  const tr = g.t, got = stars(tr), n = got.filter(Boolean).length, left = leftOf(tr), [cmd, tip] = tipOf(tr), [more, setMore] = useState(false);
  const rows = tr.rows.filter(r => r.st !== 'struck'), t = g.clock - g.endT, fr = g.clock * 30;
  const READ = tr.dismissed ? 0 : .28, runEnd = .5 + rows.length * READ, lit = Math.floor((t - .5) / READ), done = t >= runEnd;
  const beat = useRef(-1);
  const bad = (r: Row) => live(tr, r);   // not "has a stamp": the half of a pair that was kept is fine
  useEffect(() => {if (!tr.dismissed && lit >= 0 && lit < rows.length && lit !== beat.current) {beat.current = lit; sfx(bad(rows[lit]) ? 'buzz' : 'tick', .15);}}, [lit]);
  const seenBad = rows.filter((r, i) => bad(r) && i <= lit && rows.findIndex(x => bad(x) && x.line.stamp === r.line.stamp) === i);   // one line per rule
  const next = n > 0 && !last;
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <div style={{position: 'absolute', inset: 0, background: WOOD}}/>
    {/* the record, as the Reader gets it */}
    <div style={ABS(70, 60, {width: 700, height: 830, boxSizing: 'border-box', borderRadius: 14, background: PAPER, border: `5px solid ${INKV}`, boxShadow: '0 14px 0 rgba(0,0,0,.4)', overflow: 'hidden', transform: 'rotate(-.6deg)'})}>
      <div style={{height: 60, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#24406e', fontFamily: BOLD, fontSize: 28, letterSpacing: 1, color: '#fff'}}>
        WHAT THE READER GOT<span style={{fontFamily: MONO, fontSize: 17, opacity: .8}}>{tr.c.saved ? 'CLAUDE.md' : 'YOUR REQUEST'}</span></div>
      <div style={{padding: '12px 14px'}}>{rows.map((r, i) => {const on = i === lit && !done, past = i <= lit || tr.dismissed, wrong = bad(r) && past;
        return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 9, background: on ? 'rgba(255,201,63,.45)' : wrong ? 'rgba(200,36,58,.12)' : 'transparent'}}>
          <span style={{flex: 1, fontFamily: UI, fontWeight: r.st === 'fixed' ? 700 : 500, fontSize: 25, lineHeight: 1.22, color: wrong ? RED : r.st === 'fixed' ? GREEN : '#1e1a26'}}>{r.text}</span>
          {wrong && r.line.stamp && <Ink s={r.line.stamp} size={15} c={RED}/>}{r.st === 'fixed' && past && <span style={{color: GREEN, display: 'flex'}}><Icon name="check" size={30} w={3.4}/></span>}</div>;})}
        {/* case 4: after the pile of notes, the job they were read for */}
        {tr.c.pinned && !tr.c.pinned.art && !tr.dismissed && <div style={{margin: '6px 0 0', padding: '8px 14px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: done ? '#d6f5e1' : '#ffe066', transition: 'background .3s'}}>
          <div><div style={{fontFamily: MONO, fontWeight: 700, fontSize: 16, letterSpacing: 2, color: '#8a6118'}}>THEN, {tr.c.pinned.tag}</div><div style={txt(24, 700, '#3d2806')}>{tr.c.pinned.text}</div></div><Jump fixed={done}/></div>}</div>
    </div>
    <svg width={300} height={260} style={ABS(380, 800, {overflow: 'visible'})}><Owl x={150} y={270} k={5.6} f={fr} ga={9} face={!done ? 'read' : tr.dismissed ? 'stern' : n === 3 ? 'happy' : left.length ? 'squint' : 'read'} look={-.9} lookY={done ? 0 : .5}/></svg>

    <div style={ABS(850, 34, txt(28, 500, MUTE))}>{cap(tr.c.name)} · {tr.wrong} wrong {tr.wrong === 1 ? 'shout' : 'shouts'}</div>
    <div key={done ? 'v' : 'r'} style={ABS(840, 66, {...SHOUT(tr.dismissed ? 104 : done ? 128 : 92, tr.dismissed ? '#ff5a6e' : done ? GOLD : '#fff'), transform: 'skewX(-8deg)', animation: done || tr.dismissed ? 'pym-slam .45s ease-out both' : undefined})}>
      {tr.dismissed ? 'CASE DISMISSED' : done ? 'CASE CLOSED' : 'The Reader reads…'}</div>
    {/* the run: what each line still wrong on the record did */}
    <div style={ABS(850, 246, {width: 1010, height: 226, ...col(10), alignItems: 'stretch'})}>
      {tr.dismissed ? <div style={txt(34, 700)}>The Reader ran out of patience before the request was ready.</div>
        : tr.c.pinned?.art ? <Built left={left} done={done}/>
        : <>{seenBad.slice(0, 4).map(r => <div key={r.text} style={{display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px', background: 'rgba(0,0,0,.55)', borderLeft: `10px solid #ff5a6e`, animation: 'pym-left .3s ease-out both', ...txt(30, 700)}}>
          <span style={{color: '#ff5a6e', display: 'flex'}}><Icon name="cross" size={32} w={3.4}/></span>{tr.c.left?.[r.line.stamp!] ?? STAMPS[r.line.stamp!].left}</div>)}
          {seenBad.length > 4 && <div style={txt(24, 500, MUTE)}>and {seenBad.length - 4} more</div>}
          {done && !left.length && <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px', background: 'rgba(0,0,0,.55)', borderLeft: `10px solid #6ef2a0`, animation: 'pym-left .3s ease-out both', ...txt(30, 700)}}>
            <span style={{color: '#6ef2a0', display: 'flex'}}><Icon name="check" size={32} w={3.4}/></span>{tr.c.clean ?? 'Straight to the finish. Then let it cook.'}</div>}</>}</div>
    {(done || tr.dismissed) && <>
      <div style={ABS(850, 486, {display: 'flex', gap: 30})}>{got.map((ok, i) => <div key={i} style={{...col(8), width: 250, animation: `pym-slam .45s ease-out ${.15 + i * .18}s both`}} onAnimationStart={() => sfx(ok ? 'slam' : 'pop', ok ? .3 : .12)}>
        <Star on={ok} size={150} rot={(i - 1) * 9}/><span style={{display: 'flex', alignItems: 'center', gap: 8, ...txt(24, 700, ok ? '#fff' : MUTE)}}>
          <span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff5a6e'}}><Icon name={ok ? 'check' : 'cross'} size={26} w={3.2}/></span>{goal(i)}</span></div>)}</div>
      <div style={ABS(850, 716, {width: 1010, boxSizing: 'border-box', padding: '16px 24px', background: 'rgba(0,0,0,.55)', borderLeft: `10px solid ${GOLD}`, animation: 'pym-up .3s ease-out .7s both'})}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}><span style={txt(24, 700, GOLD)}>Next time</span><Code s={cmd}/></div>
        <div style={{...txt(27, 500), marginTop: 8}}>{tip}</div></div>
      <div style={ABS(850, 900, {display: 'flex', gap: 20, alignItems: 'flex-start', animation: 'pym-up .3s ease-out .9s both'})}>
        <Hit label={next ? 'Next case' : 'Again'} icon={next ? 'arrow' : 'retry'} act={() => again(false, next)} size={44}/>
        {next && <Button label="Again" icon="retry" act={() => again(false)}/>}
        <Button label="The rules" icon="list" act={() => setMore(true)}/>
        <Button label="Docket" act={() => again(true)}/></div></>}
    <Keys text={`Enter ${next ? 'next case   ·   A again' : 'again'}   ·   D docket   ·   Esc map`}/>
    {more && <Sheet title="The rules in this case, in Anthropic's words" close={() => setMore(false)}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 1440}}>{([...new Set(tr.c.lines.flatMap(l => l.stamp ? [l.stamp] : []))] as Stamp[]).map(s => {const R = STAMPS[s], ok = !left.includes(s);
        return <div key={s} style={{display: 'grid', gridTemplateColumns: '44px 330px 1fr', columnGap: 18, alignItems: 'center'}}>
          <span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff5a6e'}}><Icon name={ok ? 'check' : 'cross'} size={34} w={3.2}/></span>
          <div><Ink s={s} size={22} c={R.move === 'wait' ? '#8fbcff' : '#ff8a9a'} rot={0}/><div style={{...txt(20, 500, MUTE), marginTop: 6}}>{R.move === 'wait' ? 'WAIT! Say it better' : 'OBJECTION! Strike it'}</div></div>
          <div><div style={txt(25, 500, '#fff3c4')}>“{R.quote}”</div><div style={txt(19, 500, MUTE)}><Proof to={POST[R.from]}>{BY[R.from]}</Proof></div></div></div>;})}</div></Sheet>}
  </div>;
};
