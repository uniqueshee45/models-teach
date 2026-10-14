/**
 * The race: the video's highway (remotion/src/opus55/race3d.ts) driven by the rules (rules.ts).
 * You steer and brake; the model is the co-driver. It thinks in the pit, then calls a lane before every fork.
 * The rivals are the same sims trusting every call, drawn as see-through cars each in its own universe.
 */
import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {CREW, LANE, ROOF_Y, build, crewAt} from '../../remotion/src/opus55/race3d';
import type {Board, Gate, Rig, Spec, State, V3} from '../../remotion/src/opus55/race3d';
import {BOLD, G, HW, MONO, PAL, Shadow, armCap, clamp, inCap, inEll, inOut, lerp, meb, outBack} from '../../remotion/src/meb-hatch/rig';
import type {Face, Grid, Pose} from '../../remotion/src/meb-hatch/rig';
import {Px} from '../../remotion/src/opus55/split';
import {DT, NOSE, botInput, counts, finish, forkD, forksOf, lap, lenOf, makeSim, pitD, pitOf, priceOf, revealOf, thinkOf, tick, topOf, wallD} from './rules';
import type {Ev, Input, Mark, Plan, Road, Sim, Style} from './rules';
import {KINDS, MODELS} from './stats';
import type {ModelId} from './stats';
import {loop, sfx} from './sound';

export const W = 1920, H = 1080;
const CW = 1600, CH = 900;          // the canvas draws at this size and is stretched to the stage
const GO_T = 2.4;                   // countdown: three red lamps, then green
const END_HOLD = 2.8;               // seconds between the end of your run and the results card
const TIP_S = 4.5;                  // seconds a tip stays up
const COINS = 20;                   // coins in the air at once
export type Result = {you: Sim; rivals: {id: ModelId; s: Sim}[]; seed: number};

/* ---------- the road: a gate per fork, a gantry per pit box, and roadside boards that say what the road is about ---------- */
const BOARDS: Record<string, [string, string, string, string][]> = {
  inbox: [['EASY WORK', 'EVERY CAR GETS IT RIGHT', '#1b2440', '#ffd23f'], ['PIT STOP?', "IT'S THINKING", '#5b3fd6', '#fff'], ['SMALL JOB', 'SMALL CAR', '#1f8a8a', '#fff']],
  memory: [['"NOT SURE" IS HONEST', 'A WRONG GUESS IS NOT', '#1b2440', '#ffd23f'], ['A HARD ONE AHEAD?', 'BRAKE AND LOOK', '#5b3fd6', '#fff']],
  openbook: [['THE CONTRACT', '100,000 TOKENS', '#1b2440', '#ffd23f'], ['LONG INPUT', 'LONG THINKING', '#5b3fd6', '#fff'], ['READING IT AGAIN', 'CACHED: 1/10 OR LESS', '#2f7de1', '#fff']],
  tickets: [['IT ALWAYS SAYS', 'DONE', '#1b2440', '#ffd23f'], ['A REVIEW', 'COSTS YOU SPEED', '#2f7de1', '#fff'], ["MEB'S DINER", 'OPEN 24/7', '#1f8a8a', '#fff']],
};
const LETTERS: [string, string, string] = ['A', 'B', 'C'];
const ARROW = ['◀', '▲', '▶'];
/** How hard a question is, in words: a star on screen is only ever a goal. */
const LEVEL = ['', 'EASY', 'MEDIUM', 'HARD'], LEVEL_C = ['', '#9be7b0', '#cfe0ff', '#ffb13b'];
/** What a fork is, in a word: a ticket's kind of work (its colour is this car's light for that kind), a question's level. */
const tagOf = (p: Plan, k: number) => p.kind.length ? KINDS[p.kind[k]].name : LEVEL[p.hard[k]];
type Layout = {spec: Spec; fork: number[]};   // fork[k]: where fork k's gate is in spec.gates
function makeSpec(r: Road, plan: Plan): Layout {
  const gates: Gate[] = [{d: pitD(r, 0), kind: 'start', text: r.name, color: '#1b2440'}], fork: number[] = [];
  for (let k = 0; k < forksOf(r); k++) {
    if (k && k % r.per === 0) gates.push({d: pitD(r, k / r.per), kind: 'step', text: 'PIT STOP · IT THINKS', color: '#b3541e'});
    fork.push(gates.length);
    gates.push({d: forkD(r, k), kind: 'step', color: '#1b2440', text: `${r.unit} ${k + 1}${r.id === 'inbox' ? '' : ' · ' + tagOf(plan, k)}`, lanes: r.id === 'inbox' ? ['', '', ''] : LETTERS});
  }
  gates.push({d: lenOf(r), kind: 'finish', text: 'JOB DONE'});
  const len = lenOf(r), list = BOARDS[r.id], every = Math.max(150, len / 5);
  const boards: Board[] = [...Array(Math.max(2, Math.floor(len / every)))].map((_, i) => {const [a, b, bg, fg] = list[i % list.length];
    return {lines: [a, b], bg, fg, d: 60 + i * every, side: (i % 2 ? 1 : -1) as -1 | 1};});
  return {spec: {gates, traffic: [], coins: COINS, boards}, fork};
}

/* ---------- HUD kit (the video's mobile-racing chrome) ---------- */
export const GLASS: React.CSSProperties = {background: 'rgba(10,16,38,.62)', border: '2px solid rgba(255,255,255,.16)', borderRadius: 22,
  boxShadow: '0 10px 30px rgba(0,0,0,.25)', backdropFilter: 'blur(6px)'};
export const GameText: React.FC<{text: string; size: number; from?: string; to?: string}> = ({text, size, from = '#fff6a8', to = '#ff9a1f'}) =>
  <div style={{fontFamily: BOLD, fontSize: size, fontStyle: 'italic', lineHeight: 1.1, whiteSpace: 'nowrap', filter: `drop-shadow(0 ${size * .07}px 0 rgba(10,16,38,.55))`}}>
    <span style={{background: `linear-gradient(180deg, ${from} 15%, ${to} 85%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      WebkitTextStroke: `${Math.max(3, size * .075)}px #1b2440`, paintOrder: 'stroke fill', padding: `0 ${size * .12}px`}}>{text}</span></div>;
/** A phone or tablet: every action needs something to tap, and the keyboard hints are noise. */
export const TOUCH = matchMedia('(pointer: coarse)').matches;
/** A button to tap or click. `k` is its key, shown only where there is a keyboard. */
export const Btn: React.FC<{label: string; k?: string; act: () => void; main?: boolean; size?: number; style?: React.CSSProperties}> = ({label, k, act, main, size = 26, style}) =>
  <div data-ui="btn" onClick={e => {e.stopPropagation(); act();}} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: size * .5, height: size * 2.9, padding: `0 ${size * 1.2}px`,
    boxSizing: 'border-box', borderRadius: 18, cursor: 'pointer', whiteSpace: 'nowrap', background: main ? 'linear-gradient(180deg, #b8ff9a, #2ecc71)' : 'rgba(10,16,38,.72)',
    border: `3px solid ${main ? '#fff' : 'rgba(255,255,255,.55)'}`, boxShadow: '0 6px 0 rgba(10,16,38,.55)', ...style}}>
    <span style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: size, color: main ? '#10213a' : '#fff'}}>{label}</span>
    {k && !TOUCH && <span style={{fontFamily: MONO, fontSize: size * .6, color: main ? 'rgba(16,33,58,.7)' : 'rgba(255,255,255,.55)'}}>{k}</span>}</div>;
const hash = (i: number) => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};
/** What each mark looks like on the job card. */
export const MARK: Record<Exclude<Mark, ''>, {c: string; t: string}> = {
  right: {c: '#37e0c8', t: 'RIGHT'}, caught: {c: '#8fd3ff', t: 'CAUGHT'}, wrong: {c: '#ff6b5e', t: 'WRONG'}};

type Pop = {text: string; sub?: string; from: string; to: string; t0: number; dur: number; y: number; size: number};
type Rival = {id: ModelId; s: Sim; flash: number};
type Game = {
  phase: 'count' | 'race' | 'end'; clock: number; tEnd: number;
  you: Sim; rivals: Rival[]; lane: number; nitroHeld: boolean; brakeHeld: boolean; auto: Style | null; nitroVis: number; pitVis: number; pitT: number;
  shake: number; hurt: number; beams: number[]; pops: Pop[]; face: Face; faceT: number;
  tip: {text: string; t0: number} | null; tips: string[]; told: Set<string>;
  coins: ({t0: number; x: number; d: number} | undefined)[]; coinN: number;
};

export const Race: React.FC<{road: Road; pick: ModelId; rivals: ModelId[]; onEnd: (r: Result) => void; onQuit: () => void}> =
  ({road, pick, rivals, onEnd, onQuit}) => {
  const canvas = useRef<HTMLCanvasElement>(null), [, setTick] = useState(0);
  const m = MODELS[pick];
  const ref = useRef<{g: Game; rig: Rig; lay: Layout} | null>(null);
  const done = useRef(onEnd); done.current = onEnd;
  const quit = useRef(onQuit); quit.current = onQuit;

  useEffect(() => {
    const seed = 1 + Math.floor(Math.random() * 1e6);   // the same questions for every car in this race, new ones next race
    const g: Game = {phase: 'count', clock: 0, tEnd: 0, you: makeSim(pick, road, seed),
      rivals: rivals.map(id => ({id, s: makeSim(id, road, seed), flash: 0})),
      lane: 0, nitroHeld: false, brakeHeld: false, auto: null, nitroVis: 0, pitVis: 0, pitT: 0, shake: 0, hurt: 0, beams: [], pops: [], face: 'happy', faceT: 0,
      tip: null, tips: [], told: new Set(), coins: Array(COINS), coinN: 0};
    const lay = makeSpec(road, g.you.plan);
    const rig = build(canvas.current!, lay.spec, CW, CH, {
      player: {paint: m.paint, plate: m.name, body: m.body},
      ghosts: rivals.map(id => ({paint: MODELS[id].paint, plate: '', body: MODELS[id].body})),
      blimp: {label: `${m.name} · THE MODEL`, band: m.paint}, crew: true});
    ref.current = {g, rig, lay};
    const you = g.you, n = you.n, [nRight, , nWrong] = counts(road, m);
    const pop = (p: Omit<Pop, 't0'>) => g.pops.push({...p, t0: g.clock});
    const feel = (f: Face, t: number) => {g.face = f; g.faceT = t;};
    const tip = (key: string, text: string) => {if (!g.told.has(key)) {g.told.add(key); g.tips.push(text);}};
    const says = (k: number) => you.plan.lit[k] === null ? '"NOT SURE"' : `IT SAID ${road.id === 'inbox' ? ARROW[you.plan.lit[k]! + 1] : LETTERS[you.plan.lit[k]! + 1]}`;
    const onEv = (e: Ev) => {
      const k = e.i, call = you.plan.calls[k];
      switch (e.k) {
        case 'pit': g.beams.push(g.clock); g.pitT = 0; sfx('blip', .25); feel('side', 9); break;
        case 'go': sfx('whoosh', .3); feel('happy', 1); pop({text: 'GO!', from: '#b8ff9a', to: '#2ecc71', dur: .7, y: 330, size: k ? 120 : 200});
          tip('drive', road.id === 'inbox' ? 'EASY EMAILS: ITS CALLS ARE ALL RIGHT HERE. FOLLOW THE LIGHT, FLAT OUT.'
            : 'IT CALLS A LANE BEFORE EVERY FORK. TRUST THE LIGHT, OR HOLD ↓ TO SLOW DOWN AND SEE THE WALLS FIRST.'); break;
        case 'right': sfx('ding', .25); feel('happy', .6);
          if (you.streak >= 5 && you.streak % 5 === 0) pop({text: `×${you.streak} CLEAN`, from: '#eaffd8', to: '#37e0c8', dur: .8, y: 500, size: 70}); break;
        case 'caught': {sfx('zap', .4); feel('happy', 1);
          const close = you.v > topOf(road, m) * .6;
          pop({text: close ? 'CLOSE ONE!' : 'CAUGHT IT!', sub: call === 'ask' ? 'IT WASN\'T SURE · YOU FOUND THE GAP' : `${says(k)} · IT WAS ${LETTERS[you.plan.truth[k] + 1]}`, from: '#ffffff', to: '#8fd3ff', dur: 1.1, y: 500, size: close ? 100 : 80});
          if (call === 'wrong') tip('caught', road.id === 'tickets' ? 'YOU CAUGHT A BROKEN ONE IN REVIEW. IT ISN\'T SHIPPED, BUT ONLY ITS OWN WORKING TICKETS COUNT FOR THE STAR.'
            : 'YOU CAUGHT ITS MISTAKE. SLOWING DOWN COSTS TIME: SAVE IT FOR THE ONES IT IS LIKELY TO MISS.');
          break;}
        case 'wrong': g.shake = .5; g.hurt = .35; feel('shocked', 1.2); sfx('hit', .4); sfx('fail', .35);
          pop({text: call === 'right' ? 'WRONG LANE!' : 'WRONG!', sub: call === 'wrong' ? `IT WAS SURE · ${road.wrongIs}` : call === 'ask' ? 'IT SAID NOT SURE · YOU GUESSED' : 'ITS CALL WAS RIGHT · YOU LEFT IT', from: '#ffffff', to: '#ff8a7a', dur: 1.3, y: 300, size: 110});
          if (call === 'wrong') tip('wrong', `${road.wrongIs}, AND IT SOUNDED SURE. ${m.name} DOES THAT ON ${nWrong} OF THESE ${n}`
            + (road.id === 'tickets' ? `. THIS WAS ${tagOf(you.plan, k)}: IT GETS ${Math.round(m.code.by[you.plan.kind[k]])}% OF THAT KIND RIGHT ON THE REAL TEST. BRAKE BEFORE ITS WEAK KINDS.` : ', MOSTLY THE HARD ONES. BRAKE BEFORE THOSE.'));
          break;
        case 'done': feel('happy', 9); sfx('ding', .5); sfx('victory', .45); g.phase = 'end'; g.tEnd = g.clock;
          pop({text: 'JOB DONE!', from: '#fff6a8', to: '#ff9a1f', dur: END_HOLD, y: 360, size: 150}); break;
      }
    };

    const step = () => {
      g.clock += DT;
      for (const k of ['shake', 'hurt', 'faceT'] as const) g[k] = Math.max(0, g[k] - DT);
      g.nitroVis += ((g.phase === 'race' && you.nitro ? 1 : 0) - g.nitroVis) * Math.min(1, DT * 5);
      g.pitVis += ((g.phase === 'race' && you.phase === 'pit' ? 1 : 0) - g.pitVis) * Math.min(1, DT * 5);
      if (g.phase === 'race' && you.phase === 'pit') g.pitT += DT;
      if (!g.tip || g.clock - g.tip.t0 > TIP_S) {const next = g.tips.shift(); g.tip = next ? {text: next, t0: g.clock} : null;}
      if (g.phase === 'count') {
        for (const t of [.6, 1.2, 1.8]) if (g.clock >= t && g.clock - DT < t) sfx('beep', .35);
        if (g.clock >= GO_T) {g.phase = 'race'; g.beams.push(g.clock); sfx('go', .45); feel('side', 9); loop('bed-race.mp3', .12);
          tip('pit', `A PIT STOP IS THE MODEL THINKING. ${m.name} THINKS ${thinkOf(road, m)} s BEFORE EACH ${road.unit}. WATCH WHO LEAVES FIRST.`);}
        return;
      }
      for (const r of g.rivals) {
        for (const e of tick(r.s, botInput(r.s, 'trust'))) if (e.k === 'wrong') r.flash = 1.2;
        r.flash = Math.max(0, r.flash - DT);
      }
      if (g.phase === 'end') {if (g.clock - g.tEnd > END_HOLD) finishRace(); return;}
      const inp: Input = g.auto ? botInput(you, g.auto, g.nitroHeld) : {lane: g.lane, brake: g.brakeHeld, nitro: g.nitroHeld};
      g.lane = inp.lane;
      const wasNitro = you.nitro, spent0 = you.spent;
      for (const e of tick(you, inp)) onEv(e);
      if (you.nitro && !wasNitro) {sfx('nitro', .4); tip('fast', `FAST MODE: ×${m.fast!.k} SPEED AT TWICE THE PRICE. WATCH THE COINS.`);}
      // a coin out of the exhaust for every slice of the budget spent
      const slice = road.budget / 40;
      if (Math.floor(you.spent / slice) > Math.floor(spent0 / slice)) g.coins[g.coinN++ % COINS] = {t0: g.clock, x: you.x * LANE, d: you.d};
      if (you.k < n && you.plan.calls[you.k] === 'ask' && you.phase === 'drive' && wallD(road, you.k) - you.d < 100)
        tip('ask', '"NOT SURE": NO LIGHT. IT ADMITS IT DOESN\'T KNOW. HOLD ↓ AND FIND THE GAP YOURSELF.');
    };
    const finishRace = () => {
      if (g.phase !== 'end' || !ref.current) return;
      ref.current = null;
      done.current({you, rivals: g.rivals.map(r => ({id: r.id, s: finish(r.s)})), seed});
    };

    const key = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'shift') g.nitroHeld = down;
      if (k === 'arrowdown' || k === 's') g.brakeHeld = down;
      if (!down || e.repeat) return;
      if (k === 'arrowleft' || k === 'a') g.lane = Math.max(-1, g.lane - 1);
      if (k === 'arrowright' || k === 'd') g.lane = Math.min(1, g.lane + 1);
      if (k === 'escape') quit.current();
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    const tap = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      g.lane = e.clientX < innerWidth / 2 ? Math.max(-1, g.lane - 1) : Math.min(1, g.lane + 1);
    };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('pointerdown', tap);

    const draw = () => {rig.render(stateOf(g, road, m.body, lay)); setTick(t => t + 1);};
    rig.warm(); draw();   // pay for every shader and texture now, before the countdown, then put the real first frame on top
    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      acc += Math.min(.1, (now - last) / 1000); last = now;
      while (acc >= DT) {acc -= DT; step();}
      if (!ref.current) return;
      draw();
      loop('engine.wav', .06 + .05 * g.nitroVis + .04 * clamp(you.v / 60), Math.min(2, .6 + you.v / 90));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // ponytail: test hook for a hidden browser (no animation frames there); only with #test in the address.
    // F9 runs 2 s of game, F10 runs 10 s, F6 runs 0.2 s, F8 toggles fast mode, F4 toggles the brake,
    // F7 hands the wheel to a bot (smart, trust, careful, off);
    // the state lands in document.body.dataset.pym
    const hook = (e: KeyboardEvent) => {
      const sec = e.key === 'F9' ? 2 : e.key === 'F10' ? 10 : e.key === 'F6' ? .2 : 0;
      if (e.key === 'F8') g.nitroHeld = !g.nitroHeld;
      if (e.key === 'F4') g.brakeHeld = !g.brakeHeld;
      if (e.key === 'F7') g.auto = g.auto === null ? 'smart' : g.auto === 'smart' ? 'trust' : g.auto === 'trust' ? 'careful' : null;
      for (let i = 0; i < sec / DT && ref.current; i++) step();
      if (ref.current) draw();
      document.body.dataset.pym = JSON.stringify({phase: g.phase, auto: g.auto, t: +you.t.toFixed(1), stint: you.stint, k: you.k, you: you.phase, v: +you.v.toFixed(1), x: +you.x.toFixed(2),
        marks: you.marks.map(x => x ? x[0] : '-').join(''), spent: +you.spent.toFixed(3), right: you.right, wrong: you.wrong, caught: you.caught, end: you.end,
        calls: you.plan.calls.map(x => x[0]).join(''), hard: you.plan.hard.join(''), tip: g.tip?.text, rivals: g.rivals.map(r => [r.id, r.s.k, r.s.phase, r.s.wrong, r.s.end])});
    };
    if (location.hash === '#test') addEventListener('keyup', hook);
    return () => {
      removeEventListener('keyup', hook);
      cancelAnimationFrame(raf); ref.current = null;
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('pointerdown', tap);
      loop('engine.wav', 0); loop('bed-race.mp3', 0);
      canvas.current?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  const cur = ref.current;
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#9fd0ff'}}>
    <canvas ref={canvas} width={CW} height={CH} style={{position: 'absolute', inset: 0, width: W, height: H}}/>
    {cur && <Hud g={cur.g} road={road} rig={cur.rig} pick={pick} setNitro={v => {cur.g.nitroHeld = v;}} setBrake={v => {cur.g.brakeHeld = v;}} quit={onQuit}/>}
  </div>;
};

/* ---------- what the world draws this frame ---------- */
const YELLOW = '#ffd23f', GREEN = '#37e0c8', RED = '#ff5a4e';
/** How many of the stint's calls are out: they come one by one while it thinks in the pit. */
const calledUpTo = (s: Sim) => s.stint * s.road.per + (s.phase === 'pit' ? Math.floor(s.road.per * (1 - s.left / pitOf(s.road, s.m)) + 1e-6) : s.road.per);
function lanesOf(g: Game, r: Road, lay: Layout): State['lanes'] {
  const s = g.you, p = s.plan, out: State['lanes'] = lay.spec.gates.map(() => null);
  const called = g.phase === 'count' ? 0 : calledUpTo(s), rev = revealOf(r, s.m), L = (lane: number) => lane + 1;
  for (let k = 0; k < s.n; k++) {
    const light = [0, 0, 0], col = [YELLOW, YELLOW, YELLOW], wall = [0, 0, 0], truth = p.truth[k], lit = p.lit[k];
    const dist = wallD(r, k) - NOSE - s.d;
    if (k < s.k || dist <= rev) {   // close enough to see, or behind you: walls in the two closed lanes, green in the open one
      const up = k < s.k ? 1 : clamp((rev - dist) / 1.5);
      for (let j = -1; j <= 1; j++) if (j !== truth) wall[L(j)] = up;
      light[L(truth)] = k < s.k ? .3 : .9; col[L(truth)] = GREEN;
      if (lit !== null && lit !== truth && k >= s.k) {light[L(lit)] = .6; col[L(lit)] = RED;}
      if (s.marks[k] === 'wrong' && !(s.phase === 'crash' && k === s.k - 1)) wall[L(s.took[k])] = 0;   // the wall it hit drops to let it on
    } else if (k < called && lit !== null) light[L(lit)] = k === s.k ? .95 : .45;
    out[lay.fork[k]] = {light, col, wall};
  }
  return out;
}
const NO_COIN = {x: 0, d: -9999, y: -99, spin: 0, s: .001};
function stateOf(g: Game, r: Road, body: keyof typeof ROOF_Y, lay: Layout): State {
  const s = g.you, pd = s.d, n = g.nitroVis, sp = clamp(s.v / 40), x = s.x * LANE, pv = inOut(clamp(g.pitVis)), pit = pitOf(r, s.m);
  const shake = g.shake > 0 ? (hash(Math.floor(g.clock * 60)) - .5) * g.shake * .6 : 0;
  let cam: State['cam'];
  if (g.phase === 'count') {  // the grid: swing from the car's nose round to behind it
    const u = clamp(g.clock / GO_T), a = lerp(-2.5, 0, inOut(u)), R = lerp(6.4, 8.2, u);
    cam = {pos: [Math.sin(a) * R, lerp(1.35, 3.55, inOut(u)), -(pd - Math.cos(a) * R)], look: [0, lerp(1.1, .7, u), -(pd + lerp(0, 16, u))], fov: 56, roll: 0};
  } else cam = {   // behind the car; in the pit it lifts and sits a little to the car's right: enough to watch the crew, not so far that the car hides the two on its left
    pos: [x * .72 + shake + (x * .28 + 1.8) * pv, lerp(3.55, 2.7, n) + 1.5 * pv, -(pd - lerp(8.2, 6.4, n) + sp * .4)], look: [x * .9, lerp(.7, 1.2, n), -(pd + 16 - 14 * pv)],
    fov: lerp(55 + sp * 7, 80, n), roll: n * (Math.sin(g.clock * 57) * .006 + Math.sin(g.clock * 111) * .003)};
  const yaw = s.v > 1 ? -(s.lane - s.x) * LANE * .05 : 0, inPit = g.phase === 'race' && s.phase === 'pit';
  return {
    f: g.clock * 30, tod: r.tod, lamps: g.clock >= GO_T ? 4 : [.6, 1.2, 1.8].filter(t => g.clock >= t).length, cam,
    car: {x, d: pd, yaw, roll: -yaw * .35, nitro: n, bob: (Math.sin(g.clock * 27) * .012 + Math.sin(g.clock * 69) * .006) * sp + .1 * pv},
    ghost: {x: 0, d: -9999, o: 0},
    // rivals appear on GO, and thin out where one sits on top of your car
    ghosts: g.rivals.map(rv => {const d = rv.s.d, rx = rv.s.x * LANE, over = clamp(1 - Math.abs(d - pd) / 8) * clamp(1 - Math.abs(rx - x) / 2.5);
      return {x: rx, d, o: clamp((g.clock - GO_T) / .6) * (1 - .8 * over)};}),
    traffic: [],
    coins: [...Array(COINS)].map((_, i) => {const c = g.coins[i], u = c ? (g.clock - c.t0) / .7 : 2;
      return !c || u >= 1 ? NO_COIN : {x: c.x + (hash(i) - .5) * 2.4 * u, d: c.d - 2.9 - u * 1.5, y: .5 + Math.sin(u * Math.PI) * 1.5, spin: g.clock * 9 + i, s: 1 - u * u};}),
    gates: lay.spec.gates.map(() => ({s: 1, flash: 0})),
    lanes: lanesOf(g, r, lay),
    pit: inPit ? {x, d: pd, t: pit - s.left, dur: pit} : null,
    beams: g.beams.map(t0 => ({from: [x, ROOF_Y[body] + .3, -pd] as V3, p: (g.clock - t0) / .87})).filter(b => b.p >= 0 && b.p <= 1),
    blimp: [21, 21 + Math.sin(g.clock * .75) * .6, -(pd + 102)],
  };
}

/* ---------- the pit crew's kit: a hard hat, a hi-vis vest and a wrench, painted over the rig's own Meb (a costume and a prop; the Meb underneath is untouched) ---------- */
const KIT: Record<string, string> = {...PAL, H: '#FFD44F', h: '#D9A21B', V: '#FF7A1A', v: '#C9570A', G: '#C3CAD6'};
const KIT_TOP = 1, KIT_W = 50;   // the kit needs one row above Meb's 40×40 grid (the hat) and ten columns to its right (the wrench)
const HAT = ['.....OOOOOOOO.....', '....OHHHhhHHHO....', '...OHHHHhhHHHHO...', '..OHHHHHhhHHHHHO..', '.OOHHHHHhhHHHHHOO.', 'OhhhhhhhhhhhhhhhhO'];   // from column 11, between the ears
function crewPx(pose: Pose): Grid {
  const [l0, l1] = armCap(-1, pose.armL ?? 0), [sh, hand] = armCap(1, pose.armR ?? 0);
  const px: Grid = [Array(KIT_W).fill(null), ...meb(pose).map(row => [...row, ...Array(KIT_W - G).fill(null)])];
  // the vest: the body's own pixels from the neck to the hips, with one reflective band
  for (let j = 25; j <= 32; j++) for (let i = 10; i < 30; i++) {
    const x = i + .5, y = j + .5, c = px[j + KIT_TOP][i];
    if ((c === 'W' || c === 'L' || c === 'S') && inEll(x, y, 20, 29, 6.6 + Math.max(0, y - 26) * .28, 7.2) && !inEll(x, y, 20, 15, HW, 10.2, 2.6)
      && !inCap(x, y, l0[0], l0[1], l1[0], l1[1], 1.7) && !inCap(x, y, sh[0], sh[1], hand[0], hand[1], 1.7)) px[j + KIT_TOP][i] = j === 30 ? 'H' : c === 'S' ? 'v' : 'V';
  }
  HAT.forEach((row, j) => [...row].forEach((c, i) => {if (c !== '.') px[j][11 + i] = c;}));
  // the wrench: a handle on from the right hand along the arm, a round head, a notch for the jaws
  const L = Math.hypot(hand[0] - sh[0], hand[1] - sh[1]), ux = (hand[0] - sh[0]) / L, uy = (hand[1] - sh[1]) / L, cx = hand[0] + ux * 8, cy = hand[1] + uy * 8;
  const steel: [number, number][] = [];
  px.forEach((row, rr) => row.forEach((_, i) => {const x = i + .5, y = rr - KIT_TOP + .5;
    if ((inCap(x, y, hand[0] + ux, hand[1] + uy, cx, cy, .9) || inEll(x, y, cx, cy, 2.4, 2.4)) && !inCap(x, y, cx + ux * .8, cy + uy * .8, cx + ux * 4, cy + uy * 4, .85)) steel.push([i, rr]);}));
  for (const [i, rr] of steel) px[rr][i] = 'G';
  for (const [i, rr] of steel) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (px[rr + b] && px[rr + b][i + a] === null) px[rr + b][i + a] = 'O';
  return px;
}

/* ---------- the HUD ---------- */
const v3 = new THREE.Vector3();
export const Mono: React.FC<{size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({size, color = '#fff', children, style}) =>
  <div style={{fontFamily: MONO, fontSize: size, color, ...style}}>{children}</div>;
const Hud: React.FC<{g: Game; road: Road; rig: Rig; pick: ModelId; setNitro: (v: boolean) => void; setBrake: (v: boolean) => void; quit: () => void}> = ({g, road: r, rig, pick, setNitro, setBrake, quit}) => {
  const m = MODELS[pick], s = g.you, p = s.plan, len = lenOf(r), n = s.n, top = topOf(r, m);
  const project = (q: V3) => {v3.set(...q).project(rig.camera); return {x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, ok: v3.z < 1};};
  const pd = s.d, x = s.x * LANE, t = g.clock;
  const racing = g.phase === 'race' && !s.end, inPit = racing && s.phase === 'pit', fk = s.nitro && m.fast ? m.fast.k : 1;
  // Meb on the roof: he is you
  const roof: V3 = [x, ROOF_Y[m.body] + .1 * clamp(g.pitVis), -(pd - .15)], mp = project(roof), mh = mp.y - project([roof[0], roof[1] + 1.3, roof[2]]).y, ms = mh / 34;
  const won = g.phase === 'end' && s.end === 'done';
  const arms = won ? {armL: 140 + Math.sin(t * 9) * 12, armR: 140 - Math.sin(t * 9) * 12}
    : g.nitroVis > .3 ? {armL: 100 + Math.sin(t * 27) * 40, armR: 100 + Math.cos(t * 24) * 40}
    : inPit ? {armL: 20, armR: 150 + Math.sin(t * 3) * 8}
    : g.phase === 'count' ? {armR: 115 + Math.sin(t * 6) * 25} : {armL: Math.sin(t * 5) * 20, armR: -Math.sin(t * 5) * 20};
  const face: Face = g.faceT > 0 ? g.face : 'happy';
  // the pit crew: a Meb at each wheel, drawn facing the car; the far side goes under the roof Meb
  const pitS = inPit ? {x, d: pd, t: pitOf(r, m) - s.left, dur: pitOf(r, m)} : null;
  const crewMeb = (i: number) => {
    if (!pitS) return null;
    const w = crewAt(pitS, i), q = project(w.pos), sc = (q.y - project([w.pos[0], w.pos[1] + 1.3, w.pos[2]]).y) / 34;
    if (!q.ok || sc < .3) return null;
    const px = crewPx(w.work ? {face: 'side', armL: 15, armR: 66 + Math.sin(t * 34 + i * 2) * 22} : {face: 'happy', armL: Math.sin(t * 24 + i) * 45, armR: 45 + Math.sin(t * 24 + i) * 25});
    const ground = project([w.pos[0], 0, w.pos[2]]);
    return <React.Fragment key={i}>
      <Shadow x={ground.x - 20 * sc} y={ground.y - 38 * sc} scale={sc}/>
      <Px px={px} x={q.x - 20 * sc} y={q.y - (38 + KIT_TOP) * sc + (w.work ? Math.abs(Math.sin(t * 17 + i)) * 1.2 * sc : 0)} scale={sc} pal={KIT} flip={w.sx > 0}/>
    </React.Fragment>;
  };
  const over = s.spent > r.budget;
  const vp = project([x * .9, 1.2, -(pd + 60)]);
  // the bubble over the car: the pit clock, or what the co-driver says about the fork ahead
  const k = s.k, glyph = (kk: number) => p.lit[kk] === null ? '?' : r.id === 'inbox' ? ARROW[p.lit[kk]! + 1] : `${ARROW[p.lit[kk]! + 1]} ${LETTERS[p.lit[kk]! + 1]}`;
  const bubble = !racing ? null
    : s.phase === 'drive' && k < n && k < calledUpTo(s) ? (p.lit[k] === null ? {head: '"NOT SURE"', sub: 'HOLD ↓ AND LOOK', c: '#8fd3ff'} : {head: `IT SAYS ${glyph(k)}`, sub: s.braking ? 'BRAKING · LOOKING' : r.id === 'tickets' ? `${tagOf(p, k)} · IT GETS ${Math.round(m.code.by[p.kind[k]])}%` : `${LEVEL[p.hard[k]]} ${r.unit}`, c: p.hard[k] === 3 ? '#ffb13b' : '#fff'})
    : null;
  const seen = p.calls.slice(0, k), tally = (c: string) => seen.filter(v => v === c).length, [a, b, c] = counts(r, m);
  // the notes: this stint's calls, in order
  const first = Math.min(s.stint, r.stints - 1) * r.per, called = g.phase === 'count' ? 0 : calledUpTo(s);
  return <>
    {(g.nitroVis > .05 || s.v > top * .9) && <svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
      {[...Array(Math.round(14 + 76 * g.nitroVis))].map((_, i) => {const f = Math.floor(t * 30), ang = hash(i + f * 7) * Math.PI * 2, r0 = 520 + hash(i * 3 + f) * 260, ln = 120 + hash(i + f * 13) * 420 * g.nitroVis;
        return <line key={i} x1={vp.x + Math.cos(ang) * r0} y1={vp.y + Math.sin(ang) * r0 * .7} x2={vp.x + Math.cos(ang) * (r0 + ln)} y2={vp.y + Math.sin(ang) * (r0 + ln) * .7}
          stroke="#bfe6ff" strokeWidth={1.5 + hash(i) * 3} opacity={.18 + .55 * g.nitroVis * hash(i * 5 + f)}/>;})}</svg>}
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(8,6,30,${.22 + .3 * g.nitroVis}) 100%)`}}/>
    {/* rival tags */}
    {(() => {
      // nearest tag first; one that would cover a tag already placed moves up a line until it doesn't
      const placed: {x0: number; x1: number; y: number}[] = [];
      return g.rivals.map(rv => ({rv, d: rv.s.d, q: project([rv.s.x * LANE, 2.4, -rv.s.d])})).filter(({d, q}) => Math.abs(d - pd) <= 220 && q.ok && q.x >= 0 && q.x <= W)
        .sort((u, v) => v.q.y - u.q.y).map(({rv, d, q}) => {
          const rm = MODELS[rv.id], hit = rv.flash > 0 || rv.s.phase === 'crash';
          const st = hit ? ' ✗ HIT A WALL' : rv.s.phase === 'pit' ? ` · PIT ${(pitOf(r, rm) - rv.s.left).toFixed(1)}` : rv.s.braking ? ' · NOT SURE' : '';
          const w = (rm.name + st).length * 12.6 + 28, x0 = q.x - w / 2, x1 = q.x + w / 2;
          let y = q.y;
          while (placed.some(o => x1 > o.x0 && x0 < o.x1 && Math.abs(y - o.y) < 36)) y -= 38;
          placed.push({x0, x1, y});
          return <div key={rv.id} style={{position: 'absolute', left: q.x, top: y, transform: 'translate(-50%, -100%)', fontFamily: MONO, fontSize: 21, color: '#fff', whiteSpace: 'nowrap',
            background: hit ? '#c0392bdd' : rm.paint + 'cc', border: '2px solid rgba(255,255,255,.8)', borderRadius: 10, padding: '2px 12px', opacity: clamp(1.4 - Math.abs(d - pd) / 160)}}>{rm.name}{st}</div>;
        });
    })()}
    {CREW.map(([sx], i) => sx < 0 ? crewMeb(i) : null)}
    {/* Meb */}
    {mp.ok && ms > .3 && <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${mp.x - 20 * ms}px, ${mp.y - 38 * ms}px) rotate(${g.nitroVis * -10}deg)`, transformOrigin: `${20 * ms}px ${38 * ms}px`}}>
      <Px px={meb({face, ...arms})} x={0} y={0} scale={ms} pal={PAL}/></div>}
    {CREW.map(([sx], i) => sx > 0 ? crewMeb(i) : null)}
    {/* the co-driver's call for the fork ahead */}
    {bubble && mp.ok && <div style={{position: 'absolute', left: mp.x, top: mp.y - 44 * ms, transform: 'translate(-50%, -100%)', textAlign: 'center', padding: '8px 22px', ...GLASS, borderRadius: 18, borderColor: bubble.c}}>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 34, color: bubble.c, whiteSpace: 'nowrap'}}>{bubble.head}</div>
      <Mono size={18} color="#e8eefc" style={{whiteSpace: 'nowrap'}}>{bubble.sub}</Mono></div>}
    {/* the pit clock */}
    {inPit && <div style={{position: 'absolute', left: 1210, top: 300, textAlign: 'center', padding: '12px 30px', ...GLASS, borderColor: '#ffd23f'}}>
      <Mono size={18} color="#ffd23f" style={{letterSpacing: '.2em'}}>PIT STOP · THINKING</Mono>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 92, color: '#fff', lineHeight: 1.05}}>{g.pitT.toFixed(1)}<span style={{fontSize: 40}}> s</span></div>
      <Mono size={18} color="#e8eefc">{thinkOf(r, m)} s FOR EACH {r.unit}{s.nitro ? ` · FAST ×${fk}` : ''}</Mono></div>}
    {/* the job */}
    <div style={{position: 'absolute', left: 40, top: 34, width: 470, padding: '16px 24px 18px', ...GLASS}}>
      <Mono size={20} color="#ffd23f" style={{letterSpacing: '.2em'}}>{r.name}</Mono>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 42, color: '#fff', marginTop: 2}}>{r.unit} {Math.min(k + 1, n)} <span style={{opacity: .55}}>/ {n}</span>
        {s.streak >= 3 && <span style={{fontSize: 28, color: '#37e0c8', marginLeft: 16}}>×{s.streak}</span>}</div>
      <div style={{display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap'}}>{s.marks.map((mk, i) =>
        <div key={i} style={{width: 13, height: 20, borderRadius: 5, border: i === k && !s.end ? '2px solid #fff' : '1px solid rgba(255,255,255,.35)', boxSizing: 'border-box',
          background: mk ? MARK[mk].c : 'rgba(255,255,255,.15)', marginRight: i % r.per === r.per - 1 ? 8 : 0}}/>)}</div>
      <Mono size={18} color="#fff" style={{marginTop: 10}}>YOU: {s.right} RIGHT · {s.wrong} WRONG</Mono>
      {r.id !== 'inbox' && <>
        <Mono size={16} color="#bfe9ff" style={{marginTop: 6}}>ITS CALLS SO FAR: {tally('right')} RIGHT · {tally('wrong')} WRONG{b ? ` · ${tally('ask')} NOT SURE` : ''}</Mono>
        <Mono size={16} color="#8fa6c4" style={{marginTop: 2}}>ITS TEST SCORE: {a} · {c}{b ? ` · ${b}` : ''} OF {n}</Mono></>}
    </div>
    {/* where everyone is */}
    <div style={{position: 'absolute', left: 560, top: 30, width: 800, height: 130, ...GLASS}}>
      <div style={{position: 'absolute', left: 40, right: 40, top: 58, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.25)'}}/>
      {[...Array(n)].map((_, i) => <div key={i} style={{position: 'absolute', left: 40 + 720 * forkD(r, i) / len - 1, top: 54, width: 2, height: 14, background: 'rgba(255,255,255,.4)'}}/>)}
      {[...Array(r.stints + 1)].map((_, i) => <div key={i} style={{position: 'absolute', left: 40 + 720 * pitD(r, i) / len - 2, top: 48, width: 4, height: 26, background: '#ffd23f'}}/>)}
      {(() => {
        const marks = [...g.rivals.map(rv => ({s: rv.s, mm: MODELS[rv.id], me: false})), {s, mm: m, me: true}].map(o => ({...o, x: 40 + 720 * clamp(o.s.d / len),
          label: (o.me ? 'YOU' : o.mm.name) + (o.s.end === 'done' ? ' ✓' : '')}));
        // YOU keeps the row under the bar; each rival takes the first of three rows where its name doesn't touch
        // another's. Three rivals, three rows, so a name never lands on a name.
        const taken: [number, number][][] = [[], [], []], row = new Map<object, number>();
        for (const mk of marks.filter(o => !o.me).sort((u, v) => u.x - v.x)) {
          const w = mk.label.length * 9 + 14, x0 = mk.x - w / 2, x1 = mk.x + w / 2;
          const i = taken.findIndex(tk => tk.every(([q0, q1]) => x1 < q0 || x0 > q1));
          taken[i].push([x0, x1]); row.set(mk, i);
        }
        return marks.map(mk => {const {x: mx, mm, me, label} = mk; return <React.Fragment key={label}>
          <div style={{position: 'absolute', left: mx, top: me ? 44 : 50, transform: 'translateX(-50%)', width: me ? 38 : 26, height: me ? 38 : 26, borderRadius: '50%',
            background: mm.paint, border: `${me ? 4 : 3}px solid #fff`, opacity: me ? 1 : .75, boxShadow: me ? '0 0 12px rgba(255,255,255,.8)' : undefined, zIndex: me ? 1 : 0}}/>
          <Mono size={me ? 17 : 14} style={{position: 'absolute', left: mx, top: me ? 92 : [22, 4, 110][row.get(mk)!], transform: 'translateX(-50%)', opacity: me ? 1 : .8, whiteSpace: 'nowrap'}}>{label}</Mono>
        </React.Fragment>;});
      })()}
    </div>
    <div style={{position: 'absolute', left: W / 2, top: 170, transform: 'translateX(-50%)', padding: '4px 26px', textAlign: 'center', whiteSpace: 'nowrap', ...GLASS, borderRadius: 16}}>
      <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 38, color: s.t > r.par ? '#ff8a7a' : '#fff'}}>{lap(s.t)}</span>
      <span style={{fontFamily: MONO, fontSize: 22, color: '#8fd3ff', marginLeft: 14}}>★ {r.goals[0]}</span></div>
    {/* a tip, the first time each thing happens */}
    {g.tip && <div style={{position: 'absolute', left: 40, top: 300, width: 470, padding: '14px 24px 16px', ...GLASS, borderColor: '#ffd23f', background: 'rgba(10,16,38,.82)',
      opacity: clamp((t - g.tip.t0) / .2) * clamp((TIP_S - (t - g.tip.t0)) / .4)}}>
      <Mono size={16} color="#ffd23f" style={{letterSpacing: '.2em'}}>WHAT JUST HAPPENED</Mono>
      <Mono size={21} color="#fff" style={{lineHeight: 1.35, marginTop: 4}}>{g.tip.text}</Mono></div>}
    {/* coins */}
    <div style={{position: 'absolute', right: 40, top: 34, width: 380, padding: '16px 24px 18px', ...GLASS, borderColor: s.nitro ? '#5ab8ff' : undefined}}>
      <Mono size={20} color="#ffd23f" style={{letterSpacing: '.2em'}}>COINS SPENT</Mono>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 58, color: over ? '#ff8a7a' : '#fff', lineHeight: 1.1}}>${s.spent.toFixed(2)}</div>
      <div style={{height: 14, borderRadius: 7, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginTop: 6}}>
        <div style={{width: `${clamp(s.spent / r.budget) * 100}%`, height: '100%', background: over ? '#ff8a7a' : '#ffd23f'}}/></div>
      <Mono size={17} color={s.nitro ? '#8fd3ff' : '#cfe0ff'} style={{marginTop: 8}}>
        ★ {r.goals[2]} · {s.nitro ? `FAST $${m.fast!.outP}/M` : `$${priceOf(r, m).outP}/M WRITTEN`}</Mono>
    </div>
    {/* the notes: what it calls at each fork of this stint, as it thinks of them */}
    {g.phase !== 'count' && <div style={{position: 'absolute', left: W / 2, bottom: 30, transform: 'translateX(-50%)', display: 'flex', gap: 10, padding: '10px 14px', ...GLASS}}>
      {[...Array(r.per)].map((_, j) => {const i = first + j, out = i < called, mk = s.marks[i], next = i === k && s.phase !== 'pit';
        return <div key={i} style={{width: 92, height: 92, borderRadius: 14, boxSizing: 'border-box', textAlign: 'center', border: next ? '4px solid #fff' : '2px solid rgba(255,255,255,.25)',
          background: mk ? MARK[mk].c + '55' : next ? 'rgba(255,210,63,.25)' : 'rgba(255,255,255,.06)', opacity: mk ? .7 : 1}}>
          <div style={{fontFamily: BOLD, fontSize: 40, lineHeight: '54px', color: !out ? 'rgba(255,255,255,.25)' : p.lit[i] === null ? '#8fd3ff' : '#fff'}}>{!out ? '·' : mk === 'wrong' ? '✗' : glyph(i)}</div>
          <Mono size={r.id === 'tickets' ? 13 : 15} color={LEVEL_C[r.id === 'inbox' ? 2 : p.hard[i]]}>{r.id === 'inbox' ? `${i + 1}` : tagOf(p, i)}</Mono></div>;})}
    </div>}
    {/* speed */}
    <div style={{position: 'absolute', right: m.fast ? 300 : 40, bottom: 40, padding: '12px 26px', textAlign: 'right', ...GLASS}}>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 64, color: s.nitro ? '#8fd3ff' : s.braking ? '#ffb13b' : '#fff', lineHeight: 1}}>{Math.round(inPit ? m.tps * fk : racing ? s.v / top * m.tps : 0)}</div>
      <Mono size={18} color="#cfe0ff" style={{letterSpacing: '.1em'}}>TOKENS / SEC{inPit ? ' · THINKING' : s.braking ? ' · BRAKING' : ''}{s.nitro ? ` · ×${m.fast!.k}` : ''}</Mono></div>
    {m.fast && <div data-ui="fast" onPointerDown={e => {e.preventDefault(); setNitro(true);}} onPointerUp={() => setNitro(false)} onPointerLeave={() => setNitro(false)}
      style={{position: 'absolute', right: 50, bottom: 34, width: 220, textAlign: 'center', cursor: 'pointer', touchAction: 'none'}}>
      <div style={{width: 170, height: 170, margin: '0 auto', borderRadius: '50%', transform: `scale(${s.nitro ? .92 : 1})`,
        background: 'radial-gradient(circle at 40% 32%, #9fe0ff, #2f7de1 55%, #173f9a)', border: '5px solid #fff', boxShadow: `0 0 ${20 + 40 * g.nitroVis}px rgba(90,184,255,.9)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 30, color: '#fff', lineHeight: 1.05}}>FAST<br/>MODE</div>
        <Mono size={15} color="#e8f6ff" style={{marginTop: 4}}>×{m.fast.k} · ${m.fast.outP}/M</Mono></div>
      <Mono size={16} style={{marginTop: 6, textShadow: '0 2px 4px rgba(0,0,0,.6)'}}>{TOUCH ? 'HOLD' : 'HOLD SPACE'}</Mono></div>}
    {/* the brake, for a touch screen */}
    <div data-ui="brake" onPointerDown={e => {e.preventDefault(); setBrake(true);}} onPointerUp={() => setBrake(false)} onPointerLeave={() => setBrake(false)}
      style={{position: 'absolute', left: 40, bottom: 84, width: 250, textAlign: 'center', cursor: 'pointer', touchAction: 'none', padding: '14px 0', ...GLASS,
        borderColor: s.braking ? '#ffb13b' : undefined, background: s.braking ? 'rgba(255,177,59,.45)' : GLASS.background}}>
      <div style={{fontFamily: BOLD, fontStyle: 'italic', fontSize: 32, color: '#fff'}}>BRAKE ↓</div>
      <Mono size={15} color="#e8eefc">SLOW DOWN TO SEE THE WALLS</Mono></div>
    <Mono size={19} style={{position: 'absolute', left: 40, bottom: 34, textShadow: '0 2px 5px rgba(0,0,0,.7)', lineHeight: 1.6}}>
      {TOUCH ? 'TAP THE LEFT OR RIGHT SIDE TO CHANGE LANE' : `← →  LANE   ↓  BRAKE${m.fast ? '   SPACE  FAST MODE' : ''}   ESC  QUIT`}</Mono>
    <Btn label="✕ QUIT" size={20} act={quit} style={{position: 'absolute', right: 40, top: 236}}/>
    {/* pops */}
    {g.pops.filter(q => t - q.t0 < q.dur).map((q, i) => {const u = t - q.t0, o = clamp(u / .08) * clamp((q.dur - u) / .25);
      return <div key={i + '-' + q.t0} style={{position: 'absolute', left: W / 2, top: q.y, transform: `translate(-50%, -50%) rotate(-4deg) scale(${lerp(.3, 1, outBack(clamp(u / .35)))})`, opacity: o, textAlign: 'center'}}>
        <GameText text={q.text} size={q.size} from={q.from} to={q.to}/>
        {q.sub && <div style={{fontFamily: MONO, fontSize: 26, color: '#fff', background: 'rgba(10,16,38,.72)', borderRadius: 12, padding: '4px 16px', display: 'inline-block', marginTop: 4}}>{q.sub}</div>}</div>;})}
    {g.hurt > 0 && <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${220 * g.hurt / .35}px rgba(255,60,40,.7)`}}/>}
  </>;
};
