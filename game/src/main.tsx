/**
 * Pick Your Model. The shell around the worlds: the map where you pick one (the video's ending map), then for
 * world 1, the highway, its driving-school cards, road select, garage and podium; world 2, the front desk, is deskview.tsx; world 3,
 * the blocks, is blocksview.tsx; world 4, the arena, is arenaview.tsx; world 5, the court, is courtview.tsx; world 6, the ship, is shipview.tsx. And the
 * page that shows every number and where it comes from. Everything is drawn on a 1920x1080 stage scaled
 * to the window, so the video's HUD sizes carry over as they are.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import BVP_URL from '../../remotion/public/fonts/BeVietnamPro-Bold.ttf';
import BVPM_URL from '../../remotion/public/fonts/BeVietnamPro-Medium.ttf';
import {BOLD, MONO, clamp, inOut, lerp} from '../../remotion/src/meb-hatch/rig';
import {MebVec} from '../../remotion/src/opus55/mebvec';
import {C, Diorama, Flag, ISLES, MAIN_DOTS, NODES, Plate, Platform, TREES, Tree, blob} from '../../remotion/src/opus55/worldmap';
import {GameText, H, MARK, Race, TOUCH, W} from './race';
import type {Result} from './race';
import {ROADS, SWAP, aloneLine, carsOf, counts, forksOf, goalsOf, lap, mmss, money, priceOf, raceTip, run, stars, wait, why} from './rules';
import type {Road, RoadId} from './rules';
import {AA, AA_EFFORT, AA_KNOWS, CARS, CHECKED, CODE_ALL, FAST, HAIKU_READ, INJECT, KINDS, MODELS, PRICING, RECHECKED, SONNET_POST, SOURCES, SPEND, TB4_READ, VALS, VALS4, cardOf} from './stats';
import type {Body, Model, ModelId} from './stats';
import {isMuted, loop, sfx, toggleMute} from './sound';
import {ANIM, Cite, Explain, In, Moves, markSeen, movesDone, seen, useT} from './explain';
import type {Card} from './explain';
import {Button, Hit, Icon, Keys, MUTE, Proof, Sheet, Star, Stars, SystemCards, TAP, cap, nm, txt} from './ui';
import type {IconName} from './ui';
import {DAYS, FEE, SQUEEZE} from './desk';
import {Desk} from './deskview';
import {FIGHTERS, STAGES, dialOf, hms, mixOf} from './arena';
import {Arena, bestOf} from './arenaview';
import {CASES, CONTEXT, GUIDE} from './court';
import {Court, caseBest} from './courtview';
import {SITES} from './blocks';
import {Blocks, bestOf as siteBest} from './blocksview';
import {CREW, ROOMS, pc} from './ship';
import {Ship, bestOf as roomBest} from './shipview';

/* ---------- small kit ---------- */
let modal = false;   // while the numbers page is open, the screen under it ignores keys
function useKeys(on: (k: string) => void) {
  const r = useRef(on); r.current = on;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {const k = e.key.toLowerCase(); if (k === ' ' || k.startsWith('arrow')) e.preventDefault(); if (!modal) r.current(k);};
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, []);
}
function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {let raf = 0; const t0 = performance.now(); const f = (n: number) => {setT(Math.max(0, n - t0) / 1000); raf = requestAnimationFrame(f);}; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);}, []);
  return t;
}
const Mono: React.FC<{size?: number; color?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({size = 22, color = '#fff', children, style}) =>
  <div style={{fontFamily: MONO, fontSize: size, color, letterSpacing: '.06em', ...style}}>{children}</div>;
const Foot: React.FC<{text: string}> = ({text}) => <Mono size={21} color="#fff" style={{position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', textShadow: '0 2px 5px rgba(0,0,0,.7)'}}>{text}</Mono>;
const DISCLAIMER = 'UNOFFICIAL FAN GAME · NOT MADE OR ENDORSED BY ANTHROPIC';

/** The menus' backdrop: the highway at a standstill, sky to horizon, lane dashes rolling. */
const Backdrop: React.FC<{t: number}> = ({t}) => <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a6fd6"/><stop offset="1" stopColor="#c4e4ff"/></linearGradient></defs>
  <rect width={W} height={620} fill="url(#sky)"/><rect y={620} width={W} height={H - 620} fill="#5aa83c"/>
  <path d={`M${W / 2 - 60} 620 L${W / 2 + 60} 620 L${W / 2 + 900} ${H} L${W / 2 - 900} ${H} Z`} fill="#3b3e45"/>
  {[-1, 1].map(s => [...Array(12)].map((_, i) => {const u = ((i + Math.max(0, t) * 1.6) % 12) / 12, y0 = 620 + Math.pow(u, 2.2) * 460, y1 = 620 + Math.pow(Math.min(1, u + .035), 2.2) * 460;
    const x = (y: number) => W / 2 + s * 300 * (y - 620) / 460 * .66;
    return <path key={`${s}-${i}`} d={`M${x(y0)} ${y0} L${x(y1)} ${y1}`} stroke="#f4f2ea" strokeWidth={2 + u * 14}/>;}))}
  <rect width={W} height={H} fill="rgba(10,16,38,.45)"/>
</svg>;

/** Each body's side view, from the same outline numbers race3d.ts extrudes (front to the right). */
const OUTLINE: Record<Body, {body: number[][]; cabin: number[][]; wheels: [number, number]; r: number}> = {
  sports: {body: [[-2.25, .3], [-2.33, .55], [-2.3, .82], [-2.05, .95], [1.15, .97], [2.0, .8], [2.33, .6], [2.3, .34], [2.1, .28], [-2.1, .28]],
    cabin: [[-1.72, .93], [-.78, 1.29], [.32, 1.31], [1.2, .95]], wheels: [1.45, -1.5], r: .37},
  hatch: {body: [[-1.95, .3], [-2.0, .55], [-1.98, .95], [-1.9, 1.02], [1.3, 1.02], [1.85, .86], [2.0, .6], [1.97, .32], [1.8, .28], [-1.8, .28]],
    cabin: [[-1.86, .98], [-1.76, 1.48], [.42, 1.5], [1.22, 1.0]], wheels: [1.25, -1.25], r: .33},
  gt: {body: [[-2.55, .32], [-2.62, .6], [-2.55, .88], [-2.2, .98], [.2, 1.0], [1.1, .93], [2.3, .82], [2.62, .62], [2.6, .36], [2.35, .3], [-2.35, .3]],
    cabin: [[-1.95, .96], [-1.0, 1.3], [-.1, 1.32], [.8, .98]], wheels: [1.75, -1.7], r: .4},
  classic: {body: [[-2.6, .35], [-2.66, .72], [-2.5, .96], [-1.6, 1.02], [1.4, 1.02], [2.4, .96], [2.64, .74], [2.62, .38], [-2.6, .35]],
    cabin: [[-1.5, .98], [-1.36, 1.6], [.74, 1.6], [.96, .98]], wheels: [1.75, -1.75], r: .42},
};
const CarIcon: React.FC<{body: Body; paint: string; w: number}> = ({body, paint, w}) => {
  const o = OUTLINE[body], pts = (p: number[][]) => p.map(([u, v]) => `${u},${-v}`).join(' ');
  return <svg width={w} height={w * .36} viewBox="-2.9 -1.8 5.8 2.1">
    <polygon points={pts(o.cabin)} fill="#1b2a44" stroke="#9fd3ff" strokeWidth={.05}/>
    <polygon points={pts(o.body)} fill={paint} stroke="#1b2440" strokeWidth={.06}/>
    {o.wheels.map(u => <g key={u}><circle cx={u} cy={-o.r} r={o.r} fill="#1a1a1e"/><circle cx={u} cy={-o.r} r={o.r * .55} fill="#c9ccd4"/></g>)}
  </svg>;
};

/* ---------- the stats, and which ones each road tests ---------- */
type StatKey = 'tps' | 'think' | 'think100k' | 'codeTime' | 'codeCost' | 'knows' | 'guesses' | 'reads' | 'codes' | 'price';
const STAT: Record<StatKey, {label: string; value: (m: Model) => string; frac: (m: Model) => number; less?: boolean}> = {
  tps: {label: 'WRITES', value: m => `${m.tps} TOK/S`, frac: m => m.tps / 100},
  think: {label: 'THINKS FIRST', value: m => `${m.think} S`, frac: m => m.think / 40, less: true},
  think100k: {label: 'THINKS, LONG INPUT', value: m => `${m.think100k} S`, frac: m => m.think100k / 90, less: true},
  // the coding test's own time and cost per task: the tickets show them, beside that test's score
  codeTime: {label: 'TIME PER TASK', value: m => `${Math.round(m.code.time / 60)} MIN`, frac: m => m.code.time / 6300, less: true},
  codeCost: {label: 'COST PER TASK', value: m => money(m.code.cost), frac: m => m.code.cost / 27, less: true},
  knows: {label: 'KNOWS', value: m => `${m.knows}%`, frac: m => m.knows / 100},
  guesses: {label: 'GUESSES WHEN UNSURE', value: m => `${m.guesses}%`, frac: m => m.guesses / 100, less: true},
  reads: {label: 'RIGHT FROM A DOCUMENT', value: m => `${m.reads}%`, frac: m => m.reads / 100},
  codes: {label: 'CODE RIGHT FIRST TIME', value: m => `${m.code.all}%`, frac: m => m.code.all / 100},
  price: {label: 'PRICE IN / OUT', value: m => `$${m.inP} / $${m.outP}`, frac: m => m.outP / 50, less: true},
};
const TESTED: Record<RoadId, StatKey[]> = {inbox: ['think', 'tps', 'price'], tickets: ['codes', 'codeTime', 'codeCost'],
  memory: ['knows', 'guesses', 'think'], openbook: ['reads', 'think100k', 'price']};

/* ---------- your best stars, per road and car (only your own runs) ---------- */
type Best = Partial<Record<RoadId, Partial<Record<ModelId, number>>>>;
const loadBest = (): Best => {try {return JSON.parse(localStorage.getItem('pym3.best') || '{}');} catch {return {};}};
const saveBest = (b: Best) => {try {localStorage.setItem('pym3.best', JSON.stringify(b));} catch {}};
type DeskBest = Record<string, number>;   // world 2: your best stars per day
const loadDesk = (key = 'pym3.desk'): DeskBest => {try {return JSON.parse(localStorage.getItem(key) || '{}');} catch {return {};}};
const saveDesk = (b: DeskBest, key = 'pym3.desk') => {try {localStorage.setItem(key, JSON.stringify(b));} catch {}};
const ARENA_KEY = 'pym3.arena2';   // world 4: your best stars per round and fighter ("r1.opus55"); "pym3.arena" held the hold-to-think arena's
const SHIP_KEY = 'pym3.ship3';      // world 6: your best stars per role, shift and crew ("k1.opus55" as the watcher, "i.k1.opus55" as the impostor); ship3 since the consoles started asking
const BLOCKS_KEY = 'pym3.blocks';   // world 3: your best stars per site and builder ("s1.opus55", "s3.opus55.fast")
const COURT_KEY = 'pym3.court';     // world 5: your best stars per case ("c1"); there is no model to pick there
/** The best run on a road: [car, stars]. Only the road's own cars count: a star saved for Haiku 4.5, which has left the game, is nobody's. */
const topOf = (best: Best, id: RoadId) => (Object.entries(best[id] || {}) as [ModelId, number][]).filter(([c]) => carsOf(ROADS.find(r => r.id === id)!).includes(c))
  .sort((a, b) => b[1] - a[1])[0] as [ModelId, number] | undefined;

/* ---------- screens ---------- */
/**
 * The first screen: the video's ending map (remotion/src/opus55/worldmap.tsx), where every universe of the video is
 * a level. Four are built and the rest wait. The pointer or the arrows choose a world; a click or Enter plays it
 * (on a touch screen the first tap chooses, the second plays, or the PLAY button).
 */
const WORLDS = [
  {name: 'THE RALLY', line: 'You drive. The model calls the road. Learn when to trust it.', open: true},
  {name: 'THE FRONT DESK', line: 'Six workers, one per model. Send every job to the right desk.', open: true},
  {name: 'THE BLOCKS', line: 'The model builds the tower. You choose when to check it.', open: true}, {name: 'THE ARENA', line: 'The model takes a swing at every job. When it misses, read why and pick the fix.', open: true}, {name: 'THE COURT', line: 'Your first draft takes the stand. Fix it before the Reader acts on it.', open: true}, {name: 'THE SHIP', line: 'One file on the ship carries a hidden order. Guard the consoles, or be that file.', open: true},
];
const CAM = {cx: 1550, cy: 800, z: .62};
const mebSpot = (n: number): [number, number] => [NODES[n][0] + (n % 2 ? -190 : 190), NODES[n][1] + 70];   // the side its flag isn't on
/* The map's still parts are drawn once and the waves 15 times a second (a wave moves under a pixel in that time):
 * redrawing all of it every frame took a slowed phone down to 7 frames a second on this screen. */
const [ICX, ICY, IA, IB, IN, ISEED] = ISLES[0];
const RING = blob(ICX, ICY, IA, IB, IN, 70, ISEED);
const Waves = React.memo<{q: number}>(({q}) => <>{[...Array(160)].map((_, k) => {
  const x = -1400 + (k % 16) * 440 + (Math.floor(k / 16) % 2) * 220 + Math.sin(q * 2 / 22 + k) * 14, y = -900 + Math.floor(k / 16) * 330;
  return <path key={k} d={`M${(x - 34).toFixed(1)} ${y} Q${x.toFixed(1)} ${y - 16} ${(x + 34).toFixed(1)} ${y}`} stroke={C.wave} strokeWidth={7} fill="none" strokeLinecap="round"/>;})}</>);
const Island = React.memo(() => <>
  <path d={blob(ICX, ICY, IA, IB, IN, 45, ISEED)} fill={C.sand} stroke="#2A2540" strokeWidth={6}/>
  <path d={blob(ICX, ICY, IA, IB, IN, 0, ISEED)} fill={C.grass}/>
  {TREES.slice(0, 3).map(([x, y], k) => <Tree key={k} x={x} y={y}/>)}
  {MAIN_DOTS.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={11} fill="#fff6d8" stroke="#2A2540" strokeWidth={3}/>)}</>);
const Spot = React.memo<{n: number; open: boolean}>(({n, open}) => {const [x, y] = NODES[n];
  return <g style={open ? undefined : {filter: 'grayscale(1) contrast(.55) brightness(1.25)'}}><Platform x={x} y={y}/><Diorama i={n} x={x} y={y}/></g>;});
const Worlds: React.FC<{at: number; stars: ([number, number] | undefined)[]; go: (i: number) => void}> = ({at, stars, go}) => {
  const t = useClock(), [i, setI] = useState(at), hop = useRef({x: mebSpot(at)[0], y: mebSpot(at)[1], t0: -9});
  const u = clamp((t - hop.current.t0) / .45), [tx, ty] = mebSpot(i), mx = lerp(hop.current.x, tx, inOut(u)), my = lerp(hop.current.y, ty, inOut(u));
  const move = (n: number) => {if (n === i) return; hop.current = {x: mx, y: my, t0: t}; setI(n); sfx('select', .3); loop('bed-map.mp3', .09);};
  const play = (n: number) => {if (WORLDS[n].open) {sfx('blip', .4); go(n);} else sfx('buzz', .25);};
  useKeys(k => {if (k === 'arrowleft') move(Math.max(0, i - 1)); if (k === 'arrowright') move(Math.min(WORLDS.length - 1, i + 1)); if (k === 'enter' || k === ' ') play(i);});
  useEffect(() => {loop('bed-map.mp3', .09); return () => loop('bed-map.mp3', 0);}, []);
  const w = WORLDS[i], st = stars[i], f = t * 30;
  return <div style={{position: 'absolute', inset: 0, background: C.sea}}>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <g transform={`translate(${W / 2} ${H / 2 + 30}) scale(${CAM.z}) translate(${-CAM.cx} ${-CAM.cy})`}>
        <rect x={-3000} y={-3000} width={9000} height={8000} fill={C.sea}/>
        <Waves q={Math.floor(f / 2)}/>
        <path d={RING} fill="none" stroke="#fff" strokeWidth={10} opacity={.45 + .15 * Math.sin(f / 12)}/>
        <Island/>
        {[1, 3, 5, 0, 2, 4].map(n => {const [x, y] = NODES[n], wd = WORLDS[n], on = n === i, sn = stars[n], all = sn && sn[0] === sn[1];   // back row first
          return <g key={n} onPointerEnter={TOUCH ? undefined : () => move(n)} onClick={() => {if (on || !TOUCH) play(n); else move(n);}} style={{cursor: 'pointer'}}>
            {on && <ellipse cx={x} cy={y + 14} rx={198} ry={82} fill="none" stroke="#fff" strokeWidth={9} strokeDasharray="30 20" strokeDashoffset={-t * 40}/>}
            <Spot n={n} open={!!wd.open}/>
            {wd.open && <Flag x={x + (n % 2 ? 125 : -125)} y={y + 5} u={1} f={f} i={n} left={n % 2 === 0} s={all ? 'CLEAR' : 'PLAY'}/>}
            <Plate x={x} y={y + (n % 2 ? 170 : 150)} s={wd.open ? wd.name : 'SOON'} u={1}/>
            <ellipse cx={x} cy={y - 60} rx={200} ry={250} fill="transparent"/>
          </g>;})}
        <MebVec id="mapmeb" x={mx} y={my} k={4.2} f={f} p={{face: 'happy', armL: 16, armR: 75 + 13 * Math.sin(t * 6), reachR: 1.4, lift: Math.sin(u * Math.PI) * 9, look: .4}}/>
      </g>
    </svg>
    <style>{ANIM}</style>
    <div style={{position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', pointerEvents: 'none'}}>
      <GameText text="PICK YOUR MODEL" size={92}/>
      <div style={{...txt(28, 700), textShadow: '0 3px 0 #1b2440'}}>Pick a world</div></div>
    {/* the chosen world, as a level-select banner: its number, its name, its one line, your stars, Play */}
    <div key={i} style={{position: 'absolute', left: 220, right: 220, bottom: 84, height: 172, boxSizing: 'border-box', paddingRight: 34, display: 'flex', alignItems: 'center', gap: 30, borderRadius: 24,
      background: 'rgba(10,16,38,.92)', border: '4px solid #fff', boxShadow: '0 12px 0 rgba(10,16,38,.45)', animation: 'pym-up .25s ease-out both'}}>
      <div style={{alignSelf: 'stretch', width: 150, flex: 'none', borderRadius: '19px 0 0 19px', background: w.open ? '#ffd23f' : 'rgba(255,255,255,.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <span style={txt(22, 700, INK)}>World</span><span style={{...txt(84, 700, INK), lineHeight: 1}}>{i + 1}</span></div>
      <div style={{flex: 1}}>
        <div style={{...txt(52, 700), fontStyle: 'italic', whiteSpace: 'nowrap'}}>{cap(w.name)}</div>
        <div style={txt(26, 500, MUTE)}>{w.open ? w.line : 'Not built yet.'}</div></div>
      {st && <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none'}}><Star on={st[0] > 0} size={58}/><span style={{...txt(26, 700, '#ffd23f'), whiteSpace: 'nowrap'}}>{st[0]} / {st[1]}</span></div>}
      {w.open ? <Hit label="Play" icon="arrow" act={() => play(i)}/> : <span style={{...txt(28, 700, MUTE), whiteSpace: 'nowrap'}}>Coming later</span>}
    </div>
    <Foot text={DISCLAIMER}/>
  </div>;
};

/**
 * Each road's picture: its own sky, the three lanes with the call lit and the walls up, and one big object for
 * the job. Drawn for whatever box it is given: the header of a full card, or on a small screen a tall poster
 * (a closed card) and a wide strip with the road sign (the open card). `c` is the job's own colour.
 */
const SKY = ['linear-gradient(#2a6fd6, #c4e4ff)', 'linear-gradient(#3e5aa8, #ffcf9c)', 'linear-gradient(#1d1747, #ff8466)'];
const GRASS = ['#5aa83c', '#5b9a3c', '#3f7a4a'], INK = '#1b2440', PAPER = '#f4f2ea';
const ART: Record<RoadId, {lit: number; walls: number[]; c: string}> = {inbox: {lit: 2, walls: [0, 1], c: '#6fc3ff'}, memory: {lit: -1, walls: [], c: '#a08bff'},
  openbook: {lit: 0, walls: [1, 2], c: '#ff9ec4'}, tickets: {lit: 1, walls: [0, 2], c: '#4fe3a8'}};
const ICON: Record<RoadId, React.ReactNode> = {   // each in a 100 x 100 box
  inbox: <><rect x={8} y={24} width={84} height={56} rx={8} fill={PAPER} stroke={INK} strokeWidth={5}/>
    <path d="M10 28 L50 58 L90 28" fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round"/>
    <circle cx={88} cy={24} r={17} fill="#e8352e" stroke={INK} strokeWidth={4}/><text x={88} y={31} textAnchor="middle" fontFamily={BOLD} fontSize={20} fill="#fff">12</text></>,
  memory: <><circle cx={50} cy={50} r={42} fill="#5b3fd6" stroke={INK} strokeWidth={5}/><text x={50} y={74} textAnchor="middle" fontFamily={BOLD} fontSize={68} fill="#fff">?</text></>,
  openbook: <><path d="M50 30 Q30 18 6 26 L6 80 Q30 72 50 84 Q70 72 94 80 L94 26 Q70 18 50 30 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round"/>
    <path d="M50 30 L50 84" stroke={INK} strokeWidth={4}/>
    {[42, 54, 66].map(y => <path key={y} d={`M15 ${y} Q30 ${y - 6} 42 ${y + 2} M58 ${y + 2} Q70 ${y - 6} 85 ${y}`} fill="none" stroke="#8fa6c4" strokeWidth={3}/>)}</>,
  tickets: <><rect x={6} y={18} width={88} height={64} rx={8} fill="#10213a" stroke={PAPER} strokeWidth={5}/>
    <text x={16} y={46} fontFamily={MONO} fontSize={22} fill="#37e0c8">{'>_'}</text>
    <g transform="rotate(-9 58 64)"><rect x={26} y={51} width={64} height={27} rx={5} fill="#2ecc71" stroke={INK} strokeWidth={3}/>
      <text x={58} y={71} textAnchor="middle" fontFamily={BOLD} fontSize={19} fill="#10213a">DONE!</text></g></>,
};
const Art: React.FC<{r: Road; w: number; h: number; flat?: boolean}> = ({r, w, h, flat}) => {
  const wide = w > 2.5 * h, hz = h * (wide ? .34 : h > w ? .46 : .56), cx = w / 2, a = ART[r.id], sky = Math.round(r.tod);
  // lane edge 0..3 at depth u: 0 is the horizon, 1 the bottom of the picture
  const X = (edge: number, u: number) => cx + (edge - 1.5) * lerp(w * .06, w * (wide ? .2 : h > w ? .5 : .34), u), Y = (u: number) => hz + (h - hz) * u;
  const s = wide ? h * .66 : Math.min(w * .52, hz * .86), ix = (wide ? w * .11 : cx) - s / 2, iy = (wide ? h * .52 : hz * .5) - s / 2;
  return <div style={{width: w, height: h, borderRadius: flat ? 0 : 14, background: SKY[sky], overflow: 'hidden', flex: 'none'}}>
    <svg width={w} height={h} style={{display: 'block'}}>
      <rect y={hz} width={w} height={h - hz} fill={GRASS[sky]}/>
      {[0, 1, 2].map(l => <path key={l} d={`M${X(l, 0)} ${hz} L${X(l + 1, 0)} ${hz} L${X(l + 1, 1)} ${h} L${X(l, 1)} ${h} Z`} fill={l === a.lit ? '#ffd23f' : '#3b3e45'}/>)}
      {[1, 2].map(e => <path key={e} d={`M${X(e, 0)} ${hz} L${X(e, 1)} ${h}`} stroke={PAPER} strokeWidth={3} strokeDasharray="14 12"/>)}
      {a.walls.map(l => {const x0 = X(l, .5) + 2, ww = X(l + 1, .5) - x0 - 2, wh = ww * .42;
        return <g key={l}><rect x={x0} y={Y(.5) - wh} width={ww} height={wh} rx={4} fill="#e8352e" stroke={INK} strokeWidth={3}/>
          <rect x={x0 + 2} y={Y(.5) - wh * .64} width={ww - 4} height={wh * .26} fill={PAPER}/></g>;})}
      {wide && <g><rect x={w * .86 - 3} y={h * .5} width={6} height={h * .3} fill={INK}/>
        <rect x={w * .74} y={h * .2} width={w * .24} height={h * .32} rx={8} fill="#1f7a4d" stroke={PAPER} strokeWidth={4}/>
        <text x={w * .86} y={h * .36 + 8} textAnchor="middle" fontFamily={BOLD} fontSize={22} fill="#fff">{r.objective.split(' · ')[0]}</text></g>}
      <g transform={`translate(${ix} ${iy}) scale(${s / 100})`}>{ICON[r.id]}</g>
    </svg></div>;
};

/* ---------- the rally's cards (explain.tsx). Anthropic's tip: pick the model for the job, and ask it to say what it
   couldn't confirm. The forks are drawn from behind the car, like the race. ---------- */
const RALLY_KEY = 'pym3.rallyhow';   // set once the cards have been read or skipped
const ADDY_OPUS = 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5", claude.dev, 22 Sep 2026';
const ADDY_SONNET = 'Addy Osmani (Anthropic), "Building with Claude Sonnet 5.5", claude.dev, 28 Sep 2026';
const ease = (u: number) => 1 - (1 - clamp(u)) ** 3;
const CHECKER = (n: number) => `conic-gradient(#111 25%, #fff 0 50%, #111 0 75%, #fff 0) 0 0 / ${n}px ${n}px`;
/** A crash: a red burst of twelve uneven spikes (not a star: on these screens a star is only ever a goal). */
const BANG = 'M' + [...Array(24)].map((_, i) => {const r = i % 2 ? 15 : 30 + (i * 7) % 11, a = i * Math.PI / 12; return `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;}).join('L') + 'Z';
/** The menus' foot: a dark fade, so the keys' line reads over the road. */
const FootFade: React.FC = () => <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, pointerEvents: 'none', background: 'linear-gradient(rgba(10,16,38,0), rgba(10,16,38,.92))'}}/>;
/** A car from behind, its bottom centre at x, y. */
const Rear: React.FC<{x: number; y: number; s: number; paint: string; brake?: boolean; o?: number}> = ({x, y, s, paint, brake, o = 1}) =>
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <rect x={-34} y={-62} width={68} height={26} rx={8} fill="#1b2a44" stroke={INK} strokeWidth={4}/>
    <rect x={-50} y={-42} width={100} height={36} rx={10} fill={paint} stroke={INK} strokeWidth={4}/>
    {[-1, 1].map(k => <g key={k}><rect x={k * 37 - 9} y={-34} width={18} height={9} rx={3} fill={brake ? '#ff3b30' : '#7a1f1f'}/>
      <rect x={k * 40 - 10} y={-8} width={20} height={14} rx={4} fill="#1a1a1e"/></g>)}</g>;
/** The road as the race sees it: three lanes running to the horizon. X is a lane's centre at a depth, 0 the horizon and 1 the bottom. */
const lanes = (w: number, h: number) => {const hz = h * .3, lw = (d: number) => lerp(w * .05, w * .3, d); return {hz, lw, X: (l: number, d: number) => w / 2 + (l - 1) * lw(d), Y: (d: number) => hz + (h - hz) * d};};
const RoadBg: React.FC<{w: number; h: number; sky?: number; lit?: number | null}> = ({w, h, sky = 0, lit = null}) => {const {hz, X} = lanes(w, h), e = (k: number, d: number) => X(k - .5, d);
  return <g><rect width={w} height={hz} fill={['#8cc4ff', '#f0b98a', '#6a4a9a'][sky]}/><rect y={hz} width={w} height={h - hz} fill={GRASS[sky]}/>
    {[0, 1, 2].map(l => <path key={l} d={`M${e(l, 0)} ${hz} L${e(l + 1, 0)} ${hz} L${e(l + 1, 1)} ${h} L${e(l, 1)} ${h} Z`} fill={l === lit ? '#ffd23f' : '#3b3e45'}/>)}
    {[1, 2].map(k => <path key={k} d={`M${e(k, 0)} ${hz} L${e(k, 1)} ${h}`} stroke={PAPER} strokeWidth={3} strokeDasharray="14 12"/>)}</g>;};
/** A fork, from behind the car: the lane the co-driver calls is lit (no light, and a "?", when it says "not sure"), the
 *  walls show up close, and what happens. call null is "not sure": the car brakes, sees the walls in time, takes the open lane. */
const Fork: React.FC<{call: number | null; open: number; at?: number; w?: number; paint?: string}> = ({call, open, at = 0, w = 440, paint = '#4f8cff'}) => {
  const h = Math.round(w * .66), {X, Y, lw} = lanes(w, h), u = Math.max(0, useT() - at) % 3.4;
  const ask = call === null, wrong = !ask && call !== open, T = ask ? 2.6 : 1.9;
  const d = .96 - .46 * ease(u / T) - (wrong ? 0 : .3 * clamp((u - T) / .5)), shown = u > (ask ? .9 : 1.5), crash = wrong && u > T;
  const lx = ask ? lerp(1, open, ease((u - 1.3) / .4)) : lerp(1, call!, ease((u - .4) / .4)), k = lw(d) / lw(1);
  return <svg width={w} height={h} style={{display: 'block'}}><RoadBg w={w} h={h} lit={u < T ? call : null}/>
    {shown && [0, 1, 2].filter(l => l !== open).map(l => {const ww = lw(.5) * .8;
      return <g key={l}><rect x={X(l, .5) - ww / 2} y={Y(.5) - ww * .42} width={ww} height={ww * .42} rx={3} fill="#e8352e" stroke={INK} strokeWidth={2}/>
        <rect x={X(l, .5) - ww / 2 + 2} y={Y(.5) - ww * .28} width={ww - 4} height={ww * .1} fill={PAPER}/></g>;})}
    <Rear x={X(lx, d)} y={Y(d)} s={k} paint={paint} brake={ask && u > .9 && u < T} o={wrong ? 1 : 1 - clamp((u - T - .2) / .3)}/>
    {ask && u < T && <g transform={`translate(${X(lx, d)} ${Y(d) - 86 * k})`}><circle r={18} fill="#fff" stroke={INK} strokeWidth={3}/><text y={8} textAnchor="middle" fontFamily={BOLD} fontSize={24} fill={INK}>?</text></g>}
    {crash && <path transform={`translate(${X(lx, d)} ${Y(d) - 30 * k})`} d={BANG} fill="#ff5b4d" stroke="#fff" strokeWidth={3} strokeLinejoin="round"/>}</svg>;
};
/** The pit: the car stopped under the race's own PIT STOP gantry, a clock filling while the model thinks. */
const PitMini: React.FC<{at: number}> = ({at}) => {
  const w = 440, h = 290, {X, Y} = lanes(w, h), a = Math.min(.999, (Math.max(0, useT() - at) % 2.4) / 2) * Math.PI * 2, gy = Y(.8);
  return <svg width={w} height={h} style={{display: 'block'}}><RoadBg w={w} h={h} sky={1}/>
    {[-.5, 2.5].map(l => <rect key={l} x={X(l, .8) - 5} y={110} width={10} height={gy - 110} fill={INK}/>)}
    <rect x={X(-.5, .8) - 14} y={96} width={X(2.5, .8) - X(-.5, .8) + 28} height={42} rx={6} fill="#b3541e" stroke={INK} strokeWidth={4}/>
    <text x={w / 2} y={126} textAnchor="middle" fontFamily={BOLD} fontSize={24} fill="#fff">PIT STOP</text>
    <Rear x={X(1, .88)} y={Y(.88)} s={.8} paint="#6a3fd0" brake/>
    <g transform={`translate(${X(1, .88)} ${Y(.88) - 84})`}><circle r={26} fill="#fff" stroke={INK} strokeWidth={4}/>
      <path d={`M0 0 L0 -20 A20 20 0 ${a > Math.PI ? 1 : 0} 1 ${(20 * Math.sin(a)).toFixed(1)} ${(-20 * Math.cos(a)).toFixed(1)} Z`} fill="#ffd23f"/></g></svg>;
};
/** Boost: speed lines and blue flames, and the coins going out twice as fast. */
const BoostMini: React.FC<{at: number}> = ({at}) => {
  const w = 440, h = 290, {X, Y} = lanes(w, h), t = Math.max(0, useT() - at), on = t % 2.4 > .8;
  return <svg width={w} height={h} style={{display: 'block'}}><RoadBg w={w} h={h}/>
    {on && [...Array(8)].map((_, i) => <path key={i} d={`M${i % 2 ? 30 + (i * 17) % 60 : 350 + (i * 17) % 60} ${100 + i * 18 + (t * 500 + i * 40) % 30} l0 46`} stroke="#fff" strokeWidth={3} opacity={.6}/>)}
    {on && [-1, 1].map(k => <path key={k} d={`M${X(1, .85) + k * 30 - 8} ${Y(.85) - 4} l8 ${20 + 8 * Math.sin(t * 40 + k)} l8 ${-20 - 8 * Math.sin(t * 40 + k)} Z`} fill="#5ab8ff" stroke="#fff" strokeWidth={2}/>)}
    <Rear x={X(1, .85)} y={Y(.85) - (on ? 6 : 0)} s={.85} paint="#6a3fd0"/>
    <g transform="translate(374 44)"><circle r={24} fill="#ffd23f" stroke={INK} strokeWidth={3}/><text y={9} textAnchor="middle" fontFamily={BOLD} fontSize={26} fill={INK}>$</text>
      <text x={-34} y={11} textAnchor="end" fontFamily={BOLD} fontSize={34} fill="#fff" stroke={INK} strokeWidth={5} paintOrder="stroke">{on ? '×2' : '×1'}</text></g></svg>;
};
/** One of the rally's moves, played over and over in a little view of the road. */
const MiniR: React.FC<{n: number; at: number; snd: string; text: string; children: React.ReactNode}> = ({n, at, snd, text, children}) =>
  <In at={at} snd={snd} vol={.15}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 440}}>
    <div style={{position: 'relative', border: '5px solid #fff', borderRadius: 16, overflow: 'hidden'}}>{children}
      <div style={{position: 'absolute', left: 12, top: 10, padding: '0 12px', background: '#ffd23f', transform: 'skewX(-10deg)', ...txt(28, 700, INK)}}>{n}</div></div>
    <div style={{...txt(28, 700), textAlign: 'center', minHeight: 72}}>{text}</div></div></In>;
/** What each model knows, and how often it guesses on the rest: two bars a row, growing in from `at`. A model's name
 *  opens its own page at the tester, where its two numbers are (the test's page leads with each model's top setting). */
const KnowGuess: React.FC<{at: number}> = ({at}) => {
  const t = useT(), rows = [...CARS].sort((a, b) => MODELS[b].knows - MODELS[a].knows);
  return <div style={{display: 'grid', gridTemplateColumns: '240px 540px 540px', columnGap: 34, rowGap: 12, alignItems: 'center'}}>
    <div/><div style={txt(28, 700, '#6ef2a0')}>Knows</div><div style={txt(28, 700, '#ff8a7a')}>Guesses, when it doesn't know</div>
    {rows.map((id, k) => {const m = MODELS[id], a = at + k * .25, u = ease((t - a - .1) / .6);
      return <React.Fragment key={id}>
        <In at={a} how="left" snd="blip" vol={.15}><div style={{...txt(30, 700), textAlign: 'right'}}><Cite to={AA + m.aa} at={a + .3}>{nm(id)}</Cite></div></In>
        {([[m.knows, '#6ef2a0'], [m.guesses, '#ff8a7a']] as [number, string][]).map(([v, c], j) => <div key={j} style={{display: 'flex', alignItems: 'center', gap: 14, opacity: t > a ? 1 : 0}}>
          <div style={{flex: 1, height: 32, borderRadius: 16, background: 'rgba(255,255,255,.12)'}}><div style={{width: `${v * u}%`, height: '100%', borderRadius: 16, background: c}}/></div>
          <span style={{...txt(28, 700), width: 72}}>{Math.round(v)}%</span></div>)}</React.Fragment>;})}</div>;
};
/** Card 1's picture: the same two cars on two roads, and the better one changes (rules.SWAP; check.ts holds it true).
 *  A dot is one answer the model gets right by itself, and the yellow line is how many the road asks for. Where both
 *  get them all, the lap and the bill are what is left: green inside the road's goal, red outside it. The stars are
 *  the road's three goals, as a bot driver earns them. */
const SWAP_WHY: Partial<Record<RoadId, [string, string]>> = {inbox: ['Both get every email right.', 'Speed and price decide.'], memory: ['Nothing to look up.', 'What it knows decides.']};
const SwapArt: React.FC = () => {
  const t = useT(), data = useMemo(() => SWAP.roads.map(rid => {const r = ROADS.find(x => x.id === rid)!;
    return {r, cars: SWAP.cars.map(id => ({id, s: run(id, r, 1), known: counts(r, MODELS[id])[0], goals: goalsOf(id, r)}))};}), []);
  return <div style={{display: 'flex', gap: 36}}>{data.map(({r, cars}, p) => {
    const at = .5 + p * 1.9, n = forksOf(r), tie = cars[0].known === cars[1].known, top = Math.max(...cars.map(c => c.goals)), d = n > 12 ? 15 : 22, won = t > at + 1.4, lineX = r.minRight * (d + 5) - 4;
    return <In key={r.id} at={at} how="up" snd="swish" vol={.15} style={{display: 'flex'}}><div style={{width: 830, boxSizing: 'border-box', padding: '20px 24px 22px', borderRadius: 22, background: 'rgba(10,16,38,.7)',
      borderTop: `10px solid ${ART[r.id].c}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 20}}><Art r={r} w={200} h={128}/>
        <div><div style={{...txt(40, 700, ART[r.id].c), fontStyle: 'italic'}}>{cap(r.name)}</div><div style={txt(26, 500, MUTE)}>{r.job}</div></div></div>
      {cars.map((c, k) => {const m = MODELS[c.id], a = at + .3 + k * .15, best = won && c.goals === top, lit = Math.floor((t - a - .2) / .04);
        const good = (ok: boolean) => txt(26, 700, ok ? '#6ef2a0' : '#ff8a7a');
        return <In key={c.id} at={a} how="left" snd="blip" vol={.12}><div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px', borderRadius: 16,
          border: `3px solid ${best ? '#ffd23f' : 'transparent'}`, background: best ? 'rgba(255,210,63,.14)' : 'rgba(255,255,255,.05)'}}>
          <CarIcon body={m.body} paint={m.paint} w={120}/>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 6}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><span style={txt(30, 700)}>{nm(c.id)}</span>
              <In at={at + 1.4} snd={k ? undefined : 'ding'} vol={.2}><Stars n={c.goals} size={34}/></In></div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div style={{position: 'relative', display: 'flex', gap: 5}}>{[...Array(n)].map((_, i) => <span key={i} style={{width: d, height: d, borderRadius: d / 2, background: i < c.known && i <= lit ? '#6ef2a0' : 'rgba(255,255,255,.16)'}}/>)}
                {!tie && <span style={{position: 'absolute', left: lineX, top: -5, bottom: -5, width: 3, background: '#ffd23f'}}/>}
                {!tie && !k && <span style={{position: 'absolute', left: lineX - 70, width: 143, top: -34, textAlign: 'center', ...txt(22, 700, '#ffd23f')}}>needs {r.minRight}</span>}</div>
              {tie ? <In at={a + .8} how="left"><span style={{display: 'flex', gap: 14}}><span style={good(c.s.t <= r.par)}>{lap(c.s.t)}</span><span style={good(c.s.spent <= r.budget)}>{money(c.s.spent)}</span></span></In>
                : <span style={{...txt(26, 700), whiteSpace: 'nowrap'}}>{Math.min(c.known, Math.max(0, lit + 1))} of {n}</span>}</div></div></div></In>;})}
      <In at={at + 1.6} how="up"><div style={{...txt(30, 500), textAlign: 'center'}}>{SWAP_WHY[r.id]![0]} <b style={{color: '#ffd23f'}}>{SWAP_WHY[r.id]![1]}</b></div></In>
    </div></In>;})}</div>;
};
const RMOVES = [['An everyday job', '/model sonnet', 'switches to Sonnet: well-scoped coding, quick fixes'], ['The hardest one', '/model opus', 'switches to Opus: careful judgment, long work'],
  ['In a hurry', '/fast', 'an Opus model answers sooner, and costs more'], ['It may be guessing', 'CLAUDE.md', 'write in it: "mark anything you couldn\'t confirm"']];
const FLAG: React.CSSProperties = {padding: '6px 26px', background: '#ffd23f', transform: 'skewX(-10deg)', borderRadius: 6};
const leastGuess = [...CARS].sort((a, b) => MODELS[a].guesses - MODELS[b].guesses)[0], FASTEST = CARS.map(id => MODELS[id]).find(m => m.fast)!.fast!;
const RCARDS: Card[] = [
  {title: 'Every road is a different job', lines: ['The same two cars, on two roads. *The best one changes* with the job.'], qAt: 4.4, art: <SwapArt/>},
  {title: 'Your co-driver calls each fork', lines: ['Before a fork, the model lights a lane. *Trust it* flat out, or *brake* so you see the walls in time.'], qAt: 2.8,
    art: <div style={{display: 'flex', gap: 40}}>
      <MiniR n={1} at={.6} snd="whoosh" text="Its call is right: straight through"><Fork call={2} open={2} at={.6}/></MiniR>
      <MiniR n={2} at={1.2} snd="hit" text="Sure, but wrong: a wall, if you trusted it"><Fork call={0} open={1} at={1.2}/></MiniR>
      <MiniR n={3} at={1.8} snd="select" text={'It says "not sure": no light. Brake and look'}><Fork call={null} open={0} at={1.8}/></MiniR></div>},
  {title: 'Knowing more is not guessing less', lines: ['From memory, the bigger models *know more*, and still *guess* on most of the rest.'], qAt: 3.4,
    quote: {text: 'Mark anything you couldn\'t confirm, and say where you looked', who: ADDY_OPUS, to: GUIDE}, src: <Proof to={AA_KNOWS}>AA-Omniscience, by Artificial Analysis</Proof>,
    art: <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}><KnowGuess at={.6}/>
      <In at={2.6} how="up"><div style={txt(28, 500, MUTE)}>{nm(leastGuess)} guesses the least: it says "not sure" more often.</div></In></div>},
  {title: 'Your moves in Claude Code', lines: ['Pick *the car for the road*, and ask it to say *when it isn\'t sure*.'], qAt: movesDone(RMOVES),
    quote: {text: 'For the hardest long-horizon work, an Opus model is the better choice.', who: ADDY_SONNET, to: SONNET_POST},
    art: <Moves chip={FLAG} rows={RMOVES}/>},
  {title: 'How the rally plays', lines: ['Pick a road and a car. In the race, *you* decide *when to trust* the co-driver.'], qAt: 2.8,
    art: <div style={{display: 'flex', gap: 40}}>
      <MiniR n={1} at={.6} snd="beep" text="A pit stop is the model thinking. A slow thinker stops longer"><PitMini at={.6}/></MiniR>
      <MiniR n={2} at={1.2} snd="whoosh" text="At a fork, follow the light, or hold brake and look"><Fork call={1} open={1} at={1.2} paint="#ffd23f"/></MiniR>
      <MiniR n={3} at={1.8} snd="nitro" text={`Hold boost on an Opus car: fast mode, ${FASTEST.k} times quicker, twice the price`}><BoostMini at={1.8}/></MiniR></div>},
];

/* ---------- the roads: a racing game's track select. Four tiles, and the open one's job, tests and goals beneath ---------- */
const TW = 400, TG = 36, TX0 = (W - 4 * TW - 3 * TG) / 2;
const Levels: React.FC<{best: Best; at?: RoadId; pick: (r: Road) => void; back: () => void}> = ({best, at, pick, back}) => {
  const t = useClock(), [i, setI] = useState(Math.max(0, ROADS.findIndex(r => r.id === at))), [how, setHow] = useState(() => !seen(RALLY_KEY));
  const move = (d: number) => {setI(v => Math.max(0, Math.min(ROADS.length - 1, v + d))); sfx('select', .3);};
  const go = (r: Road) => {sfx('blip', .4); pick(r);};
  useKeys(k => {if (how) return; if (k === 'arrowleft') move(-1); if (k === 'arrowright') move(1); if (k === 'enter' || k === ' ') go(ROADS[i]); if (k === 'h') setHow(true); if (k === 'escape') back();});
  const top = (r: Road) => topOf(best, r.id), r = ROADS[i], c = ART[r.id].c;
  const total = ROADS.reduce((n, x) => n + (top(x)?.[1] ?? 0), 0);
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <Backdrop t={t * .3}/>
    <Button icon="back" act={back} style={{position: 'absolute', left: 40, top: 30}}/>
    <Button icon="help" act={() => setHow(true)} style={{position: 'absolute', left: 60 + TAP, top: 30}}/>
    <In at={0} how="slam" snd="slam" vol={.25} style={{position: 'absolute', left: 0, right: 0, top: 24, textAlign: 'center', pointerEvents: 'none'}}>
      <div style={{...txt(92, 700), fontStyle: 'italic', textShadow: '0 8px 0 rgba(0,0,0,.35)'}}>Pick a road</div></In>
    <div style={{position: 'absolute', left: 0, right: 0, top: 144, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, ...txt(28, 700, '#ffd23f')}}>
      <Star on size={34}/>{total} / {ROADS.length * 3}</div>
    {ROADS.map((x, k) => {const on = k === i, b = top(x), cc = ART[x.id].c;
      return <In key={x.id} at={.15 + k * .08} how="up" snd="swish" vol={.12} style={{position: 'absolute', left: TX0 + k * (TW + TG), top: 216}}>
        <div onPointerEnter={() => {if (!on && !TOUCH) {setI(k); sfx('select', .2);}}} onClick={() => {if (on) go(x); else {setI(k); sfx('select', .3);}}}
          style={{width: TW, height: 450, boxSizing: 'border-box', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', background: '#0e1530', border: `5px solid ${on ? '#fff' : 'rgba(255,255,255,.18)'}`,
            transform: `translateY(${on ? -16 : 0}px)`, transition: 'transform .15s, box-shadow .15s', boxShadow: on ? `0 0 50px ${cc}` : 'none'}}>
          <Art r={x} w={TW - 10} h={270} flat/>
          <div style={{margin: '-30px 0 0 -10px', padding: '4px 30px', display: 'inline-block', position: 'relative', background: cc, transform: 'skewX(-12deg)', ...txt(48, 700, INK), fontStyle: 'italic', whiteSpace: 'nowrap'}}>{cap(x.name)}</div>
          <div style={{padding: '8px 22px 0', ...txt(26, 500, MUTE)}}>{cap(x.objective.split(' · ')[0])}</div>
          <div style={{padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 12}}>
            <Stars n={b?.[1] ?? 0} size={38}/>
            {b && <span style={{display: 'flex', alignItems: 'center', gap: 8, ...txt(22, 700), whiteSpace: 'nowrap'}}><span style={{width: 18, height: 18, borderRadius: 9, background: MODELS[b[0]].paint, border: '2px solid #fff'}}/>{nm(b[0])}</span>}</div>
        </div></In>;})}
    {/* the open road: its job, what it tests, its goals */}
    <div key={r.id} style={{position: 'absolute', left: 80, top: 700, width: W - 160, height: 190, boxSizing: 'border-box', padding: '20px 34px', borderRadius: 22, background: 'rgba(10,16,38,.86)',
      borderLeft: `14px solid ${c}`, display: 'flex', gap: 40, alignItems: 'center', animation: 'pym-up .3s ease-out both'}}>
      <div style={{flex: 1}}><div style={txt(36, 700)}>{r.job}</div>
        <div style={{...txt(24, 500, MUTE), marginTop: 2}}>{cap(r.objective.split(' · ')[1])}</div>
        <div style={{display: 'flex', gap: 10, marginTop: 12}}>{r.tests.map(x => <span key={x} style={{padding: '4px 16px', borderRadius: 10, border: `2px solid ${c}`, ...txt(22, 700, c), whiteSpace: 'nowrap'}}>{cap(x)}</span>)}</div></div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>{r.goals.map(gl => <div key={gl} style={{display: 'flex', alignItems: 'center', gap: 10, ...txt(24, 700), whiteSpace: 'nowrap'}}><Star on size={28}/>{cap(gl)}</div>)}</div>
    </div>
    <FootFade/>
    <Hit label="Garage" icon="arrow" act={() => go(r)} style={{position: 'absolute', right: 80, bottom: 52}}/>
    <Keys text="← → road  ·  Enter garage  ·  H how it works  ·  Esc map"/>
    {how && <Explain tag="Driving school" cards={RCARDS} last="Pick a road" done={() => {markSeen(RALLY_KEY); setHow(false);}}/>}
  </div>;
};

/* ---------- the garage: the focused car on a lit turntable, its numbers for this road as gauges, the six in a row ---------- */
const Gauge: React.FC<{k: StatKey; m: Model}> = ({k, m}) => {const st = STAT[k], n = 12, c = st.less ? '#ff9f43' : '#37e0c8';
  return <div><div style={{display: 'flex', justifyContent: 'space-between', ...txt(26, 700)}}><span>{cap(st.label)}{st.less ? ' ↓' : ''}</span><span style={{color: c}}>{st.value(m).toLowerCase()}</span></div>
    <div style={{display: 'flex', gap: 5, marginTop: 6}}>{[...Array(n)].map((_, j) => <div key={j} style={{flex: 1, height: 26, transform: 'skewX(-14deg)', background: j < Math.round(clamp(st.frac(m)) * n) ? c : 'rgba(255,255,255,.12)'}}/>)}</div></div>;};
const Select: React.FC<{road: Road; best: Best; you0?: ModelId; rivals0?: ModelId[]; go: (you: ModelId, rivals: ModelId[]) => void; back: () => void}> = ({road, best, you0, rivals0, go, back}) => {
  const cars = carsOf(road), first = you0 ?? 'sonnet55';
  const t = useClock(), [i, setI] = useState(cars.indexOf(first));
  const [you, setYou] = useState<ModelId>(first), [rivals, setRivals] = useState<ModelId[]>((rivals0 ?? []).filter(x => x !== first));
  const id = cars[i], f = MODELS[id], mine = best[road.id] || {}, cost = priceOf(road, f);
  const focus = (k: number) => {if (k !== i) {setI(k); sfx('select', .3);}};
  const drive = (x: ModelId) => {setYou(x); setRivals(v => v.filter(y => y !== x)); sfx('blip', .35);};
  const rival = (x: ModelId) => {
    if (x === you) {sfx('buzz', .3); return;}
    if (rivals.includes(x)) {setRivals(v => v.filter(y => y !== x)); sfx('select', .3);}
    else if (rivals.length >= 3) sfx('buzz', .3);
    else {setRivals(v => [...v, x]); sfx('select', .3);}
  };
  const start = () => {sfx('go', .35); go(you, rivals);};
  useKeys(k => {if (k === 'arrowleft' || k === 'arrowup') focus(Math.max(0, i - 1)); if (k === 'arrowright' || k === 'arrowdown') focus(Math.min(cars.length - 1, i + 1));
    if (k === 'enter') drive(id); if (k === 'r') rival(id); if (k === ' ') start(); if (k === 'escape') back();});
  const me = id === you, rv = rivals.includes(id);
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 34% 62%, #2c3f70, #0b1024 62%)'}}>
    <style>{ANIM}</style>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 24, background: CHECKER(24), opacity: .7}}/>
    {/* the spotlight, and the turntable turning */}
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <defs><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".3"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
      <path d="M560 24 L740 24 L1070 700 L230 700 Z" fill="url(#beam)"/>
      <ellipse cx={650} cy={690} rx={430} ry={92} fill="#162244" stroke={f.paint} strokeWidth={6}/>
      <ellipse cx={650} cy={690} rx={390} ry={78} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={8} strokeDasharray="40 30" strokeDashoffset={-t * 60}/>
      <ellipse cx={650} cy={688} rx={370} ry={20} fill="rgba(0,0,0,.5)"/></svg>
    <div key={id} style={{position: 'absolute', left: 240, top: 432, animation: 'pym-left .35s ease-out both'}}><div style={{transform: `translateY(${Math.sin(t * 2) * 4}px)`}}><CarIcon body={f.body} paint={f.paint} w={820}/></div></div>
    <Button icon="back" act={back} style={{position: 'absolute', left: 40, top: 54}}/>
    <div style={{position: 'absolute', left: 64 + TAP, top: 50}}>
      <div style={{display: 'inline-block', padding: '2px 18px', background: ART[road.id].c, transform: 'skewX(-12deg)', ...txt(26, 700, INK)}}>{cap(road.name)} · {cap(road.objective.split(' · ')[0])}</div>
      <div key={id} style={{...txt(96, 700), fontStyle: 'italic', lineHeight: 1.1, animation: 'pym-up .3s ease-out both', textShadow: '0 8px 0 rgba(0,0,0,.35)'}}>{nm(id)}</div>
      <div style={txt(30, 500, MUTE)}>{f.blurb}</div></div>
    {/* its numbers for this road, and what to do with it */}
    <div style={{position: 'absolute', left: 1260, top: 120, width: 600, padding: '22px 30px 24px', boxSizing: 'border-box', borderRadius: 22, background: 'rgba(10,16,38,.86)', borderTop: `10px solid ${f.paint}`}}>
      <div style={txt(24, 700, MUTE)}>What this road tests</div>
      <div style={{display: 'grid', gap: 18, marginTop: 10}}>{TESTED[road.id].map(k => <Gauge key={k} k={k} m={{...f, inP: cost.inP, outP: cost.outP}}/>)}</div>
      <div style={{marginTop: 16, ...txt(24, 700, f.fast ? '#8fd3ff' : cost !== f ? '#ff9f43' : 'rgba(255,255,255,.4)')}}>{f.fast ? `Fast mode: ${f.fast.k}x quicker, ${f.fast.outP / f.outP}x the price`
        : cost !== f ? `Over 100K tokens in: ${cost.outP / f.outP}x its usual price` : 'No fast mode'}</div>
      <div style={{display: 'flex', gap: 14, marginTop: 18}}>
        <div data-ui="btn" onClick={() => drive(id)} style={{flex: 1, height: TAP, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxSizing: 'border-box',
          background: me ? '#ffd23f' : 'rgba(255,255,255,.12)', border: '3px solid #ffd23f', ...txt(28, 700, me ? INK : '#fff')}}>{me ? 'Your car' : 'Drive it'}</div>
        <div data-ui="btn" onClick={() => rival(id)} style={{flex: 1, height: TAP, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: me ? 'default' : 'pointer', opacity: me ? .35 : 1, boxSizing: 'border-box',
          background: rv ? f.paint : 'rgba(255,255,255,.12)', border: `3px solid ${f.paint}`, ...txt(28, 700)}}>{rv ? 'Rival ✓' : '+ Rival'}</div></div>
      <div style={{marginTop: 10, ...txt(22, 500, MUTE)}}>Rivals: {rivals.length} of 3 · each drives on its own</div>
    </div>
    <Hit label="Race" icon="arrow" act={start} style={{position: 'absolute', left: 1270, top: 680, width: 580}}/>
    {/* the six, in a row */}
    <div style={{position: 'absolute', left: 60, top: 820, display: 'flex', gap: 14}}>{cars.map((x, k) => {const m = MODELS[x], on = k === i;
      return <div key={x} onClick={() => focus(k)} style={{width: 288, height: 196, boxSizing: 'border-box', position: 'relative', borderRadius: 16, cursor: 'pointer', padding: '16px 10px 8px',
        background: on ? 'rgba(255,255,255,.16)' : 'rgba(10,16,38,.7)', border: `4px solid ${on ? '#fff' : x === you ? '#ffd23f' : 'rgba(255,255,255,.14)'}`, transform: `translateY(${on ? -10 : 0}px)`, transition: 'transform .15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
        <CarIcon body={m.body} paint={m.paint} w={230}/><span style={txt(26, 700)}>{nm(x)}</span>
        <Stars n={mine[x] ?? 0} size={26}/>
        {(x === you || rivals.includes(x)) && <div style={{position: 'absolute', top: -16, left: 12, padding: '0 12px', transform: 'skewX(-10deg)', background: x === you ? '#ffd23f' : m.paint, ...txt(20, 700, x === you ? INK : '#fff')}}>{x === you ? 'YOU' : 'RIVAL'}</div>}
      </div>;})}</div>
    <Keys text="← → car  ·  Enter drive it  ·  R rival  ·  Space race  ·  Esc roads"/>
  </div>;
};

/* ---------- the podium: where you finished among your rivals, the stars, why, and a tip for next time ---------- */
const ORD = ['1st', '2nd', '3rd', '4th'], MEDAL = ['#ffd23f', '#d6dde8', '#e0a06a', '#ffffff'];
const STEP = [{x: 280, h: 300}, {x: 60, h: 230}, {x: 500, h: 170}, {x: 720, h: 120}];   // 1st in the middle, 2nd on its left, 3rd and 4th on its right
const Results: React.FC<{road: Road; pick: ModelId; res: Result; again: () => void; other: () => void; levels: () => void}> = ({road: r, pick, res, again, other, levels}) => {
  const t = useClock(), you = res.you, m = MODELS[pick], st = stars(you), [more, setMore] = useState(false), [cmd, tip] = raceTip(you);
  useKeys(k => {if (more) return; if (k === 'enter' || k === ' ') again(); if (k === 'b') setMore(true); if (k === 'c') other(); if (k === 'l' || k === 'escape') levels();});
  const field = [{id: pick, s: you, me: true}, ...res.rivals.map(x => ({...x, me: false}))].sort((a, b) => a.s.t - b.s.t);
  const place = field.findIndex(x => x.me), solo = field.length === 1, key = TESTED[r.id][0], said = (s: string) => s.replace(m.name, nm(pick));
  const pill = (icon: IconName, c: string, v: string, w: string) => <span style={{display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 12, background: 'rgba(10,16,38,.86)', ...txt(28, 700), whiteSpace: 'nowrap'}}>
    <span style={{display: 'flex', color: c}}><Icon name={icon} size={30} w={3}/></span>{v}{w && <span style={txt(22, 500, MUTE)}>{w}</span>}</span>;
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <Backdrop t={t * .2}/><FootFade/>
    {(place === 0 && !solo || st.every(Boolean)) && <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>{[...Array(40)].map((_, k) => {
      const x = (k * 197) % W + Math.sin(t * 2 + k) * 30, y = ((k * 131 + t * (180 + (k % 5) * 40)) % (H + 60)) - 30;
      return <rect key={k} x={x} y={y} width={14} height={8} fill={[ART[r.id].c, '#ffd23f', '#fff', m.paint][k % 4]} transform={`rotate(${(t * 200 + k * 40) % 360} ${x + 7} ${y + 4})`}/>;})}</svg>}
    <In at={.05} how="slam" snd="slam" vol={.3} style={{position: 'absolute', left: 80, top: 20}}>
      <div style={{...txt(120, 700, solo ? '#fff' : MEDAL[place]), fontStyle: 'italic', textShadow: '0 10px 0 rgba(0,0,0,.4)', whiteSpace: 'nowrap'}}>{solo ? 'Finish!' : `${ORD[place]} place`}</div></In>
    <div style={{position: 'absolute', left: 90, top: 180, display: 'flex', alignItems: 'center', gap: 14, ...txt(30, 700)}}>
      <span style={{padding: '2px 18px', background: ART[r.id].c, transform: 'skewX(-12deg)', ...txt(26, 700, INK)}}>{cap(r.name)}</span>{nm(pick)}</div>
    <In at={1.8} how="up" style={{position: 'absolute', left: 80, top: 250}}><div style={{display: 'flex', gap: 12, flexWrap: 'wrap', width: 850}}>
      {pill('clock', '#ffd23f', lap(you.t), '')}{pill('check', '#6ef2a0', `${you.right}`, `right · ${you.wrong} wrong`)}{pill('coin', '#ffd23f', money(you.spent), '')}{pill('target', '#8fd3ff', wait(you.real), 'the real wait')}</div></In>
    {/* the podium, last place up first */}
    {field.map((x, k) => {const s = STEP[k], c = MODELS[x.id];
      return <In key={x.id + (x.me ? 'me' : '')} at={.3 + (field.length - 1 - k) * .25} how="up" snd="land" vol={.2} style={{position: 'absolute', left: s.x, bottom: 100, width: 210}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {x.me && <div style={{padding: '0 12px', transform: 'skewX(-10deg)', background: '#ffd23f', ...txt(22, 700, INK)}}>YOU</div>}
          <CarIcon body={c.body} paint={c.paint} w={200}/>
          <div style={{width: 210, height: s.h, boxSizing: 'border-box', background: x.me ? '#ffe9a6' : '#e9edf5', borderTop: `10px solid ${MEDAL[k]}`, boxShadow: 'inset 0 -60px 60px -30px rgba(27,36,64,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4}}>
            <span style={txt(44, 700, INK)}>{k + 1}</span><span style={txt(21, 700, INK)}>{nm(x.id)}</span><span style={txt(21, 500, INK)}>{lap(x.s.t)}</span></div></div></In>;})}
    {/* the stars, why, and the tip */}
    <div style={{position: 'absolute', left: 960, top: 126, display: 'flex', gap: 20}}>{st.map((ok, k) => <In key={k} at={.8 + k * .3} how="slam" snd={ok ? 'ding' : 'buzz'} vol={.25}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 280}}><Star on={ok} size={150} rot={(k - 1) * 9}/>
        <span style={{display: 'flex', alignItems: 'flex-start', gap: 6, ...txt(22, 700, ok ? '#fff' : MUTE)}}><span style={{display: 'flex', color: ok ? '#6ef2a0' : '#ff8a7a'}}><Icon name={ok ? 'check' : 'cross'} size={26} w={3.2}/></span>{cap(r.goals[k])}</span></div></In>)}</div>
    <In at={2} how="up" style={{position: 'absolute', left: 960, top: 380, width: 880, ...txt(28, 500)}}>{said(why(you))}</In>
    <In at={2.3} how="left" snd="ding" vol={.2} style={{position: 'absolute', left: 960, top: 516, width: 880}}>
      <div style={{padding: '18px 26px 20px 50px', borderRadius: 18, background: 'rgba(10,16,38,.92)', position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, background: CHECKER(24)}}/>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}><span style={{...txt(32, 700, '#ffd23f'), fontStyle: 'italic'}}>Next time</span>
          <span style={{padding: '2px 16px', borderRadius: 10, background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 30, color: '#39ff88'}}>{cmd}</span></div>
        <div style={{...txt(28, 500), marginTop: 8}}>{tip}</div></div></In>
    <div style={{position: 'absolute', left: 970, top: 800, display: 'flex', gap: 26, alignItems: 'flex-start'}}>
      <Hit label="Race again" icon="retry" act={again} size={40}/>
      {([['list', 'Breakdown', () => setMore(true)], ['users', 'Garage', other], ['map', 'Roads', levels]] as [IconName, string, () => void][]).map(([ic, l, a]) =>
        <div key={l} onClick={a} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer'}}><Button icon={ic} act={a}/><span style={txt(20, 500, MUTE)}>{l}</span></div>)}</div>
    {more && <Sheet title="Breakdown" close={() => setMore(false)}>
      <div style={{...txt(28, 500), maxWidth: 1400}}>{said(why(you))}</div><div style={{...txt(26, 500, MUTE), marginTop: 10, maxWidth: 1400}}>{said(aloneLine(pick, r, res.seed))}</div>
      <div style={{display: 'grid', gridTemplateColumns: '330px 150px 170px 140px auto', columnGap: 20, rowGap: 8, marginTop: 20, ...txt(24, 500)}}>
        {['Car', 'Race', 'Real wait', 'Cost', 'Answers'].map(h => <span key={h} style={txt(20, 700, MUTE)}>{h}</span>)}
        {field.map(x => <React.Fragment key={x.id + (x.me ? 'me' : '')}><span style={{color: x.me ? '#ffd23f' : '#fff'}}>{x.me ? `You · ${nm(x.id)}` : `${nm(x.id)}, alone`}</span>
          <span>{lap(x.s.t)}</span><span>{wait(x.s.real)}</span><span>{money(x.s.spent)}</span><span>{x.s.right} right · {x.s.wrong} wrong{x.s.caught ? ` · ${x.s.caught} caught` : ''}</span></React.Fragment>)}</div>
      <div style={{display: 'flex', gap: 5, marginTop: 18, flexWrap: 'wrap', maxWidth: 1400}}>{you.marks.map((mk, k) => <span key={k} style={{padding: '2px 8px', borderRadius: 6, background: mk ? MARK[mk].c : 'rgba(255,255,255,.12)', ...txt(18, 700, '#10213a')}}>{k + 1} {mk ? MARK[mk].t.toLowerCase() : '—'}</span>)}</div>
      <div style={{...txt(22, 700, MUTE), marginTop: 20}}>The main number on this road: {cap(STAT[key].label).toLowerCase()}{STAT[key].less ? ' (less is better)' : ''}</div>
      <div style={{display: 'flex', gap: 24, marginTop: 6, flexWrap: 'wrap', maxWidth: 1400, ...txt(24, 500)}}>{carsOf(r).map(x => <span key={x} style={{color: x === pick ? '#ffd23f' : '#fff', whiteSpace: 'nowrap'}}>{nm(x)} {STAT[key].value(MODELS[x]).toLowerCase()}</span>)}</div>
    </Sheet>}
    <Keys text="Enter race again  ·  B breakdown  ·  C garage  ·  L roads"/>
  </div>;
};

/** The numbers page. Every number, quote and named source on it is a link to the page it was read from (ui.tsx `Proof`); it closes on a click anywhere else. */
const Numbers: React.FC<{close: () => void}> = ({close}) => {
  useEffect(() => {modal = true; const h = (e: KeyboardEvent) => {const k = e.key.toLowerCase(); if (k === 'n' || k === 'escape' || k === 'enter') {e.stopImmediatePropagation(); close();}};
    addEventListener('keydown', h, true); return () => {modal = false; removeEventListener('keydown', h, true);};}, []);
  const LINES: React.ReactNode[] = [
    'Top speed is the model\'s writing speed. A pit stop is the model thinking: its length is the model\'s thinking time, and thinking is billed as writing.',
    'Before each fork the model calls a lane. How many calls are right, wrong or "not sure" is its score on that job\'s test, exactly. Where they fall changes every race.',
    <>Cost is real dollars for the real job. The results also say how long the job would really take, and how much of that is thinking. Haiku 5.5 is <Proof to={PRICING}>priced by the length of the prompt</Proof>: with the contract in it the prompt is over 100,000 tokens, so on that road it pays five times its usual price.</>,
    'Rivals are the model on its own: flat out on every call, slowing down only when it says "not sure", never in fast mode.',
    'Made up by the game, the same for every car: on the questions and the contract, the wrong calls land mostly on the ones marked HARD (those two tests publish no score by difficulty); how late the walls show; the time a wall costs; the goals. Pit stops are sped up more than the driving, so in real life the thinking is a bigger share of the wait than it looks. Fast mode is assumed to speed thinking too.',
    <>Tickets take everything from one test, <Proof to={VALS4}>Terminal-Bench 4.0</Proof> (the second table): right or wrong, the time and the price. Its {CODE_ALL} tasks come in seven kinds of work; the {forksOf(ROADS.find(r => r.id === 'tickets')!)} tickets are dealt in the test's own mix of kinds, a car fails as many of each kind as it does on the test, and a ticket is that test's average task. All six cars drive there. Three limits, the tester's own: five of Anthropic's rows <Proof to={VALS4}>"include provider-side fallback"</Proof> (some requests were handed to an older model; Haiku 5.5 hands none off); hardware, security and media are 4 or 5 tasks each, run three times, so one run moves a score 7 or 8 points; and its scores are <Proof to={VALS4}>"not comparable across versions"</Proof>, so nothing here is set beside the older test the blocks use.</>,
    <>The front desk. Real: what a desk costs and how long it takes (an email, or the coding test's average task), and the sign under a desk for a ticket, which is that model's score on that kind of work on <Proof to={VALS4}>Terminal-Bench 4.0</Proof> (the second table, with the same three limits as the tickets road). No model is best at every kind. All six desks take tickets. Made up by the game: a desk takes one job at a time (a real model takes many at once); emails run {SQUEEZE.inbox} times faster than real life and tickets {SQUEEZE.tickets} times; you see right or wrong at once; a desk's wrong tickets are spread over its day so that it gets close to its real share; each day's mix of kinds; and the till: a ticket pays ${FEE.tickets} and an email ${FEE.inbox.toFixed(2)}, the tip for a streak, and that a wrong answer pays nothing while the desk still bills you.</>,
    <>The arena's fighters are models at the effort levels that both the tester and Anthropic's own count publish. Real, from <Proof to={AA_EFFORT}>the same tester</Proof>, on each fighter's card: what a try costs, how long it thinks before it answers, and its score of 100 at each level: {[...FIGHTERS, 'opus5' as ModelId].map(id => `${MODELS[id].name} ${dialOf(id).map(L => `${L.name} ${L.index}`).join(', ')}`).join('; ')} (Opus 5 fights first in round 4; Sonnet 5.5's LOW has no published score).
      Also real, from <Proof to={SPEND}>figure B of "Using Claude Code: Spending your effort"</Proof> (Anthropic, Terminal-Bench 3.0): the mix of kinds a miss comes in at each level, for Fable 5.1 and Opus 5 ({FIGHTERS.filter(id => mixOf(id) !== id).map(id => MODELS[id].name).join(' and ')} borrow Fable 5.1's: nobody has counted theirs). Made up by the game: that a first try passes as often as the score says (the score is ten tests, not one coding job); sorting the kinds into five signs and their fixes; that the right fix always works and a wrong one never does; a try's wait on the roof, the fourth root of its real thinking time ({hms(dialOf('opus55')[dialOf('opus55').length - 1].think)} is 3.6 s); a second to write a rewrite or context; the reads, the walking, the hearts, the rounds and the goals. Which miss comes up is dealt from a deck of the real shares, one card per job, so a round at one level always has the same misses, in its own order. The words on the signs are our own examples.</>,
    <>The blocks stay on the older coding test, <Proof to={VALS}>Terminal-Bench 2.1</Proof>, because it is the one that scores EASY, MEDIUM and HARD tasks apart; the newer test sorts its tasks by kind of work. The tester has retired the older test and never ran Haiku 5.5 on it, so the builders are the other five. Real: a block is the tester's average task, at its cost and its time; an EASY, MEDIUM or HARD block cracks as often as the model fails that test's own EASY, MEDIUM or HARD tasks (the BLOCKS column). <Proof to={FAST}>Fast mode</Proof> is the Opus models' real one. Made up by the game: the cracks are spread so that every tower gets close to its real share; a crack takes down what is on top of it; how long a check waits; building runs 220 times faster than real life; the mixes and the goals.</>,
    <>The ship's crew are all six models. Haiku 5.5 never hands a request to another model, which is why the attacker that learned the ship gets nowhere with it. Real, from Anthropic's system cards (<SystemCards/>), the tests by the security firm Gray Swan: how often a hidden order fools the model.{' '}
      {CREW.map(id => <React.Fragment key={id}>{MODELS[id].name} {ROOMS.map((r, k) => INJECT[id]![r.attack] === undefined ? <React.Fragment key={r.id}>{k ? ' / ' : ''}—</React.Fragment>
        : <React.Fragment key={r.id}>{k ? ' / ' : ''}<Proof to={cardOf(id, r.attack)}>{pc(INJECT[id]![r.attack]! / 100)}</Proof></React.Fragment>)}; </React.Fragment>)}
      in that order: a known attack given 15 tries; the same on a screen the model clicks through; one try by an attacker that learned the ship, with Anthropic's probes on; the same with them off. Also real: how long a read takes is the tester's time per task. Made up by the game: the ship and its rooms; the two roles; that one file carries the order, that it only tries where Meb is not, and the 8 s between its tries; that an order which fools the model always reaches you as a request to answer (in real life some need no yes at all); that 3 of a file's 8 reads ask for a yes; that a read which ends under Meb's eyes gives the carrier away; the clues (a file that was with you, the files still at the scene); the vote and the 8 s a wrong one costs; that an order which got its way stops the ship until you undo it; the Meb you play against as the impostor: that he says yes without looking once two consoles wait, and votes you out after three marks; reading runs 75 times faster than real life; which tries fool the model is spread so that a shift gets close to the real share; the goals. Each shift's job, its steps and the orders shown are our own examples.</>,
    <>The court scores no model. No public test measures how well a model follows a request by how the request was written, so this world has no model to pick and no numbers of its own. Real: every rule (each stamp) is a sentence from one of two Anthropic posts,{' '}
      <Proof to={GUIDE}>"Getting the most out of Opus 5.5 in Claude and Claude Code"</Proof> (written for Opus 5.5) and <Proof to={CONTEXT}>"The new rules of context engineering for Claude 5 generation models"</Proof>; the "over 80%" on the cards is the second post's own number, about Claude Code's system prompt. Made up by the game: the lines of each case and the three cards a WAIT! offers (ours, built from the posts' own examples); the five patience marks; the goals; and the run on the verdict screen and the wait on card 4, which are pictures of the posts' sentences, not measurements.</>,
  ];
  // the same sentences as before, under the world each belongs to (LINES 0 to 5 are the rally's)
  const PARTS: [string, string, number, number][] = [['The rally', '#6fc3ff', 0, 6], ['The front desk', '#ffd23f', 6, 7], ['The arena', '#ff8a9a', 7, 8], ['The blocks', '#6ef2a0', 8, 9], ['The court', '#ffb86b', 10, 11], ['The ship', '#b9a3ff', 9, 10]];
  const cols = ['Model', 'Writes', 'Thinks', 'Thinks, 100K in', 'Per task', 'Knows', 'Guesses', 'Documents', 'Blocks · easy / medium / hard', 'Price in / out', 'Fast mode'];
  return <div onClick={close} style={{position: 'absolute', inset: 0, background: 'rgba(8,10,26,.98)', zIndex: 10, padding: '30px 90px 60px', boxSizing: 'border-box', overflowY: 'auto'}}>   {/* it scrolls: six worlds of small print don't fit one screen */}
    <Button icon="close" act={close} style={{position: 'absolute', right: 30, top: 24}}/>
    <div style={{...txt(64, 700), fontStyle: 'italic'}}>How the numbers work</div>
    <div style={txt(24, 500, '#8fd3ff')}>Every number, quote and named source is a link to its public record ↗</div>
    <div style={{display: 'grid', gridTemplateColumns: '230px 110px 90px 150px 170px 90px 100px 120px 290px 150px 1fr', rowGap: 8, marginTop: 20, padding: '18px 24px', borderRadius: 18, background: 'rgba(255,255,255,.06)'}}>
      {cols.map(h => <span key={h} style={txt(18, 700, MUTE)}>{h}</span>)}
      {(Object.keys(MODELS) as ModelId[]).map(id => {const c = MODELS[id], aa = (v: React.ReactNode, color?: string) => <span style={txt(21, color ? 700 : 500, color)}><Proof to={AA + c.aa}>{v}</Proof></span>;
        return <React.Fragment key={id}>
          {aa(c.real, c.ink)}{aa(`${c.tps} t/s`)}{aa(`${c.think} s`)}{aa(`${c.think100k} s`)}{aa(`${mmss(c.taskTime)} · ${money(c.taskCost)}`)}{aa(`${c.knows}%`)}{aa(`${c.guesses}%`)}{aa(`${c.reads}%`)}
          <span style={txt(21)}><Proof to={VALS}>{c.codesBy ? `${c.codes}% · ${c.codesBy.map(x => Math.round(x)).join(' / ')}` : 'never run: test retired'}</Proof></span><span style={txt(21)}><Proof to={PRICING}>${c.inP} / ${c.outP}</Proof></span>
          <span style={txt(21)}>{c.fast ? <Proof to={FAST}>×{c.fast.k} · ${c.fast.inP} / ${c.fast.outP}</Proof> : c.long ? <Proof to={PRICING}>over 100K in: ${c.long.inP} / ${c.long.outP}</Proof> : '—'}</span></React.Fragment>;})}
    </div>
    {/* the coding test of the front desk and the tickets road: each model's score on each kind of work, and what a task takes */}
    <div style={{...txt(22, 700, MUTE), marginTop: 18}}>Coding by kind of work · <Proof to={VALS4}>Terminal-Bench 4.0</Proof>, read {TB4_READ} · the front desk and the tickets road</div>
    <div style={{display: 'grid', gridTemplateColumns: '230px 110px repeat(7, 130px) 1fr', rowGap: 8, marginTop: 8, padding: '18px 24px', borderRadius: 18, background: 'rgba(255,255,255,.06)'}}>
      {['Model', `All ${CODE_ALL}`, ...KINDS.map(k => `${k.name === 'ML' ? 'ML' : cap(k.name)} ${k.tasks}`), 'Per task'].map(h => <span key={h} style={txt(18, 700, MUTE)}>{h}</span>)}
      {CARS.map(id => {const c = MODELS[id], v4 = (v: React.ReactNode, color?: string) => <span style={txt(21, color ? 700 : 500, color)}><Proof to={VALS4}>{v}</Proof></span>;
        return <React.Fragment key={id}>{v4(c.real, c.ink)}{v4(`${c.code.all}%`)}{c.code.by.map((x, k) => <React.Fragment key={k}>{v4(`${Math.round(x)}%`)}</React.Fragment>)}{v4(`${Math.round(c.code.time / 60)} min · ${money(c.code.cost)}`)}</React.Fragment>;})}
    </div>
    {PARTS.map(([name, c, a, b]) => <div key={name} style={{marginTop: 24, paddingLeft: 22, borderLeft: `8px solid ${c}`}}>
      <div style={{...txt(32, 700, c), fontStyle: 'italic'}}>{name}</div>
      {LINES.slice(a, b).map((l, i) => <div key={i} style={{...txt(22, 500, '#e8eefc'), lineHeight: 1.4, marginTop: 8}}>{l}</div>)}</div>)}
    <div style={{...txt(32, 700), fontStyle: 'italic', marginTop: 28}}>Sources</div>
    {SOURCES.map(s => <div key={s.what} style={{...txt(19, 500, '#cfe0ff'), marginTop: 6}}>
      <span style={{color: '#ffd23f', fontWeight: 700}}>{s.what}</span> · {s.src} · <Proof to={s.url}>{s.url}</Proof></div>)}
    <div style={{...txt(19, 500, MUTE), marginTop: 18}}>Read {CHECKED}. Scores and prices checked again {RECHECKED}: all matched. Haiku 5.5 was read on {HAIKU_READ}, the day after it came out. Speeds are live readings and move by the day. {cap(DISCLAIMER)}.</div>
  </div>;
};

/* ---------- the app ---------- */
type Screen = {k: 'map'; at: number} | {k: 'desk'; n: number} | {k: 'blocks'; n: number} | {k: 'arena'; n: number} | {k: 'court'; n: number} | {k: 'ship'; n: number} | {k: 'levels'; at?: RoadId} | {k: 'select'; road: Road}
  | {k: 'race'; road: Road; n: number} | {k: 'result'; road: Road; res: Result};

const App: React.FC = () => {
  const [sc, setSc] = useState<Screen>({k: 'map', at: 0}), [nums, setNums] = useState(false), [best, setBest] = useState(loadBest), [desk, setDesk] = useState(() => loadDesk()), [arena, setArena] = useState(() => loadDesk(ARENA_KEY)), [blocks, setBlocks] = useState(() => loadDesk(BLOCKS_KEY)), [ship, setShip] = useState(() => loadDesk(SHIP_KEY)), [court, setCourt] = useState(() => loadDesk(COURT_KEY)), [k, setK] = useState(1), [, redraw] = useState(0);
  const [you, setYou] = useState<ModelId>('sonnet55'), [rivals, setRivals] = useState<ModelId[]>([]);
  useEffect(() => {const on = () => setK(Math.min(innerWidth / W, innerHeight / H)); on(); addEventListener('resize', on); return () => removeEventListener('resize', on);}, []);
  const menu = sc.k !== 'race' && sc.k !== 'desk' && sc.k !== 'arena' && sc.k !== 'blocks' && sc.k !== 'ship' && sc.k !== 'court';   // on the menus the numbers page and the sound button are one tap away
  useKeys(key => {if (key === 'm') {toggleMute(); redraw(v => v + 1);} if (key === 'n' && menu) setNums(true);});
  useEffect(() => {loop('bed-garage.mp3', sc.k === 'levels' || sc.k === 'select' || sc.k === 'result' ? .1 : 0);}, [sc.k]);   // the rally's menu theme: one loop across its screens, off for the race and the map
  const race = (road: Road) => setSc({k: 'race', road, n: Date.now()});
  const ended = (road: Road, res: Result) => {
    const n = stars(res.you).filter(Boolean).length, cur = best[road.id]?.[you] ?? -1;
    if (n > cur) {const b = {...best, [road.id]: {...best[road.id], [you]: n}}; setBest(b); saveBest(b);}
    setSc({k: 'result', road, res});
  };
  return <div style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1024', overflow: 'hidden'}}>
    <style>{`@font-face{font-family:'BVP';src:url(${BVP_URL})}@font-face{font-family:'GV';src:url(${BVP_URL});font-weight:700}@font-face{font-family:'GV';src:url(${BVPM_URL});font-weight:500}`}</style>
    <div style={{width: W, height: H, flex: 'none', position: 'relative', overflow: 'hidden', transform: `scale(${k})`, background: '#0b1024'}}>
      {sc.k === 'map' && <Worlds at={sc.at} go={n => setSc(n === 5 ? {k: 'ship', n: Date.now()} : n === 4 ? {k: 'court', n: Date.now()} : n === 3 ? {k: 'arena', n: Date.now()} : n === 2 ? {k: 'blocks', n: Date.now()} : n ? {k: 'desk', n: Date.now()} : {k: 'levels'})}
        stars={[[ROADS.reduce((n, r) => n + (topOf(best, r.id)?.[1] ?? 0), 0), ROADS.length * 3], [DAYS.reduce((n, d) => n + (desk[d.id] ?? 0), 0), DAYS.length * 3],
          [SITES.reduce((n, s) => n + siteBest(blocks, s), 0), SITES.length * 3], [STAGES.reduce((n, s) => n + bestOf(arena, s), 0), STAGES.length * 3], [CASES.reduce((n, c) => n + caseBest(court, c), 0), CASES.length * 3], [ROOMS.reduce((n, r) => n + roomBest(ship, r), 0), ROOMS.length * 3]]}/>}
      {sc.k === 'court' && <Court key={sc.n} best={court} onQuit={() => setSc({k: 'map', at: 4})}
        onEnd={(key, n) => {if (n > (court[key] ?? -1)) {const b = {...court, [key]: n}; setCourt(b); saveDesk(b, COURT_KEY);}}}/>}
      {sc.k === 'ship' && <Ship key={sc.n} best={ship} onQuit={() => setSc({k: 'map', at: 5})}
        onEnd={(key, n) => {if (n > (ship[key] ?? -1)) {const b = {...ship, [key]: n}; setShip(b); saveDesk(b, SHIP_KEY);}}}/>}
      {sc.k === 'blocks' && <Blocks key={sc.n} best={blocks} onQuit={() => setSc({k: 'map', at: 2})}
        onEnd={(key, n) => {if (n > (blocks[key] ?? -1)) {const b = {...blocks, [key]: n}; setBlocks(b); saveDesk(b, BLOCKS_KEY);}}}/>}
      {sc.k === 'desk' && <Desk key={sc.n} best={desk} onQuit={() => setSc({k: 'map', at: 1})}
        onEnd={(key, n) => {if (n > (desk[key] ?? -1)) {const b = {...desk, [key]: n}; setDesk(b); saveDesk(b);}}}/>}
      {sc.k === 'arena' && <Arena key={sc.n} best={arena} onQuit={() => setSc({k: 'map', at: 3})}
        onEnd={(key, n) => {if (n > (arena[key] ?? -1)) {const b = {...arena, [key]: n}; setArena(b); saveDesk(b, ARENA_KEY);}}}/>}
      {sc.k === 'levels' && <Levels best={best} at={sc.at} pick={road => setSc({k: 'select', road})} back={() => setSc({k: 'map', at: 0})}/>}
      {sc.k === 'select' && <Select road={sc.road} best={best} you0={you} rivals0={rivals} go={(y, rv) => {setYou(y); setRivals(rv); race(sc.road);}} back={() => setSc({k: 'levels', at: sc.road.id})}/>}
      {sc.k === 'race' && <Race key={sc.n} road={sc.road} pick={you} rivals={rivals}
        onEnd={res => ended(sc.road, res)} onQuit={() => setSc({k: 'select', road: sc.road})}/>}
      {sc.k === 'result' && <Results road={sc.road} pick={you} res={sc.res} again={() => race(sc.road)}
        other={() => setSc({k: 'select', road: sc.road})} levels={() => setSc({k: 'levels', at: sc.road.id})}/>}
      {nums && <Numbers close={() => setNums(false)}/>}
      {menu && <div style={{position: 'absolute', right: 24, top: 14, display: 'flex', gap: 12}}>
        <Button label="Numbers" icon="list" act={() => setNums(true)} style={{background: 'rgba(10,16,38,.8)'}}/>
        <Button label={`Sound ${isMuted() ? 'off' : 'on'}`} act={() => {toggleMute(); redraw(v => v + 1);}} style={{background: 'rgba(10,16,38,.8)', opacity: isMuted() ? .7 : 1}}/></div>}
    </div>
    {/* the stage is landscape; a phone held upright would show it a fifth of the size */}
    {TOUCH && innerHeight > innerWidth && <div style={{position: 'fixed', inset: 0, zIndex: 20, background: '#0b1024', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 30, textAlign: 'center', fontFamily: BOLD, fontStyle: 'italic', fontSize: 28, color: '#fff'}}>↻ TURN YOUR PHONE SIDEWAYS</div>}
  </div>;
};

createRoot(document.getElementById('root')!).render(<App/>);
