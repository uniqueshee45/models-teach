/**
 * World 3, the blocks: the screen. The rules are blocks.ts; the look is the video's block world
 * (remotion/src/opus55/blocks3d.ts), used as it is: its land and sky, its polished block for a checked one, its
 * glass for the ruler, its loose coloured cubes for the unchecked ones (in the builder's paint), and Meb as cubes.
 * First you pick a site and a builder. Then one input: tap (anywhere, or SPACE) to check the unchecked blocks.
 */
import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {build} from '../../remotion/src/opus55/blocks3d';
import type {Bit, Blk as Cube, Rig, V3} from '../../remotion/src/opus55/blocks3d';
import {Txt} from '../../remotion/src/opus55/chrome';
import {BOLD, MONO, clamp, lerp, outBack} from '../../remotion/src/meb-hatch/rig';
import type {Pose} from '../../remotion/src/meb-hatch/rig';
import {Btn, CH, CW, GLASS, GameText, H, Mono, TOUCH, W, mebKept} from './race';
import {DT, mmss, money} from './rules';
import {BUILDERS, KIND, SCAN_S, SITES, blocksOf, canFast, costOf, crackOf, layOf, makeBot, makeBuild, realOf, resultLines, rhythmOf, riskOf, stars, tick, usualOf} from './blocks';
import type {BEv, Bot, Build, Kind, Site} from './blocks';
import {COSTS, GUIDE, MODELS, VALS} from './stats';
import type {ModelId} from './stats';
import {loop, sfx} from './sound';
import {ANIM, Bars, Explain, In, Moves, Typed, markSeen, movesDone, seen, useT} from './explain';
import type {Card} from './explain';
import {Button as Round, INK, Icon, Keys, MUTE, Proof, Sheet, Star, Stars, TAP, UI, cap, nm, txt} from './ui';
import type {IconName} from './ui';

/* ---------- the world: the tower stands on x 0..2, z 0..2, two cubes by two a block ---------- */
const CELLS: [number, number][] = [[.5, .5], [1.5, .5], [.5, 1.5], [1.5, 1.5]];
const POLE: [number, number] = [-1.5, .5];   // the ruler: a glass cube per block of the job, and a gold one on top
const hash = (i: number) => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};
const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
/** An unchecked block wears the builder's paint: lighter for an easy one, darker for a hard one. */
const paintOf = (who: ModelId, kind: Kind) => {const c = MODELS[who].paint; return kind === 'easy' ? mix(c, '#ffffff', .32) : kind === 'hard' ? mix(c, '#000000', .3) : c;};
const KC: Record<Kind, string> = {easy: '#6ef2a0', medium: '#ffd23f', hard: '#ff8a7a'};
const riskC = (r: number) => r < .25 ? '#6ef2a0' : r < .5 ? '#ffd23f' : '#ff6a5a';
const pct = (x: number) => `${Math.round(x * 100)}%`;
const TIP_S = 5, END_HOLD = 2, CRACK_S = .2, FALL_S = .9, G_FALL = 30;

/* ---------- the game around the rules ---------- */
type Fall = {t0: number; from: number; n: number};
type Pop = {text: string; sub?: string; c: string; h: number; t0: number};
type G = {
  b: Build; phase: 'brief' | 'play' | 'result'; clock: number; endT: number;
  tap: boolean; bot: Bot | null; botFn: ((b: Build) => boolean) | null;
  mebY: number; vy: number; camY: number; layT: number; shockT: number; landT: number; shake: number;
  falls: Fall[]; pops: Pop[]; sparks: {t0: number; i: number}[]; late: boolean;
  tip: {text: string; t0: number} | null; tips: string[]; told: Set<string>;
  start: () => void;
};
const starKey = (st: Site, who: ModelId, fast: boolean) => `${st.id}.${who}${fast ? '.fast' : ''}`;
export const bestOf = (best: Record<string, number>, st: Site) => Math.max(0, ...Object.entries(best).filter(([k]) => k.startsWith(st.id + '.')).map(([, n]) => n));
const nameOf = (who: ModelId, fast: boolean) => MODELS[who].name + (fast ? ' FAST' : '');

/** The sun: morning at the start, on the horizon at the sunset goal, gone at the end of the day. */
const sunOf = (b: Build) => b.t <= b.site.sunset ? lerp(.12, .5, b.t / b.site.sunset) : lerp(.5, .56, clamp((b.t - b.site.sunset) / (b.site.dark - b.site.sunset)));
function poseOf(g: G): Pose {
  const b = g.b, t = g.clock, f = t * 30;
  if (g.phase === 'brief') return {face: f % 110 < 5 ? 'blink' : 'happy', armL: Math.sin(f / 9) * 6, armR: 60 + Math.sin(t * 6) * 14};
  if (b.end) return b.won ? {face: 'happy', armL: 140, armR: 140, lift: Math.abs(Math.sin(f / 5)) * 1.5} : {face: 'sad', armL: 8, armR: 8};
  if (t - g.shockT < .8 || g.mebY > b.tower.length + .15) return {face: 'shocked', armL: 150, armR: 150};
  if (b.scan) return {face: 'neutral', armR: 60 + Math.abs(Math.sin(f * .7)) * 80, armL: -10};
  if (t - g.layT < .22) return {face: 'happy', armL: 140, armR: 140};
  return {face: f % 110 < 5 ? 'blink' : 'neutral', armL: Math.sin(f / 9) * 6, armR: -Math.sin(f / 9) * 6};
}
/** Everything the block world draws this frame. */
function worldOf(g: G) {
  const b = g.b, t = g.clock, n = b.plan.length, blocks: Cube[] = [], bits: Bit[] = [], brief = g.phase === 'brief';
  const cells = (i: number): V3[] => CELLS.map(([x, z]) => [x, i + .5, z]);
  for (let i = 0; i < n; i++) blocks.push({k: 'glass', p: [POLE[0], i + .5, POLE[1]]});
  blocks.push({k: 'gold', p: [POLE[0], n + .5, POLE[1]], ry: t * .8});
  for (let i = 0; i < b.ok; i++) for (const p of cells(i)) blocks.push({k: 'new', p});
  const at = b.scan ? b.ok : -1;   // the block a check is on
  for (let i = b.ok; i < b.tower.length; i++) {
    const s = i === b.tower.length - 1 ? .98 * outBack(clamp((t - g.layT) / .18)) : .98, c = paintOf(b.who, b.tower[i].kind);
    for (const p of cells(i)) {bits.push({p, s, c: i === at && b.scan!.t >= b.site.checkS ? mix(c, '#ffffff', .45 + .25 * Math.sin(t * 40)) : c});
      if (i === at) blocks.push({k: 'glass', p, s: 1.07 + .03 * Math.sin(t * 14)});}
  }
  for (const f of g.falls) {   // a crack: it shows for a moment, then it and everything on it comes apart
    const u = t - f.t0;
    if (u < CRACK_S) {
      for (let i = f.from; i < f.from + f.n; i++) for (const p of cells(i)) {bits.push({p, s: .98, c: paintOf(b.who, b.plan[i])}); if (i === f.from) blocks.push({k: 'glass', p, s: 1.02, crack: .4 + .6 * u / CRACK_S});}
    } else if (u < FALL_S) {const v = u - CRACK_S, life = FALL_S - CRACK_S;
      for (let i = f.from; i < f.from + f.n; i++) cells(i).forEach((p, k) => {for (let j = 0; j < 5; j++) {const h = (q: number) => hash(i * 131 + k * 17 + j * 7 + q + f.t0 * 1000);
        bits.push({p: [p[0] + (h(1) - .5) * 7 * v, p[1] + (h(2) * 4 - .5) * v - .5 * 22 * v * v, p[2] + (h(3) - .3) * 6 * v], s: .42 * (1 - v / life) + .05, c: paintOf(b.who, b.plan[i])});}});}
  }
  for (const sp of g.sparks) {const u = (t - sp.t0) / .35; if (u < 1) for (let j = 0; j < 6; j++) bits.push({p: [1 + Math.cos(j * 1.05 + sp.i) * (1.5 + u), sp.i + .5 + u * .8, 1 + Math.sin(j * 1.05 + sp.i) * (1.5 + u)], s: .14 * (1 - u), c: '#ffffff'});}
  const top = brief ? 0 : g.camY, sh = g.shake > 0 ? (hash(Math.floor(t * 60)) - .5) * g.shake * .5 : 0;
  const cam = brief ? {pos: [13 + Math.sin(t * .2) * 1.5, 5.5, 21] as V3, look: [2.5, 3.2, 0] as V3, fov: 44}
    : {pos: [9.6 + sh, top + 2.3, 16.5] as V3, look: [4.4, top + .1 + sh, 1] as V3, fov: 40};
  return {f: t * 30, cam, sun: brief ? .2 : sunOf(b), blocks, bits, signs: [], meb: {p: [1, g.mebY, 1] as V3, yaw: .45, grid: mebKept(poseOf(g))}};
}

/* ---------- the cards it opens with (explain.tsx): the tip is Anthropic's, "give Claude a way to check its work", and
   check early. Each card builds in reading order: a tower stacks, a test climbs it, a crack takes the top down. ---------- */
const HOW_KEY = 'pym3.blockshow';   // set once the cards have been read or skipped
const ADDY_COST = 'Addy Osmani (Anthropic), "What a task costs on Opus 5.5", claude.dev, 25 Sep 2026';
const ADDY_OPUS = 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5", claude.dev, 22 Sep 2026';
const STONE = '#f1ede2';   // a block that passed its test
const ease = (u: number) => 1 - (1 - clamp(u)) ** 3;
/** One block, drawn flat: an isometric cube with its top corner at x, y and an edge of s. */
const Iso: React.FC<{x: number; y: number; s: number; c: string; crack?: boolean; o?: number; glow?: boolean}> = ({x, y, s, c, crack, o = 1, glow}) => {
  const w = s * .866, h = s / 2, line = Math.max(1.5, s / 14);
  return <g opacity={o}>
    <path d={`M${x} ${y} L${x + w} ${y + h} L${x} ${y + s} L${x - w} ${y + h} Z`} fill={mix(c, '#ffffff', .3)}/>
    <path d={`M${x - w} ${y + h} L${x} ${y + s} L${x} ${y + 2 * s} L${x - w} ${y + s + h} Z`} fill={c}/>
    <path d={`M${x + w} ${y + h} L${x} ${y + s} L${x} ${y + 2 * s} L${x + w} ${y + s + h} Z`} fill={mix(c, '#000000', .28)}/>
    <path d={`M${x} ${y} L${x + w} ${y + h} L${x + w} ${y + s + h} L${x} ${y + 2 * s} L${x - w} ${y + s + h} L${x - w} ${y + h} Z M${x - w} ${y + h} L${x} ${y + s} L${x + w} ${y + h} M${x} ${y + s} V${y + 2 * s}`}
      fill="none" stroke={glow ? '#fff' : '#1a1426'} strokeWidth={glow ? line * 2.2 : line} strokeLinejoin="round"/>
    {crack && <path d={`M${x - w * .8} ${y + s * .9} l${w * .3} ${s * .25} l${-w * .12} ${s * .25} l${w * .35} ${s * .2} M${x + w * .1} ${y + s * 1.25} l${w * .3} ${-s * .15} l${w * .12} ${s * .35} l${w * .3} ${-s * .05}`}
      stroke="#1a1426" strokeWidth={Math.max(2.5, s / 9)} fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
  </g>;
};
/** A sound at a moment of the card, with nothing to see. */
const Snd: React.FC<{at: number; s: string; v?: number}> = ({at, s, v = .2}) => <In at={at} snd={s} vol={v} style={{position: 'absolute'}}><span/></In>;
/** A tower that stacks up from `at`, gets tested from the bottom, and loses the cracked block and all on it.
 *  Returns its timeline too, so a card can time the words that follow. */
const towerT = (n: number, at: number, bad: number) => {const lay = (i: number) => at + i * .2, test = (i: number) => at + n * .2 + .35 + i * .28; return {lay, test, fall: test(bad) + .3};};
const TowerArt: React.FC<{n: number; bad: number; at: number; s?: number; c?: string}> = ({n, bad, at, s = 34, c = '#7aa8ff'}) => {
  const t = useT(), {lay, test, fall} = towerT(n, at, bad), W2 = s * 4, H2 = s * (n + 3), x = W2 / 2;
  return <div style={{position: 'relative'}}>
    {[...Array(n)].map((_, i) => <Snd key={i} at={lay(i)} s="place" v={.12}/>)}
    {[...Array(bad)].map((_, i) => <Snd key={'t' + i} at={test(i)} s="tick" v={.2}/>)}
    <Snd at={test(bad)} s="break" v={.3}/>
    <svg width={W2} height={H2} style={{overflow: 'visible'}}>
      <ellipse cx={x} cy={H2 - s * .5} rx={s * 1.6} ry={s * .5} fill="rgba(0,0,0,.25)"/>
      {[...Array(n)].map((_, i) => {
        if (t < lay(i)) return null;
        const drop = (1 - ease((t - lay(i)) / .15)) * 40, passed = i < bad && t >= test(i), cracked = i === bad && t >= test(bad), v = Math.max(0, t - fall);
        const gone = i >= bad && v > 0, dx = gone ? (i - bad + 1) * 70 * v * (i % 2 ? 1 : -1) : 0, dy = gone ? 900 * v * v : 0, y = H2 - s * 2.5 - i * s - drop;
        // a fallen block leaves its ghost, so the card at rest still shows how much came down
        return <g key={i}>{gone && <Iso x={x} y={y} s={s} c="#ff6b7f" o={.22 * clamp(v / .5)}/>}
          <Iso x={x + dx} y={y + dy} s={s} c={passed ? STONE : c} crack={cracked} o={gone ? clamp(1 - v / .7) : 1}
          glow={i < n && Math.abs(t - test(i)) < .14 && i <= bad}/></g>;})}
    </svg></div>;
};
/** One of the blocks' three moves, played over and over in a little sky. */
const MiniB: React.FC<{n: number; at: number; snd: string; text: string; draw: (u: number) => React.ReactNode}> = ({n, at, snd, text, draw}) => {
  const u = Math.max(0, useT() - at);
  return <In at={at} snd={snd} vol={.15}><div style={{...colB(14), width: 440}}>
    <svg width={440} height={290} style={{borderRadius: 18, border: '5px solid #1a1426', background: 'linear-gradient(#8fc6ff, #d7ecff)'}}>
      <rect y={236} width={440} height={54} fill="#5fae3a"/><rect y={250} width={440} height={40} fill="#8a5a34"/>
      {draw(u)}
      <rect x={14} y={14} width={46} height={46} fill="#7a7a7a" stroke="#1a1426" strokeWidth={4}/><text x={37} y={48} textAnchor="middle" fontFamily={UI} fontWeight={700} fontSize={30} fill="#fff">{n}</text></svg>
    <div style={{...txt(28, 700), textAlign: 'center', minHeight: 72}}>{text}</div></div></In>;
};
const colB = (gap: number): React.CSSProperties => ({display: 'flex', flexDirection: 'column', alignItems: 'center', gap});
const STONE_CHIP: React.CSSProperties = {padding: '6px 24px', background: '#c9c9c9', border: '4px solid #1a1426', boxShadow: 'inset 4px 4px 0 rgba(255,255,255,.6), inset -4px -5px 0 rgba(0,0,0,.25)'};
const BMOVES = [['The finish line', 'CLAUDE.md', 'write in it: "done means the tests pass"'], ['A crack', '/rewind', 'goes back to just before it went wrong'],
  ['A second look', '', 'ask Claude to review its own changes before you do'], ['Fast mode', '/fast', 'the same model, sooner, at twice the price']];
const hardBars = () => BUILDERS.map(id => ({id, c: crackOf(MODELS[id], 'hard')})).sort((a, b) => a.c - b.c)
  .map(({id, c}) => ({label: MODELS[id].real.replace('Claude ', ''), v: c, text: pct(c), c: c < .2 ? '#6ef2a0' : c < .4 ? '#ffd23f' : '#ff8a7a'}));
const CARDS: Card[] = [
  {title: 'Every step stands on the last', lines: ['Claude builds a job step by step. A *wrong step* looks fine until something *tests* it, and then the steps on it come down too.'], qAt: 4.2,
    art: <div style={{display: 'flex', alignItems: 'flex-end', gap: 50}}><TowerArt n={7} bad={2} at={.6}/>
      <In at={towerT(7, .6, 2).fall + .3} how="slam" snd="smack" vol={.25}><div style={{...txt(64, 700, '#ff6b7f'), marginBottom: 120}}>−5 blocks</div></In></div>},
  {title: 'Check early, lose less', lines: ['The same crack. Checked *early*, two blocks come down. Checked *late*, *eight*.'], qAt: 5,
    art: <div style={{display: 'flex', alignItems: 'flex-end', gap: 160}}>{([[3, .6, 'Checked after 3'], [9, 1.4, 'Checked after 9']] as [number, number, string][]).map(([n, at, w]) =>
      <div key={n} style={colB(12)}><TowerArt n={n} bad={1} at={at} s={30}/>
        <div style={txt(30, 700)}>{w}</div>
        <In at={towerT(n, at, 1).fall + .3} how="slam" snd="smack" vol={.25}><div style={txt(56, 700, '#ff6b7f')}>−{n - 1}</div></In></div>)}</div>},
  {title: 'Give it a way to check', lines: ['Claude checks its work best when it has *something to run*: the tests, a build, a script.'], qAt: 3.4,
    quote: {text: 'A model that can check its own work finds its mistakes earlier.', who: ADDY_COST, to: COSTS},
    art: <div style={{position: 'relative'}}>
      <In at={.4} how="up"><div style={{width: 980, borderRadius: 16, background: '#0b1310', border: '5px solid #1a1426', padding: '16px 34px 22px', boxSizing: 'border-box', fontFamily: MONO, fontSize: 34, lineHeight: 1.5, textAlign: 'left'}}>
        <div style={{display: 'flex', gap: 10, marginBottom: 10}}>{['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}}/>)}</div>
        <div style={{color: '#39ff88'}}>$ <Typed text="npm test" at={.7}/></div>
        {([['✓', 'adds an item to the cart', true], ['✓', 'puts tax on last', true], ['✗', 'an empty cart with a discount', false]] as [string, string, boolean][]).map(([m, w, ok], k) =>
          <In key={w} at={1.3 + k * .35} how="left" snd={ok ? 'tick' : 'buzz'} vol={.18}><div style={{color: ok ? '#9fe8b8' : '#ff6b7f'}}>{m} {w}</div></In>)}
        <In at={2.5} how="up"><div style={{color: '#fff', marginTop: 6}}>2 passed, <span style={{color: '#ff6b7f'}}>1 failed</span></div></In></div></In>
      <In at={2.8} how="slam" snd="stamp" vol={.35} style={{position: 'absolute', right: -40, top: -40}}><div style={{transform: 'rotate(-9deg)', padding: '8px 26px', border: '8px solid #ffc93f', borderRadius: 12,
        background: 'rgba(11,19,16,.92)', ...txt(50, 700, '#ffc93f')}}>CRACK FOUND</div></In></div>},
  {title: 'How often a hard block cracks', lines: ['The coding test scores each model *by how hard the task is*. A miss is a crack.'], qAt: 3.4,
    src: <Proof to={VALS}>Terminal-Bench 2.1 by Vals, its Hard tasks (read 2026-10-02)</Proof>,
    art: <div style={colB(20)}><Bars rows={hardBars()} at={.6}/>
      <In at={2.6} how="up"><div style={{...txt(30, 500, MUTE), textAlign: 'center'}}>On MEDIUM blocks it's the other way round: <b style={{color: '#fff'}}>Sonnet 5.5</b> cracks less than Opus 5.</div></In></div>},
  {title: 'Your moves in Claude Code', lines: ['Give Claude *a finish line it can test*, and a way back when a step goes wrong.'], qAt: movesDone(BMOVES),
    quote: {text: 'Name the finish line, like "the tests pass"', who: ADDY_OPUS, to: GUIDE},
    art: <Moves chip={STONE_CHIP} rows={BMOVES}/>},
  {title: 'How the blocks play', lines: ['The model builds. *You* choose *when to check*, with the risk meter.'], qAt: 2.8,
    art: <div style={{display: 'flex', gap: 40}}>
      <MiniB n={1} at={.6} snd="place" text="It builds: a block is one coding task" draw={u => {const k = Math.floor(u / .45) % 7;
        return <g>{[...Array(Math.min(k, 5))].map((_, i) => <Iso key={i} x={220} y={236 - 68 - i * 34} s={34} c="#7aa8ff"/>)}</g>;}}/>
      <MiniB n={2} at={1.3} snd="scan" text="Tap to check: the tests climb from the bottom" draw={u => {const h = (u % 2.4) / .4;
        return <g>{[...Array(5)].map((_, i) => <Iso key={i} x={220} y={236 - 68 - i * 34} s={34} c={i < h ? STONE : '#7aa8ff'} glow={Math.floor(h) === i}/>)}</g>;}}/>
      <MiniB n={3} at={2} snd="break" text="A cracked one falls with all on it, and is built again" draw={u => {const v = Math.max(0, (u % 2.4) - .8);
        return <g>{[...Array(5)].map((_, i) => {const gone = i >= 2 && v > 0;
          return <Iso key={i} x={220 + (gone ? (i - 1) * 60 * v * (i % 2 ? 1 : -1) : 0)} y={236 - 68 - i * 34 + (gone ? 700 * v * v : 0)} s={34} c={i < 2 ? STONE : '#7aa8ff'} crack={i === 2 && u % 2.4 > .5} o={gone ? clamp(1 - v / .8) : 1}/>;})}</g>;}}/></div>},
];

let picked = {si: 0, who: 'sonnet55' as ModelId, fast: false};   // the site and builder you picked, kept while the page is open
export const Blocks: React.FC<{best: Record<string, number>; onEnd: (key: string, stars: number) => void; onQuit: () => void}> = ({best, onEnd, onQuit}) => {
  const canvas = useRef<HTMLCanvasElement>(null), [, setTick] = useState(0), [run, setRun] = useState(0), [sel, setSel] = useState(picked);
  const ref = useRef<G | null>(null), rigRef = useRef<Rig | null>(null), brief = useRef(true);
  const ended = useRef(onEnd); ended.current = onEnd;
  const quit = useRef(onQuit); quit.current = onQuit;
  const site = SITES[sel.si], who = sel.who, fast = sel.fast && canFast(who);
  const choose = (si: number, id: ModelId, f = sel.fast) => {
    const next = {si: Math.max(0, Math.min(SITES.length - 1, si)), who: id, fast: f && canFast(id)};
    if (next.si !== sel.si || next.who !== sel.who || next.fast !== sel.fast) {sfx('select', .3); setSel(picked = next);}
  };
  const again = (pick: boolean) => {brief.current = pick; setRun(r => r + 1);};
  // the cards show before your first tower; the ? on the picking screen brings them back
  const [how, setHow] = useState(() => !seen(HOW_KEY)), howOn = useRef(how); howOn.current = how;

  useEffect(() => {   // the land is built once and kept across towers
    rigRef.current = build(canvas.current!, CW, CH, [], true);   // lite: the land from its visible faces only
    return () => {loop('bed-build.mp3', 0); canvas.current?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();};
  }, []);

  useEffect(() => {
    const b = makeBuild(site, who, 1 + Math.floor(Math.random() * 1e6), fast), m = b.m, n = b.plan.length, name = nameOf(who, fast);
    const g: G = {b, phase: brief.current ? 'brief' : 'play', clock: 0, endT: 0, tap: false, bot: null, botFn: null, mebY: 0, vy: 0, camY: 0, layT: -9, shockT: -9, landT: -9, shake: 0,
      falls: [], pops: [], sparks: [], late: false, tip: null, tips: [], told: new Set(), start: () => {}};
    ref.current = g;
    const tip = (key: string, text: string) => {if (!g.told.has(key)) {g.told.add(key); g.tips.push(text);}};
    const say = (text: string) => {g.tip = {text, t0: g.clock};};
    g.start = () => {if (g.phase !== 'brief') return; brief.current = false; g.phase = 'play'; loop('bed-build.mp3', 0); sfx('go', .35); begin();};
    const begin = () => {loop('bed-blocks.mp3', .1);
      tip('start', `${name} BUILDS. YOU CHECK: ${TOUCH ? 'TAP' : 'SPACE, OR A CLICK,'} TESTS THE COLOURED BLOCKS. A CRACKED ONE FALLS, WITH EVERYTHING ON TOP OF IT.`);};
    const onEv = (e: BEv) => {
      switch (e.k) {
        case 'lay': g.layT = g.clock; sfx('place', .25); break;
        case 'full': say('THE TOWER IS UP. CHECK IT: A BLOCK ONLY COUNTS ONCE IT HAS PASSED.'); break;
        case 'check': sfx('scan', .25); break;
        case 'none': sfx('buzz', .15); break;
        case 'pass': sfx('tick', .3); g.sparks.push({t0: g.clock, i: e.i!}); break;
        case 'clean': sfx('ding', .25); g.pops.push({text: 'ALL SOUND', sub: `${e.n} SAFE FOR GOOD`, c: '#6ef2a0', h: b.ok, t0: g.clock});
          if (e.n === 1 && crackOf(m, b.plan[b.ok - 1]) < .2 && b.ok < n) tip('often', `ONE BLOCK CHECKED, AND THE BUILDING STOOD STILL FOR ${(site.checkS + SCAN_S).toFixed(1)} S. ${name} CRACKS FEW: LET THE RISK CLIMB A LITTLE FIRST.`);
          break;
        case 'crack': {const cost = e.n! * costOf(m, fast);
          g.falls.push({t0: g.clock, from: e.i!, n: e.n!}); g.shockT = g.clock; g.shake = .5; sfx('break', .4); sfx('hit', .2);
          g.pops.push({text: 'CRACK!', sub: `-${e.n} BLOCK${e.n === 1 ? '' : 'S'} · -${money(cost)}`, c: '#ff6a5a', h: e.i! + 1, t0: g.clock});
          say(`A ${KIND[b.plan[e.i!]].word} BLOCK WAS CRACKED: ${e.n === 1 ? 'IT FELL' : `IT AND THE ${e.n! - 1} ON TOP OF IT FELL`}. ${name} BUILDS ${e.n === 1 ? 'IT' : 'THEM'} AGAIN: ${money(cost)} MORE.`);
          if (e.n! >= 4) tip('late', 'THE LONGER YOU WAIT, THE MORE ONE CRACK TAKES DOWN. CHECK BEFORE THE RISK GETS HIGH.');
          break;}
        case 'end': g.endT = g.clock; sfx(b.won ? 'victory' : 'fail', .4); break;
      }
    };
    const step = () => {
      g.clock += DT; g.shake = Math.max(0, g.shake - DT);
      if (!g.tip || g.clock - g.tip.t0 > TIP_S) {const next = g.tips.shift(); g.tip = next ? {text: next, t0: g.clock} : null;}
      // Meb rides the top of the tower: lifted by a new block, dropped by a fall
      const top = g.phase === 'brief' ? 0 : b.tower.length;
      if (g.mebY > top) {g.vy -= G_FALL * DT; g.mebY += g.vy * DT; if (g.mebY <= top) {if (g.vy < -6) {sfx('land', .3); g.landT = g.clock;} g.mebY = top; g.vy = 0;}}
      else {g.vy = 0; g.mebY = Math.min(top, g.mebY + DT * 9);}
      g.camY += (Math.max(2.5, g.mebY) - g.camY) * (1 - Math.exp(-DT * 4));
      if (g.phase !== 'play') return;
      if (b.end) {
        if (g.clock - g.endT > END_HOLD) {g.phase = 'result'; loop('bed-blocks.mp3', 0); ended.current(starKey(site, who, fast), stars(b).filter(Boolean).length);}
        return;
      }
      const tap = g.botFn ? g.botFn(b) : g.tap; g.tap = false;
      for (const e of tick(b, tap)) onEv(e);
      if (!g.late && b.t > site.sunset) {g.late = true; say('THE SUN IS DOWN: THAT STAR IS GONE. FINISH BEFORE NIGHT.');}
    };
    const kd = (e: KeyboardEvent) => {
      if (howOn.current) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (e.repeat) return;
      if (g.phase === 'brief') {
        const at = BUILDERS.indexOf(who);
        if (k === 'enter' || k === ' ') g.start(); if (k === 'escape') quit.current(); if (k === 'h') setHow(true);
        if (k === 'arrowup' || k === 'arrowdown') choose(sel.si + (k === 'arrowup' ? -1 : 1), who);
        if (k === 'arrowleft' || k === 'arrowright') choose(sel.si, BUILDERS[Math.max(0, Math.min(BUILDERS.length - 1, at + (k === 'arrowleft' ? -1 : 1)))]);
        if (k === 'f' && canFast(who)) choose(sel.si, who, !sel.fast);
        return;
      }
      if (g.phase === 'result') {if (k === 'enter' || k === ' ') again(false); if (k === 'c') again(true); if (k === 'escape' || k === 'l') quit.current(); return;}
      if (k === ' ' || k === 'enter') g.tap = true;
      if (k === 'escape') quit.current();
    };
    const down = (e: PointerEvent) => {if (g.phase === 'play' && !(e.target as HTMLElement).closest?.('[data-ui]')) g.tap = true;};
    addEventListener('keydown', kd); addEventListener('pointerdown', down);
    if (g.phase === 'play') begin(); else loop('bed-build.mp3', .1);   // the site's theme; a new pick only sets its volume, it doesn't restart it
    const draw = () => {rigRef.current?.render(worldOf(g)); setTick(t => t + 1);};
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
    // F9 runs 2 s, F10 runs 10 s, F6 runs 0.2 s, F8 taps a check, F7 hands the tower to a bot (meter, each, never, off);
    // the state lands in document.body.dataset.pym
    const hook = (e: KeyboardEvent) => {
      const s = e.key === 'F9' ? 2 : e.key === 'F10' ? 10 : e.key === 'F6' ? .2 : 0;
      if (e.key === 'F8') g.tap = true;
      if (e.key === 'F7') {g.bot = g.bot === null ? 'meter' : g.bot === 'meter' ? 'each' : g.bot === 'each' ? 'never' : null; g.botFn = g.bot ? makeBot(g.bot) : null;}
      for (let i = 0; i < s / DT; i++) step();
      draw();
      document.body.dataset.pym = JSON.stringify({world: 'blocks', site: site.id, who, fast, phase: g.phase, bot: g.bot, t: +b.t.toFixed(1), up: b.tower.length, ok: b.ok, of: n, risk: +riskOf(b).toFixed(2),
        scan: !!b.scan, spent: +b.spent.toFixed(2), laid: b.laid, lost: b.lost, checks: b.checks, cracks: b.cracks, end: b.end, won: b.won, stars: stars(b), mebY: +g.mebY.toFixed(2), tip: g.tip?.text});
    };
    if (location.hash === '#test') addEventListener('keyup', hook);
    return () => {cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('pointerdown', down); removeEventListener('keyup', hook); loop('bed-blocks.mp3', 0); ref.current = null;};
  }, [run, sel]);

  const g = ref.current;
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#b8d8ff', userSelect: 'none', touchAction: 'none'}}>
    <canvas ref={canvas} width={CW} height={CH} style={{position: 'absolute', inset: 0, width: W, height: H}}/>
    {g && g.phase === 'play' && rigRef.current && <Tower g={g} rig={rigRef.current}/>}
    {g && g.phase === 'play' && <Hud g={g} check={() => {g.tap = true;}}/>}
    {g && g.phase === 'play' && g.tip && <div style={{position: 'absolute', left: 300, right: 300, top: 178, textAlign: 'center', pointerEvents: 'none',
      opacity: Math.min(1, (g.clock - g.tip.t0) / .2) * Math.min(1, (TIP_S - (g.clock - g.tip.t0)) / .4)}}>
      <div style={{display: 'inline-block', padding: '6px 22px', ...GLASS, borderRadius: 14, borderColor: '#ffd23f', background: 'rgba(10,16,38,.9)'}}>
        <Mono size={22} style={{lineHeight: 1.3}}>{g.tip.text}</Mono></div></div>}
    {g && g.phase === 'play' && <Btn label="✕ QUIT" size={18} act={onQuit} style={{position: 'absolute', left: 12, top: 6}}/>}
    {g && g.phase === 'brief' && !how && <Pick si={sel.si} who={who} fast={fast} best={best} choose={choose} start={g.start} back={onQuit} how={() => setHow(true)}/>}
    {g && g.phase === 'result' && <Result g={g} again={again} back={onQuit}/>}
    {how && <Explain tag="Tutorial" cards={CARDS} last="Pick a site" done={() => {markSeen(HOW_KEY); setHow(false);}}/>}
  </div>;
};

/* ---------- over the tower: what each unchecked block is, and the one being laid ---------- */
const v3 = new THREE.Vector3();
const Tower: React.FC<{g: G; rig: Rig}> = ({g, rig}) => {
  const b = g.b, t = g.clock, n = b.plan.length, m = b.m;
  const at = (x: number, y: number, z: number) => {v3.set(x, y, z).project(rig.camera); return {x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H};};
  const tag = (i: number, kind: Kind, on: boolean, next = false) => {
    const again = next && i < b.peak;   // a block that fell, being built again: the tag says so, in the crack's red
    const q = at(2.05, i + .5, 2), w = again ? 384 : next ? 330 : 236, x = q.x + 26, u = next ? clamp(b.lay / layOf(m, b.fast)) : 0;
    return <g key={(next ? 'n' : 't') + i} opacity={next ? .92 : 1}>
      <path d={`M${q.x + 4} ${q.y} L${x} ${q.y}`} stroke="#140c1e" strokeWidth={4}/>
      <rect x={x} y={q.y - 21} width={w} height={42} rx={9} fill={on ? '#fff' : 'rgba(14,8,24,.84)'} stroke={again ? '#ff6a5a' : next ? 'rgba(255,255,255,.5)' : KC[kind]} strokeWidth={3} strokeDasharray={next ? '8 6' : undefined}/>
      {next && <rect x={x + 3} y={q.y + 13} width={(w - 6) * u} height={5} rx={2.5} fill={KC[kind]}/>}
      <text x={x + 14} y={q.y + 9} fontFamily="BVP" fontStyle="italic" fontSize={26} fill={on ? '#140c1e' : KC[kind]}>{next ? `${again ? 'REBUILDING' : 'NEXT'} · ${KIND[kind].word}` : KIND[kind].word}</text>
      <text x={x + w - 12} y={q.y + 8} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={22} fill={on ? '#140c1e' : '#fff'}>{pct(crackOf(m, kind))}</text>
    </g>;};
  const scanning = !!b.scan && b.scan.t >= b.site.checkS;
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
    {b.tower.slice(b.ok).map((x, k) => tag(b.ok + k, x.kind, scanning && k === 0))}
    {!b.end && !b.scan && b.tower.length < n && tag(b.tower.length, b.plan[b.tower.length], false, true)}
    {g.pops.filter(p => t - p.t0 < 1.3).map(p => {const u = t - p.t0, q = at(1, p.h + 1.4, 1);   // beside Meb, on the open side of the tower
      return <g key={p.t0 + p.text} opacity={clamp((1.3 - u) / .3)} transform={`translate(${Math.max(250, q.x - 340).toFixed(1)} ${(Math.max(q.y, 330) - u * 40).toFixed(1)}) scale(${(.6 + .4 * clamp(u / .1)).toFixed(2)})`}>
        <Txt x={0} y={0} size={62} anchor="middle" c={p.c} italic>{p.text}</Txt>
        {p.sub && <Txt x={0} y={44} size={30} anchor="middle" font={MONO} stroke={.22}>{p.sub}</Txt>}</g>;})}
    {b.end && g.phase === 'play' && <Txt x={W / 2} y={520} size={170} anchor="middle" c={b.won ? '#ffd23f' : '#ff6a5a'} italic>{b.won ? 'TOWER DONE' : 'NIGHT FELL'}</Txt>}
  </svg>;
};

/* ---------- the HUD: the builder, the blocks checked, the money, the day, the risk, the button ---------- */
const PANEL = 'rgba(14,8,24,.8)';
const Hud: React.FC<{g: G; check: () => void}> = ({g, check}) => {
  const b = g.b, st = b.site, m = b.m, n = b.plan.length, open = b.tower.length - b.ok, risk = riskOf(b), over = b.spent > st.budget + 1e-9, play = g.phase === 'play' && !b.end;
  const day = clamp(b.t / st.dark), dusk = st.sunset / st.dark, left = b.t <= st.sunset ? st.sunset - b.t : st.dark - b.t;
  const scanN = b.scan ? Math.min(open, Math.max(0, Math.floor((b.scan.t - st.checkS) / SCAN_S)) + 1) : 0, wait = b.scan ? clamp(b.scan.t / st.checkS) : 0;
  return <>
    <div style={{position: 'absolute', left: 150, top: 10, width: 560, height: 92, padding: '8px 22px', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <div style={{width: 22, height: 22, borderRadius: 7, background: m.paint, border: '2px solid #fff', flex: 'none'}}/>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 38, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{nameOf(b.who, b.fast)}</div>
        <Mono size={17} color="#c9bedc" style={{whiteSpace: 'nowrap'}}>{money(costOf(m, b.fast))} A BLOCK</Mono>
      </div>
      <Mono size={18} color="#c9bedc" style={{letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap'}}>{st.job} · IT BUILDS, MEB CHECKS</Mono>
    </div>
    <div style={{position: 'absolute', left: W / 2 - 130, top: 10, width: 260, height: 92, textAlign: 'center', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 52, color: '#fff', lineHeight: 1.1}}>{b.ok}<span style={{fontSize: 30, color: '#c9bedc'}}> / {n}</span></div>
      <Mono size={16} color="#c9bedc" style={{letterSpacing: '.14em'}}>BLOCKS CHECKED</Mono></div>
    <div style={{position: 'absolute', right: 24, top: 10, width: 600, height: 92, padding: '8px 22px', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 38, color: over ? '#ff8a7a' : '#fff', lineHeight: 1.1}}>SPENT {money(b.spent)}</div>
        <Mono size={18} color={over ? '#ff8a7a' : '#ffd23f'}>★ {money(st.budget)} OR LESS</Mono></div>
      <div style={{height: 14, borderRadius: 7, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginTop: 8}}>
        <div style={{width: `${clamp(b.spent / st.budget) * 100}%`, height: '100%', background: over ? '#ff8a7a' : '#ffd23f'}}/></div>
    </div>
    {/* the day: the sun crosses it; the star is at sunset, the end is night */}
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <rect x={150} y={110} width={1746} height={28} rx={14} fill={PANEL} stroke="#000" strokeWidth={2}/>
      <rect x={156} y={116} width={1734 * dusk} height={16} rx={8} fill="rgba(255,210,63,.28)"/>
      <rect x={156 + 1734 * dusk} y={116} width={1734 * (1 - dusk)} height={16} rx={8} fill="rgba(90,70,160,.5)"/>
      <rect x={156} y={116} width={1734 * day} height={16} rx={8} fill={b.t <= st.sunset ? '#ffd23f' : '#8a6ad8'}/>
      <text x={156 + 1734 * dusk} y={160} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={18} fill="#fff" stroke="#140c1e" strokeWidth={5} paintOrder="stroke">★ SUNSET</text>
      <text x={1888} y={160} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={18} fill="#fff" stroke="#140c1e" strokeWidth={5} paintOrder="stroke">NIGHT</text>
      <circle cx={156 + 1734 * day} cy={124} r={15} fill={b.t <= st.sunset ? '#fff3b0' : '#dfe6f5'} stroke="#140c1e" strokeWidth={3}/>
      {play && <text x={W / 2} y={131} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={19} fill={left < 10 ? '#ff8a7a' : '#fff'} stroke="#140c1e" strokeWidth={5} paintOrder="stroke" letterSpacing={1}>
        {mmss(left)} TO {b.t <= st.sunset ? 'SUNSET' : 'NIGHT'}</text>}
    </svg>
    {/* the risk, and the one button */}
    {play && <div style={{position: 'absolute', right: 24, top: 330, width: 440, padding: '14px 24px 18px', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      {b.scan ? <>
        <Mono size={18} color="#c9bedc" style={{letterSpacing: '.14em'}}>CHECKING</Mono>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 54, color: '#fff', lineHeight: 1.15}}>{wait < 1 ? 'TESTS STARTING' : `BLOCK ${scanN} OF ${open}`}</div>
        <div style={{height: 18, borderRadius: 9, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginTop: 8}}>
          <div style={{width: `${(wait < 1 ? wait : clamp((b.scan.t - st.checkS) / (open * SCAN_S))) * 100}%`, height: '100%', background: wait < 1 ? '#8fd3ff' : '#fff'}}/></div>
        <Mono size={18} color="#c9bedc" style={{marginTop: 8}}>THE BUILDING WAITS</Mono></> : <>
        <Mono size={18} color="#c9bedc" style={{letterSpacing: '.14em'}}>RISK OF A CRACK IN THE UNCHECKED</Mono>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 104, color: open ? riskC(risk) : 'rgba(255,255,255,.35)', lineHeight: 1.05}}>{pct(risk)}</div>
        <div style={{height: 18, borderRadius: 9, background: 'rgba(255,255,255,.18)', overflow: 'hidden'}}>
          <div style={{width: `${risk * 100}%`, height: '100%', background: riskC(risk)}}/></div>
        <Mono size={18} color="#fff" style={{marginTop: 8}}>{open ? `${open} UNCHECKED · ${money(open * costOf(m, b.fast))} AT STAKE` : 'NOTHING TO CHECK YET'}</Mono></>}
      <Btn main={!b.scan && open > 0} label="CHECK ✓" k="SPACE" size={40} act={check} style={{marginTop: 14, width: '100%', opacity: !b.scan && open > 0 ? 1 : .45}}/>
      <Mono size={16} color="#c9bedc" style={{marginTop: 12, lineHeight: 1.35}}>A CHECK STOPS THE BUILDING FOR {st.checkS} S, THEN TESTS EACH BLOCK FROM THE BOTTOM UP.</Mono>
    </div>}
  </>;
};

/* ---------- before and after: a block-building game's menus (the user's "Do A": each world's menus copy its own genre,
   DESIGN-menus.md). Stone buttons and dark panels over the land, the sites as a world list, the builders as a hotbar;
   a crack chance is ten blocks with that many cracked. ---------- */
const ABS = (left: number, top: number, s: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left, top, ...s});
const SHADOW = (size: number, c = '#fff'): React.CSSProperties => {const d = Math.max(3, Math.round(size / 14)); return {...txt(size, 700, c), textShadow: `${d}px ${d}px 0 #2b2b2b`, whiteSpace: 'nowrap'};};
const PANEL_B: React.CSSProperties = {background: 'rgba(14,10,20,.86)', border: '5px solid #1a1426', boxShadow: 'inset 0 0 0 4px #4a2f8a', boxSizing: 'border-box', color: '#fff'};
const stone = (on = false): React.CSSProperties => ({background: on ? '#a9a9a9' : '#7a7a7a', border: '5px solid #1a1426', outline: on ? '4px solid #fff' : 'none',
  boxShadow: 'inset 5px 5px 0 rgba(255,255,255,.35), inset -5px -6px 0 rgba(0,0,0,.35)', boxSizing: 'border-box', color: '#fff', cursor: 'pointer'});
const goals = (st: Site) => ['Finish', 'Before sunset', `${money(st.budget)} max`];   // goalsOf, in a chip's few words
const BLURB: Partial<Record<ModelId, string>> = {sonnet5: 'Slow, and cracks on hard', sonnet55: 'Cheapest and quickest, sound on medium',
  opus5: 'Slow and pricey, soundest on hard', opus55: 'Soundest on medium', fable51: 'The dearest, and slow'};
/** A stone button; the screen's main action is the grass one. */
const Stone: React.FC<{label: string; icon?: IconName; act: () => void; w: number; h: number; grass?: boolean}> = ({label, icon, act, w, h, grass}) =>
  <div data-ui="btn" onClick={e => {e.stopPropagation(); act();}} style={{...stone(), width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
    ...(grass ? {background: 'linear-gradient(#6cc644 0 24%, #4f9a2f 24% 30%, #8a5a34 30%)'} : {})}}>
    {icon && icon !== 'arrow' && <Icon name={icon} size={h * .4} w={3.4}/>}<span style={SHADOW(h * .42)}>{label}</span>{icon === 'arrow' && <Icon name={icon} size={h * .4} w={3.4}/>}</div>;
/** How often a block of this kind cracks, as ten blocks with that many cracked. */
const Cracks: React.FC<{p: number; c: string}> = ({p, c}) => <svg width={300} height={40}>{[...Array(10)].map((_, i) =>
  <Iso key={i} x={15 + i * 29} y={3} s={17} c={i < Math.round(p * 10) ? '#ff8a7a' : c} crack={i < Math.round(p * 10)}/>)}</svg>;
/** A site's blocks by kind, as a little grid: what the job is made of. */
const Mix: React.FC<{st: Site}> = ({st}) => <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, 15px)', gap: 3, alignContent: 'end', height: 56}}>
  {st.mix.flatMap(([k, c]) => Array<Kind>(c).fill(k)).map((k, i) => <span key={i} style={{width: 15, height: 15, background: KC[k], border: '2px solid #1a1426', boxSizing: 'border-box'}}/>)}</div>;
const Stat: React.FC<{icon: IconName; val: string; w: string}> = ({icon, val, w}) => <div>
  <div style={{display: 'flex', alignItems: 'center', gap: 10}}><span style={{display: 'flex', color: '#ffd23f'}}><Icon name={icon} size={36} w={2.8}/></span><span style={SHADOW(44)}>{val}</span></div>
  <div style={txt(22, 500, MUTE)}>{w}</div></div>;

/** Before a tower: the sites as a world list, the builder's stats as a tooltip, the builders as a hotbar, BUILD. */
const Pick: React.FC<{si: number; who: ModelId; fast: boolean; best: Record<string, number>; choose: (si: number, who: ModelId, fast?: boolean) => void; start: () => void; back: () => void; how: () => void}> =
  ({si, who, fast, best, choose, start, back, how}) => {
  const st = SITES[si], m = MODELS[who];
  return <div style={ABS(0, 0, {width: W, height: H})}>
    <style>{ANIM}</style>
    <div style={ABS(0, 0, {width: W, height: H, background: 'radial-gradient(ellipse at 50% 42%, transparent 25%, rgba(10,8,20,.6) 80%)', pointerEvents: 'none'})}/>
    <Round icon="back" act={back} style={ABS(40, 30)}/>
    <Round icon="help" act={how} style={ABS(W - 40 - TAP, 30)}/>
    <div style={ABS(0, 34, {width: W, textAlign: 'center', pointerEvents: 'none', ...SHADOW(54)})}>Pick a site</div>
    <div style={ABS(60, 128, {display: 'flex', flexDirection: 'column', gap: 14})}>{SITES.map((x, k) => {const on = k === si;
      return <div key={x.id} onClick={() => choose(k, who)} style={{...PANEL_B, width: 720, height: 160, padding: '12px 22px', display: 'flex', gap: 22, alignItems: 'center', cursor: 'pointer',
        outline: on ? '5px solid #fff' : 'none', background: on ? 'rgba(46,34,84,.94)' : PANEL_B.background}}>
        <div style={{...colB(6), width: 204}}><Mix st={x}/><span style={txt(20, 500, MUTE)}>{blocksOf(x)} blocks</span></div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}><span style={SHADOW(34)}>{cap(x.job)}</span><Stars n={bestOf(best, x)} size={28}/></div>
          <div style={{...txt(23, 500, MUTE), marginTop: 6}}>{x.line}</div></div></div>;})}</div>
    {/* the builder, as a tooltip */}
    <div key={who + fast} style={ABS(1180, 128, {...PANEL_B, width: 680, padding: '18px 30px 26px', animation: 'pym-pop .35s ease-out'})}>
      <div style={SHADOW(58, mix(m.paint, '#ffffff', .4))}>{nm(who)}{fast ? ' · fast' : ''}</div>
      <div style={txt(26, 500, MUTE)}>{BLURB[who]}</div>
      <div style={{display: 'flex', gap: 48, marginTop: 16}}><Stat icon="coin" val={money(costOf(m, fast))} w="a block"/>
        <Stat icon="clock" val={`${layOf(m, fast).toFixed(1)} s`} w={`a block here, ${mmss(realOf(m, fast))} for real`}/></div>
      <div style={{...txt(24, 500, MUTE), marginTop: 18}}>How often a block cracks</div>
      {st.mix.map(([k, c]) => <div key={k} style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 6}}>
        <span style={{...txt(24, 700, KC[k]), width: 140}}>{cap(KIND[k].word)} ×{c}</span><Cracks p={crackOf(m, k)} c={m.paint}/><span style={{...SHADOW(32), marginLeft: 'auto'}}>{pct(crackOf(m, k))}</span></div>)}
      {canFast(who) && <div data-ui="btn" onClick={() => choose(si, who, !fast)} style={{...stone(fast), marginTop: 18, height: Math.max(64, TAP), display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px',
        background: fast ? '#5fb8ff' : '#7a7a7a'}}><span style={SHADOW(28)}>Fast mode {fast ? 'on' : 'off'}</span><span style={txt(22, 700, fast ? INK : '#e8e8e8')}>×{m.fast!.k} faster · ×{m.fast!.outP / m.outP} the price</span></div>}
    </div>
    <div style={ABS(1180, 740, {display: 'flex', gap: 10})}>
      {goals(st).map(gl => <span key={gl} style={{display: 'flex', alignItems: 'center', gap: 8, height: 50, padding: '0 18px 0 10px', background: 'rgba(14,10,20,.8)', border: '3px solid #1a1426', whiteSpace: 'nowrap', ...txt(24, 700)}}><Star on size={28}/>{gl}</span>)}</div>
    {/* the builders, as a hotbar */}
    <div style={ABS(60, 892, {display: 'flex', gap: 8, padding: 8, background: 'rgba(14,10,20,.7)', border: '5px solid #1a1426'})}>{BUILDERS.map(id => {const on = id === who, b = Math.max(best[starKey(st, id, false)] ?? 0, best[starKey(st, id, true)] ?? 0);
      return <div key={id} onClick={() => choose(si, id)} style={{width: 140, height: 140, position: 'relative', cursor: 'pointer', boxSizing: 'border-box', background: on ? '#b5b5b5' : '#8b8b8b',
        boxShadow: 'inset 5px 5px 0 rgba(0,0,0,.3), inset -5px -5px 0 rgba(255,255,255,.35)', outline: on ? '6px solid #fff' : 'none', zIndex: on ? 1 : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8}}>
        <svg width={80} height={80} style={{position: 'absolute', top: 6, left: 30}}><Iso x={40} y={6} s={34} c={MODELS[id].paint}/></svg>
        {b > 0 && <div style={{position: 'absolute', right: 4, top: 2}}><Stars n={b} size={18}/></div>}
        {id === who && fast && <div style={{position: 'absolute', left: 6, top: 4, ...SHADOW(22, '#8fd3ff')}}>fast</div>}
        <span style={SHADOW(20)}>{nm(id)}</span></div>;})}</div>
    <div style={ABS(1460, 892)}><Stone label="Build" icon="arrow" act={start} w={400} h={160} grass/></div>
    {/* between the hotbar and Build, where nothing sits */}
    <div style={ABS(980, 0, {width: 470, height: 1080})}><Keys text={`↑↓ site · ←→ builder · ${canFast(who) ? 'F fast · ' : ''}Enter build`}/></div>
  </div>;
};

/** The tip a result ends on, by what happened: a Claude Code command and what it does. */
function tipOfB(b: Build): [string, string] {
  const best = rhythmOf(b.site, b.m), every = b.checks ? b.laid / b.checks : 0;
  if (!b.won) return canFast(b.who) && !b.fast ? ['/fast', 'The same model, sooner, at twice the price: for a day that runs short.'] : ['/model', 'When the day is short, switch to a quicker model, and switch back after.'];
  if (b.biggest >= 4) return ['CLAUDE.md', `Write "run the tests after each step" in it. Found early, a crack takes one block down, not ${b.biggest}.`];
  if (b.checks && every < best - 1.2) return ['CLAUDE.md', 'Say when to test: after each part, not every line. A test run costs time too.'];
  return ['/rewind', 'When a step goes wrong, go back to just before it, instead of building on top of it.'];
}
const Count: React.FC<{icon: IconName; c: string; n: number | string; w: string}> = ({icon, c, n, w}) =>
  <span style={{display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(14,10,20,.8)', border: '3px solid #1a1426', ...txt(28, 700)}}>
    <span style={{display: 'flex', color: c}}><Icon name={icon} size={30} w={3}/></span>{n}<span style={txt(22, 500, MUTE)}>{w}</span></span>;
/** After a tower: the tower stays on the left; the title, the stars, the counts, the tip as an advancement, every builder as a hotbar. */
const Result: React.FC<{g: G; again: (pick: boolean) => void; back: () => void}> = ({g, again, back}) => {
  const b = g.b, st = b.site, got = stars(b), [more, setMore] = useState(false), [cmd, tip] = tipOfB(b);
  const rows = BUILDERS.flatMap(id => (canFast(id) ? [false, true] : [false]).map(f => {const u = usualOf(st, id, f); return {id, f, u, n: u.won < .5 ? 0 : 1 + +(u.t <= st.sunset) + +(u.spent <= st.budget)};}));
  const mine = rows.find(r => r.id === b.who && r.f === b.fast)!, top = [...rows].sort((x, y) => y.n - x.n || x.u.spent - y.u.spent)[0], better = top !== mine && top.n > mine.n;
  return <div style={ABS(0, 0, {width: W, height: H})}>
    <style>{ANIM}</style>
    <div style={ABS(0, 0, {width: W, height: H, background: 'linear-gradient(90deg, transparent 32%, rgba(10,8,20,.78) 46%)'})}/>
    <In at={.1} how="slam" snd="slam" vol={.3} style={ABS(860, 20, {width: 1020, textAlign: 'center'})}><span style={SHADOW(124, b.won ? '#ffe066' : '#ff8a7a')}>{b.won ? 'Tower done!' : 'Night fell'}</span></In>
    <div style={ABS(880, 196, txt(28, 500, MUTE))}>{nm(b.who)}{b.fast ? ' · fast' : ''} · {cap(st.job)}</div>
    <div style={ABS(880, 240, {display: 'flex', gap: 40})}>{got.map((ok, i) => <In key={i} at={.5 + i * .3} how="slam" snd={ok ? 'ding' : 'buzz'} vol={.25}><div style={colB(8)}><Star on={ok} size={130} rot={(i - 1) * 9}/>
      <span style={{display: 'flex', alignItems: 'center', gap: 8, ...txt(26, 700, ok ? '#fff' : MUTE)}}><span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff8a7a'}}><Icon name={ok ? 'check' : 'cross'} size={28} w={3.2}/></span>{goals(st)[i]}</span></div></In>)}</div>
    <In at={1.4} how="up" style={ABS(880, 448)}><div style={{display: 'flex', gap: 12, flexWrap: 'wrap', width: 980}}>
      <Count icon="check" c="#6ef2a0" n={b.checks} w={b.checks === 1 ? 'check' : 'checks'}/><Count icon="cross" c="#ff8a7a" n={b.cracks} w={b.cracks === 1 ? 'crack' : 'cracks'}/>
      <Count icon="list" c="#ff8a7a" n={b.lost} w="blocks fell"/><Count icon="clock" c="#ffd23f" n={mmss(b.t)} w=""/><Count icon="coin" c="#ffd23f" n={money(b.spent)} w=""/></div></In>
    {/* the tip, as an advancement */}
    <In at={1.8} how="left" snd="ding" vol={.2} style={ABS(880, 540)}><div style={{...PANEL_B, width: 980, padding: '16px 26px', display: 'flex', gap: 22, alignItems: 'center'}}>
      <svg width={70} height={76} style={{flex: 'none'}}><Iso x={35} y={4} s={34} c="#ffd23f"/></svg>
      <div style={{flex: 1}}><div style={{display: 'flex', alignItems: 'center', gap: 16}}><span style={SHADOW(30, '#ffe066')}>Tip</span>
        <span style={{padding: '2px 16px', background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 28, color: '#39ff88'}}>{cmd}</span></div>
        <div style={{...txt(26, 500), marginTop: 6}}>{tip}</div></div></div></In>
    <div style={ABS(880, 694, txt(24, 500, MUTE))}>Same site, every builder · each checks at a third</div>
    <div style={ABS(880, 756, {display: 'flex', gap: 6, padding: 6, background: 'rgba(14,10,20,.7)', border: '4px solid #1a1426'})}>{rows.map(r => {const me = r === mine;
      return <div key={r.id + r.f} style={{width: 112, height: 160, position: 'relative', boxSizing: 'border-box', background: me ? '#b5b5b5' : '#8b8b8b', outline: me ? '5px solid #fff' : 'none', zIndex: me ? 1 : 0,
        boxShadow: 'inset 4px 4px 0 rgba(0,0,0,.3), inset -4px -4px 0 rgba(255,255,255,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6}}>
        {better && r === top && <div style={{position: 'absolute', top: -24, padding: '0 10px', background: '#ffc93f', border: '3px solid #1a1426', ...txt(18, 700, INK), whiteSpace: 'nowrap'}}>Try this</div>}
        <svg width={50} height={52}><Iso x={25} y={2} s={24} c={MODELS[r.id].paint}/></svg>
        <span style={SHADOW(18)}>{nm(r.id)}</span><span style={{...SHADOW(16, '#8fd3ff'), minHeight: 20}}>{r.f ? 'fast' : ''}</span>
        <Stars n={r.n} size={22}/><span style={{...txt(16, 700), marginTop: 2}}>{r.u.won < .5 ? 'Night' : money(r.u.spent)}</span></div>;})}</div>
    <div style={ABS(880, 946, {display: 'flex', gap: 22, alignItems: 'flex-start'})}>   {/* a phone's round buttons are 100 tall: the labels still end above 1080 */}
      <Stone label="Again" icon="retry" act={() => again(false)} w={300} h={96} grass/>
      {([['list', 'Breakdown', () => setMore(true)], ['users', 'Sites and builders', () => again(true)], ['map', 'Map', back]] as [IconName, string, () => void][]).map(([ic, l, a]) =>
        <div key={l} onClick={a} style={{...colB(4), cursor: 'pointer'}}><Round icon={ic} act={a}/><span style={txt(20, 500, MUTE)}>{l}</span></div>)}</div>
    {more && <Sheet title="Breakdown" close={() => setMore(false)}>{resultLines(b).map((l, i) => <div key={i} style={{...txt(28, 500, i ? MUTE : '#fff'), marginTop: i ? 10 : 0, maxWidth: 1400}}>{l}</div>)}</Sheet>}
  </div>;
};
