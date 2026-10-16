/**
 * World 4, the arena: the screen. The rules are arena.ts; the look is the video's fighting game
 * (remotion/src/opus55): its rooftop in three.js (fight3d.ts) and, drawn over it through the same camera, Meb with
 * his headband and effort aura and the jobs (fightkit.tsx).
 * First the cards (explain.tsx): what effort is and how Claude works, once. Then you pick a round and a fighter. In the
 * fight the model takes a first try at every job at the dial's level; when one misses, you read the sign over it and
 * tap its fix (1 to 5). The dial (↑ ↓) sets the level for first tries.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {build} from '../../remotion/src/opus55/fight3d';
import type {Rig, V3} from '../../remotion/src/opus55/fight3d';
import {Boss, Fighter, LV} from '../../remotion/src/opus55/fightkit';
import {Txt} from '../../remotion/src/opus55/chrome';
import {hash} from '../../remotion/src/opus55/mebvec';
import type {FP} from '../../remotion/src/opus55/mebvec';
import {BOLD, MONO, clamp} from '../../remotion/src/meb-hatch/rig';
import {Btn, CH, CW, GLASS, H, Mono, TOUCH, W} from './race';
import {Button, GOLD, Hit, INK, Icon, Keys, MUTE, Proof, Sheet, Star, Stars, TAP, UI, WORLD_BLUR, cap, nm, outline, txt} from './ui';
import type {IconName} from './ui';
import {DT, money} from './rules';
import {FIGHTERS, FIXES, FIX_WORD, SIGN_WORD, STAGES, WHY, YOUR_S, canFix, dialOf, dialRows, fix, goalsOf, makeBot, makeFight, mixOf, resultLines, setDial, signOf, stars, target, tick, tipOf} from './arena';
import type {AEv, Bot, Fight, Fix, Job, Sign, Stage} from './arena';
import {CLEANER, DOCS_EFFORT, DOCS_LOOP, MISSES, MODELS, SPEND} from './stats';
import type {MissKind, Misses, ModelId} from './stats';
import {loop, sfx} from './sound';
import {Count, Explain, In, Moves, markSeen, seen, useT} from './explain';
import type {Card} from './explain';

/* ---------- the stage: one fixed camera on the roof ---------- */
const CAM = {pos: [.3, 1.9, 11.5] as V3, look: [.3, 1.35, 0] as V3, fov: 30};
const eye = new THREE.PerspectiveCamera(CAM.fov, W / H, .1, 1500), v3 = new THREE.Vector3();
eye.position.set(...CAM.pos); eye.lookAt(...CAM.look); eye.updateProjectionMatrix(); eye.updateMatrixWorld();
const UNIT = 1.5 / 36.2;     // metres per rig cell: Meb stands 1.5 m
/** Screen position of a point on the stage and the rig scale there (px per cell). */
const onStage = (x: number, y: number) => {
  v3.set(x, y, 0).project(eye); const ax = (v3.x + 1) / 2 * W, ay = (1 - v3.y) / 2 * H;
  v3.set(x, y + 1, 0).project(eye);
  return {x: ax, y: ay, k: (ay - (1 - v3.y) / 2 * H) * UNIT};
};
const MEB_X = -4.1, X_HIT = -2.9, X_IN = 6.3;   // metres: Meb, where a job reaches him, where it walks on
const xOf = (p: number) => X_HIT + (X_IN - X_HIT) * p;
const sizeOf = (j: Job) => j.boss ? .9 : .56;   // the video's boss, at two sizes
const TIP_S = 5, END_HOLD = 1.8, KO_S = .6, PAST_S = .4;

/* ---------- Meb's poses (the video's own) ---------- */
const stance = (f: number): FP => {const b = Math.sin(f / 5.2);
  return {face: 'fierce', armR: 64 + b * 5, armL: 52 - b * 4, reachR: .95, sy: .975 + b * .016, sx: 1.012 - b * .01, look: .9, ear: -3 + b * 2};};
const PUNCH: FP = {face: 'shout', armR: 90, reachR: 1.8, armL: 60, tilt: 7, sx: 1.03, look: 1};
const HURT: FP = {face: 'hurt', tilt: -15, armR: 40, armL: 40, sy: 1.02, ear: 18};
const DOWN: FP = {face: 'ko', tilt: -88, armL: 150, armR: 20, ear: 20};
const WIN = (f: number): FP => ({face: 'happy', armR: 128, reachR: 1.5, armL: 22, ear: -12, lift: Math.abs(Math.sin(f / 5)) * 1.2});

/* ---------- the signs ---------- */
const SIGN_C: Record<Sign, string> = {sloppy: '#ffd23f', top: '#ff5a6e', guessed: '#8fd3ff', rule: '#6ef2a0', again: '#c9bedc'};
const FIX_SIGN: Record<Fix, Sign> = {effort: 'sloppy', rewrite: 'guessed', context: 'rule', tag: 'top', again: 'again'};
/** Our own example of each kind of miss in figure B, for the sign. */
const KIND_LINE: Record<MissKind, string> = {bug: 'A BUG ITS OWN TESTS MISSED', works: 'IT WORKS ON ITS MACHINE, NOT YOURS', overfit: 'IT ONLY WORKS ON THE EXAMPLES',
  close: 'CLOSE, BUT NOT EXACT', misread: 'IT SKIPPED A LINE OF THE ASK', fix: 'THE FIX FIXED HALF OF IT', reading: 'YOU SAID MENU. IT MADE A DROPDOWN.',
  domain: 'IT DIDN\'T KNOW TAX GOES ON LAST', other: 'IT CRASHED. NOTHING TO READ.'};
/** Said the first time each sign comes up. */
const FIRST: Record<Sign, string> = {sloppy: 'SLOPPY: IT UNDERSTOOD YOU AND DIDN\'T CHECK ITS WORK. EFFORT UP TRIES IT ONCE MORE, ONE LEVEL HIGHER.',
  top: 'SLOPPY, WITH THE DIAL AT THE TOP: NOTHING HIGHER IS LEFT ON THIS MODEL.', guessed: 'GUESSED WHAT YOU MEANT: IT PICKED THE WRONG MEANING. REWRITE THE ASK.',
  rule: 'DIDN\'T KNOW YOUR RULE: ONLY YOU KNOW IT. ADD CONTEXT.', again: 'IT FELL OVER: NOTHING TO READ. TRY AGAIN.'};
/** Each sign's picture, drawn round 0,0 about 40 px across. Its fix button carries the same one. */
const Glyph: React.FC<{s: Sign; c: string}> = ({s, c}) => <g fill="none" stroke={c} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
  {s === 'sloppy' && <path d="M-4 -18 L5 -5 L-5 3 L4 18"/>}
  {s === 'top' && <path d="M-16 -16 L16 -16 M0 18 L0 -8 M-8 0 L0 -8 L8 0"/>}
  {s === 'guessed' && <path d="M0 18 L0 3 L-12 -12 M0 3 L12 -12 M-12 -12 L-12 -3 M-12 -12 L-3 -12"/>}
  {s === 'rule' && <path d="M-13 -16 H13 V16 H-13 Z M-6 -16 V16 M1 -7 H8 M1 0 H8"/>}
  {s === 'again' && <path d="M12 -7 A13 13 0 1 0 13 4 M12 -7 L12 -17 M12 -7 L2 -8"/>}
</g>;
const ciOf = (name: string) => Math.max(0, LV.findIndex(l => l.name === name));

/* ---------- the cards it opens with (explain.tsx): the numbers come from stats.ts ---------- */
const sloppy = (m: Misses) => m.bug + m.works + m.overfit + m.close + m.misread + m.fix;
const triesOf = (m: Misses) => m.pass + sloppy(m) + m.reading + m.domain + m.other;
const FB = MISSES.fable51!, FLOW = FB[0], FMAX = FB[FB.length - 1], FX = FB.find(m => m.name === 'X-HIGH')!;
const BY = 'Thariq Shihipar (Anthropic), "Using Claude Code: Spending your effort", 25 Sep 2026';
const by = (where = '') => <Proof to={SPEND}>{BY}{where}</Proof>;   // a card's source line: the article, as a link
const LOOP = ['Your ask', 'Gather context', 'Take action', 'Check the result', 'Done'];
/** A fighter for a card: Meb at a level's aura, in a model's band, breathing; with `at`, his aura charges up then. */
const Fig: React.FC<{lv: number; band?: string; k?: number; w?: number; h?: number; at?: number}> = ({lv, band, k = 5, w = 280, h = 240, at}) => {
  const t = useT(), fr = t * 30 + lv * 9, up = at === undefined ? 1 : clamp((t - at) / .5);
  return <svg width={w} height={h} style={{overflow: 'visible'}}><Fighter id={`cf${lv}${band?.slice(1)}${k}`.replace(/\./g, '')} x={w / 2} y={h - 10} k={k} f={fr} p={stance(fr)} look={{aura: (lv + .55) * up, band}}/></svg>;
};
/** A fighter that lands at `at` with his level's power-up sound, his aura charging, over his level's name. */
const FigIn: React.FC<{lv: number; at: number; band?: string; k?: number; w?: number; h?: number}> = ({lv, at, ...f}) =>
  <In at={at} snd={`lvl${lv + 1}`} vol={.25}><div style={col(14)}><Fig lv={lv} at={at} {...f}/><Lvl i={lv}/></div></In>;
const Lvl: React.FC<{i: number}> = ({i}) => <div style={{padding: '6px 26px', borderRadius: 30, background: LV[i].c, ...txt(28, 700, INK)}}>{cap(LV[i].name)}</div>;
const FAB = MODELS.fable51.paint;
/** Five tries, stamped in one at a time from `at`, every `gap` s: a tick for a pass, a cross for a miss. */
const Runs: React.FC<{ok: number; at: number; gap: number}> = ({ok, at, gap}) => <div style={{display: 'flex', gap: 12}}>{[...Array(5)].map((_, i) =>
  <In key={i} at={at + i * gap} how="slam" snd={i < ok ? 'check' : 'buzz'} vol={.18}><div style={{width: 64, height: 64, borderRadius: 14, display: 'grid', placeItems: 'center',
    background: i < ok ? '#6ef2a0' : 'rgba(255,90,110,.2)', border: i < ok ? 'none' : '3px solid #ff5a6e', color: i < ok ? INK : '#ff5a6e', boxSizing: 'border-box'}}><Icon name={i < ok ? 'check' : 'cross'} size={40} w={3.2}/></div></In>)}</div>;
/** The loop, played: its steps land, then a spark runs it, back round once from "Check the result", lighting each step it reaches. */
const PILL = (i: number): [number, number] => [i * 320 + 130, 140];   // the spark's path runs under the steps
const LEGS = [[0, 1], [1, 2], [2, 3], [3, -1], [1, 2], [2, 3], [3, 4]];   // -1: back round to "Gather context"
const ARC: [number, number][] = [[1090, 140], [1090, 205], [450, 205], [450, 140]];
const bez = (e: number) => [0, 1].map(j => (1 - e) ** 3 * ARC[0][j] + 3 * (1 - e) ** 2 * e * ARC[1][j] + 3 * (1 - e) * e * e * ARC[2][j] + e ** 3 * ARC[3][j]) as [number, number];
const LoopArt: React.FC = () => {
  const t = useT(), LEG = .55, run = t - 2, lap = LEGS.length * LEG + 1.2, u = run % lap, k = Math.floor(u / LEG), v = u / LEG - k;
  let at: [number, number] | null = null, lit = -1;
  if (run >= 0) {
    if (k >= LEGS.length) {at = PILL(4); lit = 4;}
    else {const [a, b] = LEGS[k], e = v < .5 ? 2 * v * v : 1 - 2 * (1 - v) ** 2, p = PILL(a), q = PILL(b < 0 ? 1 : b);
      at = b < 0 ? bez(e) : [p[0] + (q[0] - p[0]) * e, p[1]]; lit = v < .5 ? a : b < 0 ? 1 : b;}
  }
  useEffect(() => {if (lit >= 0 && run < lap) sfx('blip', .2);}, [lit]);   // a blip per step, the first time round
  const back = run >= 0 && k === 3;
  return <svg width={1560} height={250} style={{overflow: 'visible'}}>{LOOP.map((w, i) => {const on = i === lit, mid = i && i < 4;
    return <In key={w} g at={.6 + i * .22} snd="pop" vol={.15}><g transform={`translate(${i * 320} 30)`}>
      <rect width={260} height={90} rx={45} fill={on ? GOLD : mid ? 'rgba(255,201,63,.2)' : 'rgba(255,255,255,.1)'} stroke={on || mid ? GOLD : 'rgba(255,255,255,.4)'} strokeWidth={on ? 5 : 2.5}/>
      <text x={130} y={55} textAnchor="middle" fontFamily={UI} fontWeight={700} fontSize={26} fill={on ? INK : '#fff'}>{w}</text>
      {i < 4 && <path d="M270 45 L310 45 M300 35 L310 45 L300 55" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" fill="none"/>}</g></In>;})}
    <In g at={1.7}><path d={`M${ARC[0]} C${ARC[1]} ${ARC[2]} ${ARC[3]} M440 152 L450 140 L460 152`} stroke={GOLD} strokeWidth={back ? 7 : 3.5} strokeLinecap="round" fill="none"/>
      <text x={770} y={242} textAnchor="middle" fontFamily={UI} fontWeight={back ? 700 : 500} fontSize={back ? 28 : 24} fill={GOLD}>Not yet: round again</text></In>
    {at && <g transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)})`}><circle r={24} fill={GOLD} opacity={.35}/><circle r={12} fill="#fff"/></g>}</svg>;
};
const SKEW: React.CSSProperties = {transform: 'skewX(-10deg)'};
const col = (gap: number): React.CSSProperties => ({display: 'flex', flexDirection: 'column', alignItems: 'center', gap});
const CHIP: React.CSSProperties = {padding: '6px 24px', background: GOLD, ...SKEW};
/** Each card builds in reading order (explain.tsx `In`): fighters land with their level's power-up, counts count up. */
const CARDS: Card[] = [
  {title: 'Does more effort make Claude smarter?', lines: ['Claude Code has a dial for *how hard Claude works*, from *Low* to *Max*.'],
    art: <div style={{display: 'flex', gap: 20, alignItems: 'flex-end'}}>{LV.map((l, i) => <FigIn key={l.name} lv={i} at={.7 + i * .35} k={6.4} w={320} h={300}/>)}</div>},
  {title: 'How Claude works on a job', lines: ['You ask. Claude *reads, changes, checks*, and goes round again until it\'s done.'], qAt: 2.4,
    quote: {text: 'it works through three phases: gather context, take action, and verify results.', who: 'Claude Code docs, "How Claude Code works"', to: DOCS_LOOP},
    art: <LoopArt/>},
  {title: 'Two knobs, not one', lines: ['More effort: *more files read, more tools run, more checking*.'], qAt: 2.9,
    quote: {text: 'Lower effort also means fewer and terser tool calls.', who: 'Claude Platform docs, "Effort"', to: DOCS_EFFORT},
    art: <div style={{display: 'flex', gap: 150}}>{([['The model', 'what Claude knows, and how well it reasons', .6, FIGHTERS.map((id, j) =>
        <In key={id} at={.6 + j * .2} snd="pop" vol={.15}><Fig lv={-1} band={MODELS[id].paint} k={4.6} w={210} h={210}/></In>)],
      ['Effort', 'how much work it puts into each round of the loop', 1.5, [0, 2, 4].map((i, j) =>
        <In key={i} at={1.5 + j * .25} snd={`lvl${i + 1}`} vol={.25}><Fig lv={i} band={FAB} k={4.6} w={210} h={210} at={1.5 + j * .25}/></In>)]] as [string, string, number, React.ReactNode][]).map(([name, what, at, figs]) =>
      <div key={name} style={col(16)}><div style={{display: 'flex'}}>{figs}</div>
        <In at={at + .75} how="slam" snd="slam" vol={.15}><div style={{...CHIP, ...txt(34, 700, INK)}}>{name}</div></In>
        <In at={at + .85} how="up"><div style={{...txt(28, 500, MUTE), maxWidth: 560, textAlign: 'center'}}>{what}</div></In></div>)}</div>},
  {title: 'The same job, two settings', lines: ['Fable 5.1 builds an HTML cleaner, *five tries* at each.'], src: by(), qAt: 3,
    art: <div style={{display: 'flex', gap: 160}}>{([[0, CLEANER.low, CLEANER.lowMin], [3, CLEANER.xhigh, CLEANER.highMin]] as const).map(([lv, ok, min], s) => <div key={lv} style={col(18)}>
      <FigIn lv={lv} at={.6 + s * .3} band={FAB} k={5.6} w={300} h={250}/><Runs ok={ok} at={1.2 + s * .15} gap={.3}/>
      <In at={2.75} how="up"><div style={{display: 'flex', alignItems: 'center', gap: 12, ...txt(38, 700)}}><Icon name="clock" size={42}/>about {min} min a try</div></In></div>)}</div>},
  {title: 'More effort, more guessing', lines: [`Each *?* is about 5 times Fable 5.1 *picked the wrong meaning*, in ${triesOf(FLOW)} tries at each.`], qAt: 3.1,
    quote: {text: 'Claude will also make more assumptions on my behalf.', who: `${BY}, on higher effort`, to: SPEND},
    art: <div style={{display: 'flex', gap: 70, alignItems: 'flex-end'}}>{FB.map((m, c) => {const i = ciOf(m.name), at = 1.3 + c * .3;
      return <div key={m.name} style={col(8)}><div style={{display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', gap: 8, width: 232}}>{[...Array(Math.round(m.reading / 5))].map((_, j) =>
        <In key={j} at={at + j * .06} how="drop" snd="pop" vol={.12}><div style={{width: 64, height: 64, borderRadius: 32, display: 'grid', placeItems: 'center', background: SIGN_C.guessed, boxShadow: '0 5px 0 #3b7fa8', ...txt(40, 700, INK)}}>?</div></In>)}</div>
        <In at={at}><div style={txt(52, 700)}><Count to={m.reading} at={at}/></div></In>
        <In at={.6 + c * .12} how="up"><div style={col(8)}><Fig lv={i} band={FAB} k={4} h={180}/><Lvl i={i}/></div></In></div>;})}</div>},
  {title: 'Name the miss, then pick the fix', lines: ['Fable 5.1\'s misses from Low to Max, *by what fixes them*.'], src: by(', figure B'), qAt: 2.6,
    art: <div style={{display: 'grid', gridTemplateColumns: '64px auto 50px auto auto', columnGap: 20, rowGap: 14, alignItems: 'center'}}>
      {([['sloppy', 'effort', `${sloppy(FLOW)} → ${sloppy(FMAX)}: effort fixes these`], ['guessed', 'rewrite', `${FLOW.reading} → ${FMAX.reading}: effort makes it worse`],
        ['rule', 'context', `${FLOW.domain} → ${FMAX.domain}: effort barely touches it`], ['top', 'tag', 'nothing higher left on this model'], ['again', 'again', `${FLOW.other} → ${FMAX.other}: nothing to read`]] as [Sign, Fix, string][])
        .map(([s, x, n], r) => {const at = .6 + r * .35; return <React.Fragment key={s}>
          <In at={at} snd="swish" vol={.15}><svg width={60} height={52} viewBox="-28 -24 56 48"><Glyph s={s} c={SIGN_C[s]}/></svg></In>
          <In at={at + .05} how="left"><div style={txt(32, 700, SIGN_C[s])}>{cap(SIGN_WORD[s])}</div></In>
          <In at={at + .1} how="left"><Icon name="arrow" size={40}/></In>
          <In at={at + .18} how="slam" style={{justifySelf: 'start'}}><div style={{...CHIP, padding: '6px 22px', ...txt(30, 700, INK)}}>{cap(FIX_WORD[x])}</div></In>
          <In at={at + .25} how="up"><div style={txt(26, 500, MUTE)}>{n}</div></In></React.Fragment>;})}</div>},
  {title: 'Higher is not always better', lines: ['Fable 5.1 at Max *passed fewer jobs* than at X-high, and *used more tokens* a try.'], src: by(', figure B'), qAt: 3.2,
    art: <div style={{display: 'flex', gap: 120}}>{[FX, FMAX].map((m, k) => {const i = ciOf(m.name), at = .6 + k * 1.1;
      const red = (s: string, a: number) => <In at={a} how="slam" snd="smack" vol={.3} style={{marginLeft: 14}}><span style={txt(38, 700, '#ff6b7f')}>{s}</span></In>;
      return <div key={m.name} style={{display: 'flex', alignItems: 'center', gap: 30}}><FigIn lv={i} at={at} band={FAB} k={5.6} w={300} h={250}/>
        <div><div style={{display: 'flex', alignItems: 'baseline'}}><In at={at + .3}><span style={txt(120, 700)}><Count to={m.pass} at={at + .3}/></span></In>{k > 0 && red(`−${FX.pass - m.pass}`, 2.5)}</div>
          <In at={at + .4} how="up"><div style={txt(30, 500, MUTE)}>passed, of {triesOf(m)}</div></In>
          <In at={at + .6} how="up"><div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, ...txt(34, 700)}}><Icon name="coin" size={42}/><Count to={m.tokens} at={at + .6}/>K tokens a try{k > 0 && red(`+${m.tokens - FX.tokens}K`, 2.9)}</div></In></div></div>;})}</div>},
  {title: 'In the game, and in Claude Code', lines: [],
    art: <Moves chip={CHIP} rows={[['The dial', '/effort', 'sets how hard Claude works, from Low to Max'], ['Rewrite the ask', '', 'say what you mean, or have Claude interview you first'],
      ['Add context', 'CLAUDE.md', 'write your rule in it. /init writes a first one'], ['Tag in', '/model', 'switches to a newer model'], ['Try again', '', 'run it again as it is']]}/>},
  {title: 'Anthropic\'s rule of thumb', lines: ['In the arena, first tries pass and miss *as often as the real numbers say*.'], src: by(), qAt: 2.6,
    art: <div style={{display: 'flex', gap: 30, alignItems: 'flex-start'}}>{([[0, 'to stay in the loop: sketches, easy changes'], [1, 'most everyday work'], [2, 'where checking and edge cases matter'], [4, 'to let it run on its own on a hard problem']] as [number, string][]).map(([i, what], j) =>
      <div key={i} style={{...col(14), width: 360}}><FigIn lv={i} at={.6 + j * .4} k={5.6} w={300} h={260}/>
        <In at={.85 + j * .4} how="up"><div style={{...txt(28, 500, MUTE), textAlign: 'center'}}>{what}</div></In></div>)}</div>},
];

/* ---------- the game around the rules ---------- */
type Pop = {text: string; c: string; x: number; y: number; t0: number};
type Fx = {t0: number; x: number; y: number; ok: boolean};
type G = {
  f: Fight; pick: ModelId; phase: 'brief' | 'play' | 'result'; clock: number; endT: number;
  bot: Bot | null; botFn: ((f: Fight) => Fix | null) | null;
  pops: Pop[]; fx: Fx[]; hitT: number; hurtT: number; warnT: number; shake: number;
  tip: {text: string; t0: number} | null; tips: string[]; told: Set<string>;
  start: () => void; tap: (x: Fix) => void; turn: (d: number) => void;
};
const HOW_KEY = 'pym3.arenahow';   // set once the cards have been read or skipped
const starKey = (st: Stage, who: ModelId) => `${st.id}.${who}`;
export const bestOf = (best: Record<string, number>, st: Stage) => Math.max(0, ...FIGHTERS.map(id => best[starKey(st, id)] ?? 0));

let picked = {si: 0, who: 'opus55' as ModelId, dial: 0};   // the round, fighter and starting dial you picked, kept while the page is open
export const Arena: React.FC<{best: Record<string, number>; onEnd: (key: string, stars: number) => void; onQuit: () => void}> = ({best, onEnd, onQuit}) => {
  const canvas = useRef<HTMLCanvasElement>(null), [, setTick] = useState(0), [run, setRun] = useState(0), [sel, setSel] = useState(picked), [how, setHow] = useState(() => !seen(HOW_KEY));
  const ref = useRef<G | null>(null), rigRef = useRef<Rig | null>(null), brief = useRef(true), howOn = useRef(how); howOn.current = how;
  const ended = useRef(onEnd); ended.current = onEnd;
  const quit = useRef(onQuit); quit.current = onQuit;
  const stage = STAGES[sel.si], who = sel.who;
  /** Pick a round, a fighter and where the dial starts. */
  const choose = (si: number, id: ModelId, dial = sel.dial) => {
    const n = Math.max(0, Math.min(STAGES.length - 1, si)), d = Math.max(0, Math.min(dialOf(STAGES[n].old ?? id).length - 1, dial));
    if (n !== sel.si || id !== sel.who || d !== sel.dial) {sfx('select', .3); setSel(picked = {si: n, who: id, dial: d});}
  };
  const again = (pick: boolean) => {brief.current = pick; setRun(r => r + 1);};

  useEffect(() => {   // the roof is built once and kept across fights
    rigRef.current = build(canvas.current!, CW, CH, true);   // lite: the rooftop folded into a few meshes
    return () => {loop('bed-select.mp3', 0); canvas.current?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();};
  }, []);

  useEffect(() => {
    const f = makeFight(stage, who, 1 + Math.floor(Math.random() * 1e6), sel.dial);
    const g: G = {f, pick: who, phase: brief.current ? 'brief' : 'play', clock: 0, endT: 0, bot: null, botFn: null, pops: [], fx: [], hitT: -9, hurtT: -9, warnT: -9, shake: 0,
      tip: null, tips: [], told: new Set(), start: () => {}, tap: () => {}, turn: () => {}};
    ref.current = g;
    const tip = (key: string, text: string) => {if (!g.told.has(key)) {g.told.add(key); g.tips.push(text);}};
    const say = (text: string) => {g.tip = {text, t0: g.clock};};   // every time, and at once
    const pop = (j: Job, text: string, c: string) => g.pops.push({text, c, x: xOf(j.p), y: 82 * UNIT * sizeOf(j) + .95, t0: g.clock});
    const hit = (j: Job, ok: boolean) => {g.hitT = g.clock; g.fx.push({t0: g.clock, x: xOf(j.p), y: 41 * UNIT * sizeOf(j), ok});};
    g.start = () => {if (g.phase !== 'brief') return; brief.current = false; g.phase = 'play'; loop('bed-select.mp3', 0); sfx('go', .35); begin();};
    g.tap = (x: Fix) => {
      if (g.phase !== 'play' || f.end) return;
      if (!target(f)) {sfx('buzz', .12); return;}
      if (!canFix(f, x)) {sfx('buzz', .15);
        say(f.reads <= 0 ? 'NO READS LEFT: THE REST IS UP TO THE DIAL.' : f.t < f.meb ? 'STILL WRITING.' : x === 'tag' ? 'NOBODY ON THE BENCH THIS ROUND.' : 'THE DIAL IS AT THE TOP: NOTHING HIGHER.'); return;}
      for (const e of fix(f, x)) onEv(e);
    };
    g.turn = (d: number) => {
      if (g.phase !== 'play' || f.end) return;
      const a = f.dial; setDial(f, f.dial + d);
      if (f.dial !== a) {const L = f.lv[f.dial]; sfx(`lvl${ciOf(L.name) + 1}`, .22); say(`FIRST TRIES AT ${L.name} NOW: ${money(L.cost)} A TRY, PASSES ${L.index}%.`);}
    };
    const begin = () => {
      loop('bed-fight.mp3', .1);
      tip('start', `THE MODEL TAKES A FIRST TRY AT EVERY JOB, AT ${f.lv[f.dial].name}. WHEN ONE MISSES, READ THE SIGN AND TAP ITS FIX.`);
      if (stage.reads) tip('reads', `YOU ONLY HAVE TIME TO READ ${stage.reads} MISSES THIS ROUND. A HIGHER DIAL MISSES LESS.`);
      if (stage.old) tip('old', `${MODELS[stage.old].name} FIGHTS FIRST. TAG IN BRINGS ${MODELS[who].name} OFF THE BENCH FOR THE REST OF THE ROUND.`);
    };
    const onEv = (e: AEv) => {
      const j = e.j!;
      switch (e.k) {
        case 'in': if (j.boss) {g.warnT = g.clock; sfx('bossland', .35); say(`THE BOSS: ${stage.boss}.`);} break;
        case 'pass': hit(j, true); sfx(j.boss ? 'explode' : 'smack', .3); pop(j, 'DONE', '#6ef2a0'); if (j.boss) {sfx('ko', .35); g.shake = .6;} break;
        case 'miss': sfx('parry', .3); tip('sign.' + e.s, FIRST[e.s!] + (e.s === 'top' ? (f.bench ? ' TAG IN.' : ' THIS JOB IS PAST IT.') : '')); break;
        case 'fix': hit(j, true); sfx('jab', .3); pop(j, 'RIGHT FIX', SIGN_C[e.s!]); break;
        case 'wrong': hit(j, false); g.shake = .2; sfx('buzz', .25); pop(j, 'WRONG FIX', '#ff8a7a'); say(WHY[e.s!]); break;
        case 'tag': sfx('go', .35); say(`${MODELS[f.who].name} TAGS IN FOR THE REST OF THE ROUND, AT ${f.lv[f.dial].name}.`); break;
        case 'past': g.hurtT = g.clock; g.shake = .45; sfx('hurt', .4); sfx('hit', .3); say('A JOB GOT PAST YOU: ONE HEART.'); break;
        case 'end': g.endT = g.clock; sfx(f.won ? 'victory' : 'fail', .4); break;
      }
    };
    const step = () => {
      g.clock += DT; g.shake = Math.max(0, g.shake - DT);
      if (!g.tip || g.clock - g.tip.t0 > TIP_S) {const next = g.tips.shift(); g.tip = next ? {text: next, t0: g.clock} : null;}
      if (g.phase !== 'play') return;
      if (f.end) {
        if (g.clock - g.endT > END_HOLD) {g.phase = 'result'; loop('bed-fight.mp3', 0); ended.current(starKey(stage, who), stars(f).filter(Boolean).length);}
        return;
      }
      const x = g.botFn?.(f);
      if (x) for (const e of fix(f, x)) onEv(e);
      for (const e of tick(f)) onEv(e);
    };
    const kd = (e: KeyboardEvent) => {
      if (howOn.current) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (e.repeat) return;
      if (g.phase === 'brief') {
        if (k === 'enter' || k === ' ') g.start(); if (k === 'escape') quit.current(); if (k === 'h') setHow(true);
        if (k >= '1' && k <= String(STAGES.length)) choose(+k - 1, who);
        if (k === 'arrowleft' || k === 'arrowright') choose(sel.si, FIGHTERS[(FIGHTERS.indexOf(who) + (k === 'arrowleft' ? FIGHTERS.length - 1 : 1)) % FIGHTERS.length]);
        if (k === 'arrowup' || k === 'arrowdown') choose(sel.si, who, sel.dial + (k === 'arrowup' ? 1 : -1));
        return;
      }
      if (g.phase === 'result') {if (k === 'enter' || k === ' ') again(false); if (k === 'c') again(true); if (k === 'escape' || k === 'l') quit.current(); return;}
      if (k >= '1' && k <= String(FIXES.length)) g.tap(FIXES[+k - 1]);
      if (k === 'arrowup' || k === 'arrowdown') g.turn(k === 'arrowup' ? 1 : -1);
      if (k === 'escape') quit.current();
    };
    addEventListener('keydown', kd);
    if (g.phase === 'play') begin(); else loop('bed-select.mp3', .1);   // the select theme; a new pick only sets its volume, it doesn't restart it
    let drawn = false;   // behind a menu the roof is drawn once and held, blurred (ui.tsx WORLD_BLUR)
    const draw = () => {if (g.phase === 'play' || !drawn) {rigRef.current?.render({f: g.clock * 30, set: 'roof', cam: CAM}); drawn = true;} setTick(t => t + 1);};
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
    // F9 runs 2 s, F10 runs 10 s, F6 runs 0.2 s, F7 hands the fight to a bot (reader, effort, off);
    // the state lands in document.body.dataset.pym
    const hook = (e: KeyboardEvent) => {
      const s = e.key === 'F9' ? 2 : e.key === 'F10' ? 10 : e.key === 'F6' ? .2 : 0;
      if (e.key === 'F7') {g.bot = g.bot === null ? 'reader' : g.bot === 'reader' ? 'effort' : null; g.botFn = g.bot ? makeBot(g.bot) : null;}
      for (let i = 0; i < s / DT; i++) step();
      draw();
      const j = target(f);
      document.body.dataset.pym = JSON.stringify({world: 'arena', round: stage.id, who: f.who, bench: f.bench, phase: g.phase, how: howOn.current, bot: g.bot, t: +f.t.toFixed(1), dial: f.lv[f.dial].name,
        hearts: f.hearts, spent: +f.spent.toFixed(2), reads: f.reads, ko: f.ko, past: f.past, tries: f.tries, wrong: f.wrong, signs: f.signs,
        target: j ? `${j.miss}:${signOf(f, j.miss!)}:${j.p.toFixed(2)}` : null, working: f.jobs.filter(x => x.work).length, left: f.jobs.filter(x => x.st !== 'gone').length,
        end: f.end, won: f.won, stars: stars(f), tip: g.tip?.text});
    };
    if (location.hash === '#test') addEventListener('keyup', hook);
    return () => {cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', hook); loop('bed-fight.mp3', 0); ref.current = null;};
  }, [run, sel]);

  const g = ref.current, sh = g && g.shake > 0 ? [(hash(Math.floor(g.clock * 60)) - .5) * g.shake * 50, (hash(Math.floor(g.clock * 60) + 9) - .5) * g.shake * 50] : [0, 0];
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#c2667a', userSelect: 'none', touchAction: 'none'}}>
    <div style={{position: 'absolute', inset: 0, transform: `translate(${sh[0].toFixed(1)}px, ${sh[1].toFixed(1)}px) scale(1.02)`, ...(g && g.phase !== 'play' ? WORLD_BLUR : {})}}>
      <canvas ref={canvas} width={CW} height={CH} style={{position: 'absolute', inset: 0, width: W, height: H}}/>
      {g && g.phase === 'play' && <Roof g={g}/>}
    </div>
    {g && g.phase === 'play' && <Hud g={g}/>}
    {g && g.phase === 'play' && g.tip && <div style={{position: 'absolute', left: 240, right: 240, top: 112, textAlign: 'center', pointerEvents: 'none',
      opacity: Math.min(1, (g.clock - g.tip.t0) / .2) * Math.min(1, (TIP_S - (g.clock - g.tip.t0)) / .4)}}>
      <div style={{display: 'inline-block', padding: '6px 22px', ...GLASS, borderRadius: 14, borderColor: '#ffd23f', background: 'rgba(10,16,38,.9)'}}>
        <Mono size={24} style={{lineHeight: 1.3}}>{g.tip.text}</Mono></div></div>}
    {g && g.phase === 'play' && <Btn label="✕ QUIT" size={18} act={onQuit} style={{position: 'absolute', left: 12, top: 6}}/>}
    {g && g.phase === 'play' && g.clock - g.hurtT < .35 && <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${220 * (1 - (g.clock - g.hurtT) / .35)}px rgba(255,60,40,.7)`}}/>}
    {g && g.phase === 'brief' && !how && <Pick si={sel.si} who={who} dial={sel.dial} best={best} t={g.clock} choose={choose} start={g.start} back={onQuit} how={() => setHow(true)}/>}
    {g && g.phase === 'result' && <Result g={g} again={again} back={onQuit}/>}
    {how && <Explain tag="Training" cards={CARDS} last="Pick a round" done={() => {markSeen(HOW_KEY); setHow(false);}}/>}
  </div>;
};

/* ---------- the roof: the jobs and their signs, Meb, the fixes ---------- */
const Roof: React.FC<{g: G}> = ({g}) => {
  const f = g.f, t = g.clock, fr = t * 30, mq = onStage(MEB_X, 0), hand = onStage(MEB_X + .85, 1.05), tg = target(f);
  const since = t - g.hitT, hurt = t - g.hurtT < .5, busy = f.jobs.some(j => j.work);
  const pose: FP = f.end ? (f.won ? WIN(fr) : DOWN) : hurt ? HURT : since < .22 ? PUNCH : stance(fr);
  const shadow = (x: number, y: number, big: number, key: string) => {const q = onStage(x, 0), r = 9.5 * q.k * big * (1 - Math.min(1, y / 3) * .5);
    return <ellipse key={key} cx={q.x} cy={q.y} rx={r} ry={r * .2} fill="rgba(20,10,30,.35)"/>;};
  const jobs = f.jobs.filter(j => j.st !== 'soon' && j.p <= 1.25).reverse().map(j => {   // the far ones first
    const sc = sizeOf(j), age = f.t - j.endT, w = j.work;
    let x = xOf(j.p), y = 0, rot = 0, o = 1;
    if (j.end === 'ko') {const u = age / KO_S; if (u >= 1) return null; x += 3.4 * u; y = Math.sin(u * Math.PI) * 1.5; rot = u * 240; o = 1 - u * u;}
    if (j.end === 'past') {const u = age / PAST_S; if (u >= 1) return null; x -= 1.4 * u; o = 1 - u;}
    const q = onStage(x, y), k = q.k * sc, top = q.y - 90 * k;
    const lc = w ? LV[ciOf(dialOf(w.who)[w.lv].name)].c : '#fff';
    return <g key={j.id} opacity={o}>
      {shadow(x, y, sc * 2.4, 's')}
      <g transform={`rotate(${rot.toFixed(1)} ${q.x.toFixed(1)} ${(q.y - 41 * k).toFixed(1)})`}><Boss x={q.x} y={q.y} k={k} f={fr + j.id * 13} flash={j === tg ? .2 + .15 * Math.sin(t * 10) : 0} sq={1}/></g>
      {!j.end && w && <g>{f.t < w.from
        ? <text x={q.x} y={top - 14} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={20} fill="#fff" stroke="#140c1e" strokeWidth={5} paintOrder="stroke">YOU WRITE…</text>
        : <><rect x={q.x - 52} y={top - 30} width={104} height={18} rx={9} fill="rgba(14,8,24,.85)" stroke="#140c1e" strokeWidth={2}/>
          <rect x={q.x - 49} y={top - 27} width={98 * clamp((f.t - w.from) / (w.until - w.from))} height={12} rx={6} fill={lc}/></>}</g>}
      {!j.end && j.miss && j !== tg && <g transform={`translate(${q.x} ${top - 30})`}><circle r={26} fill="rgba(14,8,24,.88)" stroke={SIGN_C[signOf(f, j.miss)]} strokeWidth={3}/>
        <g transform="scale(.8)"><Glyph s={signOf(f, j.miss)} c={SIGN_C[signOf(f, j.miss)]}/></g></g>}
    </g>;});
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
    {jobs}
    {shadow(MEB_X, 0, 1, 'ms')}
    <Fighter id="am" x={mq.x} y={mq.y} k={mq.k} f={fr} p={pose} look={{aura: f.end ? 0 : ciOf(f.lv[f.dial].name) + (busy ? .9 : .55), band: MODELS[f.who].paint}}/>
    {/* a fix: a streak from Meb's hand to the job, and a burst where it lands */}
    {g.fx.filter(e => t - e.t0 < .25).map(e => {
      const u = (t - e.t0) / .25, to = onStage(e.x, e.y), c = e.ok ? '#ffd23f' : '#ff8a7a', w = 26 * (1 - u), R = 70 * (.45 + .55 * u);
      return <g key={e.t0} opacity={1 - u * u}>
        <path d={`M${hand.x} ${hand.y} L${to.x} ${to.y}`} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={.8}/>
        <path d={`M${hand.x} ${hand.y} L${to.x} ${to.y}`} stroke="#fff" strokeWidth={w * .4} strokeLinecap="round"/>
        <circle cx={to.x} cy={to.y} r={R * 1.2} fill="none" stroke={c} strokeWidth={10 * (1 - u)}/>
      </g>;})}
    {tg && <Sign f={f} j={tg} t={t}/>}
    {/* what happened, over the job */}
    {g.pops.filter(p => t - p.t0 < 1).map(p => {const u = t - p.t0, q = onStage(p.x, p.y);   // never under the top bar
      return <g key={p.t0 + p.text} opacity={clamp((1 - u) / .3)} transform={`translate(${Math.min(W - 200, Math.max(200, q.x)).toFixed(1)} ${(Math.max(q.y, 250) - u * 46).toFixed(1)}) scale(${(.6 + .4 * clamp(u / .1)).toFixed(2)})`}>
        <Txt x={0} y={0} size={52} anchor="middle" c={p.c} italic>{p.text}</Txt></g>;})}
    {t - g.warnT < 2.2 && <g opacity={clamp((t - g.warnT) / .15) * clamp((2.2 - (t - g.warnT)) / .3)}>
      <rect x={0} y={190} width={W} height={110} fill="rgba(120,10,30,.72)"/>
      <Txt x={W / 2} y={276} size={76} anchor="middle" c={Math.floor(t * 8) % 2 ? '#ff4f4f' : '#fff'} italic>{`WARNING · ${f.stage.boss}`}</Txt></g>}
    {f.end && g.phase === 'play' && <Txt x={W / 2} y={470} size={190} anchor="middle" c={f.won ? '#ffd23f' : '#ff4f4f'} italic>{f.won ? 'YOU WIN' : 'K.O.'}</Txt>}
  </svg>;
};
/** The sign over the front job with a miss: its picture, its name, our example of its kind. */
const Sign: React.FC<{f: Fight; j: Job; t: number}> = ({f, j, t}) => {
  const s = signOf(f, j.miss!), c = SIGN_C[s], q = onStage(xOf(j.p), 0), top = q.y - 90 * q.k * sizeOf(j), x = Math.min(W - 390, Math.max(390, q.x)), y = top - 150, pulse = 1 + .03 * Math.sin(t * 8);
  return <g transform={`translate(${x} ${y}) scale(${pulse.toFixed(3)})`}>
    <rect x={-370} y={-58} width={740} height={116} rx={18} fill="rgba(14,8,24,.92)" stroke={c} strokeWidth={5}/>
    <path d={`M${q.x - x - 16} 58 L${q.x - x + 16} 58 L${q.x - x} 84 Z`} fill={c}/>
    <g transform="translate(-316 0) scale(1.4)"><Glyph s={s} c={c}/></g>
    <text x={-262} y={-6} fontFamily={BOLD} fontStyle="italic" fontSize={38} fill={c}>{SIGN_WORD[s]}</text>
    <text x={-262} y={36} fontFamily={MONO} fontWeight={700} fontSize={22} fill="#fff">{KIND_LINE[j.miss!]}</text>
  </g>;
};

/* ---------- the HUD: who fights, hearts, jobs left, money; the dial and the five fixes ---------- */
const HEART = 'M0 6 C-3 1 -11 -1 -11 -7 C-11 -12 -4 -14 0 -8 C4 -14 11 -12 11 -7 C11 -1 3 1 0 6 Z';
const PANEL = 'rgba(14,8,24,.82)';
const Hud: React.FC<{g: G}> = ({g}) => {
  const f = g.f, st = f.stage, live = g.phase === 'play' && !f.end, over = f.spent > st.budget + 1e-9, left = f.jobs.filter(x => x.st !== 'gone').length, tg = target(f), L = f.lv[f.dial];
  const subOf = (x: Fix) => x === 'effort' ? (f.dial < f.lv.length - 1 ? `ONE TRY AT ${f.lv[f.dial + 1].name}, ${money(f.lv[f.dial + 1].cost)}` : 'THE DIAL IS AT THE TOP')
    : x === 'tag' ? (f.bench ? `${MODELS[f.bench].name}, FOR GOOD` : 'NOBODY ON THE BENCH')
    : x === 'again' ? `THE SAME TRY, ${money(L.cost)}` : `YOU WRITE ${YOUR_S} S, THEN ${money(L.cost)}`;
  return <>
    <div style={{position: 'absolute', left: 150, top: 10, width: 600, height: 92, padding: '8px 22px', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <div style={{width: 22, height: 22, borderRadius: 7, background: MODELS[f.who].paint, border: '2px solid #fff', flex: 'none'}}/>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 38, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{MODELS[f.who].name}</div>
        <svg width={st.hearts * 40} height={36} viewBox={`-20 -17 ${st.hearts * 40} 36`}>{[...Array(st.hearts)].map((_, i) =>
          <path key={i} d={HEART} transform={`translate(${i * 40} 2) scale(1.45)`} fill={i < f.hearts ? '#ff3d6e' : 'rgba(255,255,255,.14)'} stroke="#140c1e" strokeWidth={1.6}/>)}</svg>
      </div>
      <Mono size={18} color={f.bench ? '#ffd23f' : '#c9bedc'} style={{letterSpacing: '.08em', marginTop: 2}}>{f.bench ? `ON THE BENCH: ${MODELS[f.bench].name}` : `${st.name} · ${st.boss} COMES LAST`}</Mono>
    </div>
    <div style={{position: 'absolute', left: W / 2 - (st.reads ? 210 : 100), top: 10, display: 'flex', gap: 20}}>
      {[[left, 'JOBS LEFT'], ...(st.reads ? [[f.reads, 'READS LEFT']] : [])].map(([n, w]) => <div key={w} style={{width: 200, height: 92, textAlign: 'center', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 52, color: w === 'READS LEFT' && f.reads <= 2 ? '#ff8a7a' : '#fff', lineHeight: 1.1}}>{n}</div>
        <Mono size={16} color="#c9bedc" style={{letterSpacing: '.14em'}}>{w}</Mono></div>)}
    </div>
    <div style={{position: 'absolute', right: 24, top: 10, width: 520, height: 92, padding: '8px 22px', boxSizing: 'border-box', ...GLASS, background: PANEL}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 38, color: over ? '#ff8a7a' : '#fff', lineHeight: 1.1}}>SPENT {money(f.spent)}</div>
        <Mono size={18} color={over ? '#ff8a7a' : '#ffd23f'}>★ {money(st.budget)} OR LESS</Mono></div>
      <div style={{height: 14, borderRadius: 7, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginTop: 8}}>
        <div style={{width: `${clamp(f.spent / st.budget) * 100}%`, height: '100%', background: over ? '#ff8a7a' : '#ffd23f'}}/></div>
    </div>
    {/* the dial: where first tries are made */}
    <div style={{position: 'absolute', left: 24, top: 892, width: 440, height: 170, padding: '10px 18px', boxSizing: 'border-box', ...GLASS, background: PANEL, opacity: live ? 1 : .5}}>
      <Mono size={17} color="#8fa6c4" style={{letterSpacing: '.12em'}}>EFFORT FOR FIRST TRIES{TOUCH ? '' : '  ↑ ↓'}</Mono>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4}}>
        <Btn label="−" size={26} act={() => g.turn(-1)}/>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 50, color: LV[ciOf(L.name)].c, lineHeight: 1}}>{L.name}</div>
        <Btn label="+" size={26} act={() => g.turn(1)}/></div>
      <Mono size={19} style={{marginTop: 6, textAlign: 'center'}}>{money(L.cost)} A TRY · PASSES {L.index}%</Mono>
    </div>
    {/* the fixes: each carries the picture of the sign it answers */}
    {FIXES.map((x, i) => {const on = live && !!tg && canFix(f, x), s = FIX_SIGN[x], c = SIGN_C[s];
      return <div key={x} data-ui="btn" onClick={e => {e.stopPropagation(); g.tap(x);}} style={{position: 'absolute', left: 478 + i * 286, top: 892, width: 274, height: 170, padding: '8px 12px', boxSizing: 'border-box', cursor: 'pointer',
        ...GLASS, background: PANEL, border: `3px solid ${on ? c : 'rgba(255,255,255,.18)'}`, opacity: on ? 1 : .5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
        <svg width={52} height={46} viewBox="-26 -23 52 46"><Glyph s={s} c={c}/></svg>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 29, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{FIX_WORD[x]}</div>
        <Mono size={15} color="#cfe0ff" style={{marginTop: 5, lineHeight: 1.2}}>{subOf(x)}</Mono>
        {!TOUCH && <div style={{position: 'absolute', left: 10, top: 8, fontFamily: MONO, fontSize: 18, color: '#8fa6c4'}}>{i + 1}</div>}
      </div>;})}
  </>;
};

/* ---------- before and after: a fighting game's select and win screens (the user's "Do A", DESIGN-menus.md) ---------- */
const BLURB: Partial<Record<ModelId, string>> = {opus55: 'Cheap, then strongest', sonnet55: 'Quickest to answer', fable51: 'Best at Low'};
const goals = (st: Stage) => ['Win', `${money(st.budget)} max`, 'None get past'];   // goalsOf, in a chip's few words
const ABS = (left: number, top: number, s: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left, top, ...s});
const SHOUT = (size: number): React.CSSProperties => ({...txt(size, 700, GOLD), textShadow: outline(INK, size / 20) + ',0 16px 0 #000', whiteSpace: 'nowrap', pointerEvents: 'none'});
/** One number as a fighting game's gauge: icon, word, value, ten slanted cells. */
const Gauge: React.FC<{icon: IconName; label: string; val: string; frac: number; c: string}> = ({icon, label, val, frac, c}) => <div style={{marginBottom: 28}}>
  <div style={{display: 'flex', alignItems: 'center', gap: 14, color: c}}><Icon name={icon} size={40} w={2.8}/><span style={txt(28, 500, MUTE)}>{label}</span><span style={{...txt(58, 700), marginLeft: 'auto'}}>{val}</span></div>
  <div style={{display: 'flex', gap: 6, marginTop: 8}}>{[...Array(10)].map((_, i) => <div key={i} style={{flex: 1, height: 22, ...SKEW, background: i < Math.round(frac * 10) ? c : 'rgba(255,255,255,.14)'}}/>)}</div></div>;

/** Before a fight: your fighter against the round's boss, its numbers at the dial as gauges; then rounds, fighters, the dial, FIGHT. */
const Pick: React.FC<{si: number; who: ModelId; dial: number; best: Record<string, number>; t: number; choose: (si: number, who: ModelId, dial?: number) => void; start: () => void; back: () => void; how: () => void}> =
  ({si, who, dial, best, t, choose, start, back, how}) => {
  const st = STAGES[si], lead = st.old ?? who, m = MODELS[lead], lv = dialOf(lead), L = lv[dial], lc = LV[ciOf(L.name)].c, fr = t * 30, mix = mixOf(lead);
  return <div style={{position: 'absolute', inset: 0}}>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 50%, #3a1030, #0c0a18 60%)'}}/>
    <div style={{position: 'absolute', inset: 0, clipPath: 'polygon(0 0,62% 0,48% 100%,0 100%)', background: `repeating-linear-gradient(-70deg, transparent 0 70px, rgba(255,255,255,.06) 70px 78px), linear-gradient(150deg, ${m.paint}, #1a0f3a 85%)`}}/>
    <div style={{position: 'absolute', inset: 0, clipPath: 'polygon(61.6% 0,62.4% 0,48.4% 100%,47.6% 100%)', background: '#fff'}}/>
    <svg width={560} height={640} style={ABS(1310, 66)}><Boss x={280} y={620} k={6.6} f={fr} flash={0} sq={1}/></svg>
    <div style={ABS(1200, 688, {width: 720, textAlign: 'center'})}><div style={txt(64, 700)}>{cap(st.boss)}</div><div style={{...txt(25, 500, MUTE), marginTop: 6}}>{st.jobs} jobs. {st.line}</div></div>
    <div style={ABS(1200, 822, {width: 720, display: 'flex', justifyContent: 'center', gap: 12})}>{goals(st).map(g => <span key={g} style={{display: 'flex', alignItems: 'center', gap: 8, height: 54, padding: '0 20px 0 12px', borderRadius: 27,
      background: 'rgba(0,0,0,.5)', border: `2px solid ${GOLD}88`, ...txt(24, 700)}}><Star on size={30}/>{g}</span>)}</div>
    <svg width={760} height={700} style={ABS(400, 230, {overflow: 'visible'})}><Fighter id="pkbig" x={380} y={640} k={13} f={fr} p={stance(fr)} look={{aura: ciOf(L.name) + .55, band: m.paint}}/></svg>
    <div style={ABS(990, 280, {...SHOUT(220), transform: 'skewX(-10deg) rotate(-6deg)'})}>VS</div>
    <div style={ABS(70, 136, {...txt(132, 700), transform: 'skewX(-8deg)', textShadow: '0 10px 0 rgba(0,0,0,.35)', whiteSpace: 'nowrap', pointerEvents: 'none'})}>{nm(lead)}</div>
    <div style={ABS(80, 304, {...txt(30, 700), background: '#000', padding: '10px 26px', ...SKEW})}>{st.old ? `${nm(who)} waits on the bench` : BLURB[who]}</div>
    <div style={ABS(70, 410, {width: 400})}>
      <Gauge icon="target" label="Passes" val={`${L.index}%`} frac={L.index / 100} c={lc}/>
      <Gauge icon="coin" label="A try" val={money(L.cost)} frac={L.cost / 8} c={lc}/>
      <Gauge icon="clock" label="Answers" val={`${L.busy.toFixed(1)} s`} frac={1 - L.busy / 4} c={lc}/>
      {mix !== lead && <div style={txt(22, 500, MUTE)}>Nobody has counted its misses by kind, so they come in {nm(mix)}'s mix.</div>}</div>
    <Button icon="back" act={back} style={ABS(40, 40)}/>
    <Button icon="help" act={how} style={ABS(W - 40 - TAP, 40)}/>
    <div style={ABS(0, 36, {width: W, display: 'flex', justifyContent: 'center', gap: 16, pointerEvents: 'none'})}>{STAGES.map((s, k) =>
      <div key={s.id} onClick={() => choose(k, who)} style={{pointerEvents: 'auto', cursor: 'pointer', width: 170, height: Math.max(92, TAP), boxSizing: 'border-box', ...SKEW, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        background: k === si ? '#fff' : 'rgba(0,0,0,.55)', border: `3px solid ${k === si ? '#fff' : 'rgba(255,255,255,.25)'}`}}>
        <span style={txt(46, 700, k === si ? INK : '#fff')}>{k + 1}</span><Stars n={bestOf(best, s)} size={26} off={k === si ? '#d8d2ea' : 'rgba(255,255,255,.2)'}/></div>)}</div>
    <div style={ABS(70, 893, {display: 'flex', gap: 16})}>{FIGHTERS.map((id, k) => {const b = best[starKey(st, id)] ?? 0, on = id === who;
      return <div key={id} onClick={() => choose(si, id)} style={{width: 112, height: 112, borderRadius: 22, overflow: 'hidden', position: 'relative', cursor: 'pointer', background: on ? MODELS[id].paint : 'rgba(255,255,255,.1)', boxShadow: on ? '0 0 0 5px #fff' : 'none'}}>
        <svg width={112} height={112} viewBox="0 0 132 132"><Fighter id={'pk' + k} x={66} y={134} k={3} f={fr} p={on ? stance(fr) : {look: .4}} look={{band: MODELS[id].paint}}/></svg>
        {b > 0 && <div style={{position: 'absolute', right: 4, bottom: 2}}><Stars n={b} size={22}/></div>}</div>;})}</div>
    <div style={ABS(520, 893, {width: 660, height: 130, borderRadius: 65, background: 'rgba(0,0,0,.6)', display: 'flex', justifyContent: 'space-around', alignItems: 'center'})}>{lv.map((l, i) => {const c = LV[ciOf(l.name)].c, on = i === dial;
      return <div key={l.name} onClick={() => choose(si, who, i)} style={{...col(6), width: 150, height: 130, justifyContent: 'center', cursor: 'pointer'}}>
        <div style={{width: on ? 74 : 54, height: on ? 74 : 54, borderRadius: 40, background: c, opacity: on ? 1 : .45, boxShadow: on ? `0 0 0 5px #fff, 0 0 40px ${c}` : 'none'}}/><span style={txt(22, 700, on ? '#fff' : MUTE)}>{cap(l.name)}</span></div>;})}</div>
    <Hit label="FIGHT!" act={start} size={76} style={ABS(1440, 893, {width: 420, height: 130})}/>
    <Keys text="1–4 round   ·   ← → fighter   ·   ↑ ↓ dial"/>
  </div>;
};
const RIGHT: Record<Sign, Fix> = {sloppy: 'effort', top: 'tag', guessed: 'rewrite', rule: 'context', again: 'again'};
/** After a fight: YOU WIN! or K.O., the stars over their goals, the sign you misread and its right fix, the same fight at each dial. */
const Result: React.FC<{g: G; again: (pick: boolean) => void; back: () => void}> = ({g, again, back}) => {
  const f = g.f, got = stars(f), rows = useMemo(() => dialRows(f.stage, g.pick, f.seed), [f]), [more, setMore] = useState(false);
  const worst = Object.entries(f.wrongs).sort((a, b) => b[1] - a[1])[0], mine = rows[picked.dial], top = [...rows].sort((a, b) => b.stars - a.stars || a.spent - b.spent)[0];
  const [wx, ws] = (worst ? worst[0].split('>') : [null, null]) as [Fix, Sign] | [null, null], better = top !== mine && top.stars > (mine?.stars ?? 0);
  const m = MODELS[g.pick], fr = g.clock * 30, edge = ws ? SIGN_C[ws] : f.past ? '#ff5a6e' : '#6ef2a0', [cmd, tip] = useMemo(() => tipOf(f, picked.dial), [f]);
  return <div style={{position: 'absolute', inset: 0}}>
    <div style={{position: 'absolute', inset: 0, background: `repeating-conic-gradient(from 0deg at 28% 62%, rgba(255,255,255,.08) 0deg 6deg, transparent 6deg 15deg), radial-gradient(circle at 28% 62%, ${f.won ? m.paint : '#4a1430'}, #120a26 72%)`}}/>
    <svg width={720} height={760} style={ABS(160, 260, {overflow: 'visible'})}><Fighter id="rsbig" x={360} y={700} k={14} f={fr} p={f.won ? WIN(fr) : HURT} look={{band: m.paint}}/></svg>
    <div style={ABS(904, 34, txt(28, 500, MUTE))}>{nm(g.pick)} · {cap(f.stage.name)}</div>
    <div style={ABS(880, 70, {...SHOUT(160), transform: 'skewX(-10deg)'})}>{f.won ? 'YOU WIN!' : 'K.O.'}</div>
    <div style={ABS(900, 280, {display: 'flex', gap: 36})}>{got.map((ok, i) => <div key={i} style={col(10)}><Star on={ok} size={170} rot={(i - 1) * 9}/>
      <span style={{display: 'flex', alignItems: 'center', gap: 8, ...txt(28, 700, ok ? '#fff' : MUTE)}}><span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff5a6e'}}><Icon name={ok ? 'check' : 'cross'} size={30} w={3.2}/></span>{goals(f.stage)[i]}</span></div>)}</div>
    <div style={ABS(900, 548, {color: '#fff', display: 'flex', alignItems: 'center', gap: 18, padding: '18px 34px', background: 'rgba(0,0,0,.6)', ...SKEW, borderLeft: `10px solid ${edge}`})}>
      {ws ? <><svg width={58} height={50} viewBox="-28 -24 56 48"><Glyph s={ws} c={SIGN_C[ws]}/></svg><span style={txt(36, 700, SIGN_C[ws])}>{cap(SIGN_WORD[ws])}</span><Icon name="arrow" size={40}/>
        <span style={txt(36, 700)}>{cap(FIX_WORD[RIGHT[ws]])}</span></>
        : <span style={txt(36, 700)}>{f.past ? `${f.past} ${f.past > 1 ? 'jobs' : 'job'} got past you` : f.signs.top && f.tagT < 0 ? 'Misses at the top of the dial: nothing higher left' : 'Every miss got its right fix'}</span>}</div>
    <div style={ABS(904, 638, {display: 'flex', alignItems: 'center', gap: 16, width: 980, height: 68})}>
      <span style={{flex: 'none', padding: '2px 16px', borderRadius: 10, background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 28, color: '#39ff88'}}>{cmd}</span>
      <span style={txt(26, 500)}>{wx ? `You tapped ${cap(FIX_WORD[wx])}. ` : ''}{tip}</span></div>
    <div style={ABS(900, 712, txt(26, 500, MUTE))}>Same fight, every miss read right, at each dial</div>
    <div style={ABS(900, 758, {display: 'flex', gap: 16})}>{rows.map(r => <div key={r.name} style={{width: 214, height: 140, padding: '12px 18px', boxSizing: 'border-box', position: 'relative', background: 'rgba(0,0,0,.5)',
      borderTop: `8px solid ${LV[ciOf(r.name)].c}`, ...SKEW, outline: r === mine ? '3px solid #fff' : 'none'}}>
      {better && r === top && <div style={{position: 'absolute', right: -8, top: -26, padding: '2px 14px', background: GOLD, ...txt(22, 700, INK)}}>Try this</div>}
      <div style={txt(28, 700)}>{cap(r.name)}</div><div style={{margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8}}><Stars n={r.stars} size={30}/>{r.past > 0 && <span style={{...txt(22, 700, '#ff6b7f'), whiteSpace: 'nowrap'}}>{r.past} past</span>}</div>
      <div style={txt(24, 500, MUTE)}>{money(r.spent)}</div></div>)}</div>
    <div style={ABS(900, 935, {display: 'flex', gap: 22, alignItems: 'flex-start'})}>
      <Hit label="Fight again" icon="retry" act={() => again(false)} size={44} style={{height: 100}}/>
      {([['list', 'Breakdown', () => setMore(true)], ['users', 'Pick again', () => again(true)], ['map', 'Map', back]] as [IconName, string, () => void][]).map(([ic, l, a]) =>
        <div key={l} onClick={a} style={{...col(4), cursor: 'pointer'}}><Button icon={ic} act={a}/><span style={txt(20, 500, MUTE)}>{l}</span></div>)}</div>
    {more && <Sheet title="Breakdown" close={() => setMore(false)}>
      <div style={{display: 'grid', gridTemplateColumns: '60px auto 90px auto', columnGap: 24, rowGap: 10, alignItems: 'center'}}>
        {(Object.keys(SIGN_WORD) as Sign[]).filter(s => f.signs[s]).map(s => <React.Fragment key={s}>
          <svg width={48} height={42} viewBox="-24 -21 48 42"><g transform="scale(.9)"><Glyph s={s} c={SIGN_C[s]}/></g></svg>
          <div style={txt(30, 700, SIGN_C[s])}>{cap(SIGN_WORD[s])}</div><div style={txt(30)}>×{f.signs[s]}</div>
          <div style={txt(30)}>{s === 'top' && f.tagT < 0 && !f.stage.old ? 'None: the job is past this model' : cap(FIX_WORD[RIGHT[s]])}</div></React.Fragment>)}</div>
      {resultLines(f).map((l, i) => <div key={i} style={{...txt(28, 500, i ? MUTE : '#fff'), marginTop: i ? 10 : 26, maxWidth: 1400}}>{cap(l)}</div>)}
    </Sheet>}
  </div>;
};
