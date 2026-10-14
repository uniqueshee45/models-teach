/**
 * World 2, the front desk: the screen. The rules are desk.ts; the look is the video's pixel shop
 * (remotion/src/opus55/pixkit.tsx): one 320×180 room with every pixel a 6×6 block.
 * Meb runs the counter. Six robot clerks sit behind him, one per model, each in its car's paint.
 * One tap per customer: tap a desk and the front customer goes there.
 */
import React, {useEffect, useRef, useState} from 'react';
import {MONO} from '../../remotion/src/meb-hatch/rig';
import type {Pose} from '../../remotion/src/meb-hatch/rig';
import {Box, CRIT, FLOOR, GOLD, INK, NAVY, ROBOP, Shadow, Sp, TXT, Tx, circ, clerk, mebR, outline, raster, toRuns} from '../../remotion/src/opus55/pixkit';
import type {Runs, Theme} from '../../remotion/src/opus55/pixkit';
import {glyph, tw} from '../../remotion/src/opus55/pixfont';
import {Btn, GLASS, H, Mono, TOUCH, W} from './race';
import {DT, lampOf, money} from './rules';
import type {RoadId} from './rules';
import {DAYS, FEE, RUN_MAX, WORD, billLines, bucks, cash, chanceOf, costOf, dayStars, labelOf, makeBot, makeShop, pct, profit, send, sendHome, slip, tick, tipOf, tried} from './desk';
import type {Bot, Cust, Day, DEv, Shop} from './desk';
import {CARS, COSTS, KINDS, MODELS, TB4_READ, VALS4} from './stats';
import type {Model, ModelId} from './stats';
import {loop, sfx} from './sound';
import {ANIM, Bars, Clock, Explain, In, Moves, markSeen, movesDone, seen, useT} from './explain';
import type {Card} from './explain';
import {Keys, MUTE, Proof, Sheet, txt} from './ui';

/* ---------- where things are, in room pixels ---------- */
const VW = 320, VH = 180;
const DX = (i: number) => 6 + i * 52;              // a desk's left edge; each is 48 wide
const ROBO_Y = 16, DESK_Y = 46, SIGN_Y = 74, SEAT_Y = 100;   // the clerk, its desk, the sign under it, where a customer stands
const LINE_Y = 163, LINE_X = (j: number) => 84 + j * 42, SHOWN = 6;   // the queue: the front customer is next to Meb
const CARD_Y = 112, DOOR_X = 345;
const TIP_S = 5, END_HOLD = 1.2;

/* ---------- the cast ---------- */
const dark = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
type ClerkFace = 'open' | 'blink' | 'happy';
/** The video's clerk, its apron in the model's own paint. */
const CLERKS = Object.fromEntries(CARS.map(id => {
  const pal = {...ROBOP, a: MODELS[id].paint, A: dark(MODELS[id].paint, .7)};
  return [id, {open: clerk('open', pal), blink: clerk('blink', pal), happy: clerk('happy', pal)}];
})) as Record<ModelId, Record<ClerkFace, Runs>>;
const ICONP = {o: INK, w: '#ffffff', l: '#8f98ae', v: '#7a5cf0', d: '#1c2438', g: '#6ef2a0', c: '#35c9e8', h: '#dff3fa', s: '#9aa6bd', y: '#ffc933', r: '#e8506e'};
const QM = glyph('?'), LT = glyph('<'), GT = glyph('>');
const ICON: Partial<Record<RoadId, Runs>> = {
  inbox: toRuns(outline(raster(16, 16, (x, y) => !(x > 1.5 && x < 14.5 && y > 3.5 && y < 12.5) ? '.' : y < 9.5 && Math.abs(Math.abs(x - 8) - (9 - y) * 1.2) < .75 ? 'l' : 'w')), ICONP),
  memory: toRuns(outline(raster(16, 16, (x, y) => !circ(x, y, 7.5, 8.5, 6.6) ? '.' : QM[Math.floor(y) - 5]?.[Math.floor(x) - 5] === '#' ? 'w' : 'v')), ICONP),
};
/** A ticket's picture, by its kind of work (KINDS order): code on a screen, a flask, a little network, a gear, a chip,
 *  a padlock, a play button. Sixteen pixels square, drawn by hand. */
const KICON: Runs[] = [
  raster(16, 16, (x, y) => !(x > 1.5 && x < 14.5 && y > 2.5 && y < 13.5) ? '.' : LT[Math.floor(y) - 5]?.[Math.floor(x) - 3] === '#' || GT[Math.floor(y) - 5]?.[Math.floor(x) - 9] === '#' ? 'g' : 'd'),
  ['................', '.....wwwwww.....', '......whhw......', '......whhw......', '......whhw......', '.....whhhhw.....', '.....whhhhw.....', '....whhhhhhw....',
    '....wccccccw....', '...wccccccccw...', '...wccccccccw...', '..wccccccccccw..', '..wccccccccccw..', '..wwwwwwwwwwww..', '................', '................'],
  ['................', '................', '..vvv......vvv..', '..vvv......vvv..', '..vvv......vvv..', '.....l....l.....', '......l..l......', '......vvvv......',
    '......vvvv......', '......l..l......', '.....l....l.....', '..vvv......vvv..', '..vvv......vvv..', '..vvv......vvv..', '................', '................'],
  ['................', '......ssss......', '..ss..ssss..ss..', '..ssssssssssss..', '...ssssssssss...', '...sss....sss...', '.ssss......ssss.', '.ssss......ssss.',
    '.ssss......ssss.', '.ssss......ssss.', '...sss....sss...', '...ssssssssss...', '..ssssssssssss..', '..ss..ssss..ss..', '......ssss......', '................'],
  ['................', '....y..yy..y....', '....y..yy..y....', '...dddddddddd...', '.yyddddddddddyy.', '...ddggggggdd...', '...ddggggggdd...', '.yyddggggggddyy.',
    '.yyddggggggddyy.', '...ddggggggdd...', '...ddggggggdd...', '.yyddddddddddyy.', '...dddddddddd...', '....y..yy..y....', '....y..yy..y....', '................'],
  ['................', '.....llllll.....', '....ll....ll....', '....ll....ll....', '....ll....ll....', '....ll....ll....', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..',
    '..yyyyyddyyyyy..', '..yyyyyddyyyyy..', '..yyyyyddyyyyy..', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..', '................', '................'],
  ['................', '................', '................', '..rrrrrrrrrrrr..', '..rrrrrrrrrrrr..', '..rrrrwwrrrrrr..', '..rrrrwwwwrrrr..', '..rrrrwwwwwwrr..',
    '..rrrrwwwwwwrr..', '..rrrrwwwwrrrr..', '..rrrrwwrrrrrr..', '..rrrrrrrrrrrr..', '..rrrrrrrrrrrr..', '................', '................', '................'],
].map(rows => toRuns(outline(rows), ICONP));
const iconOf = (c: {kind: RoadId; hard: number}) => c.kind === 'tickets' ? KICON[c.hard - 1] : ICON[c.kind];
const CARD: Theme[] = [{o: '#2c3350', a: '#79a7ea', f: '#fbfbf6'}, {o: '#1f3b2a', a: '#58c47a', f: '#f6fff4'}, {o: '#2c3350', a: '#79a7ea', f: '#fbfbf6'}, {o: '#4a2a10', a: '#ff9f2e', f: '#fff6e8'}];
/** A card's frame: a ticket's is its kind's own colour (KINDS order), an email's is blue. */
const KCOL = ['#58c47a', '#35b8d8', '#9a7cf0', '#8f98ae', '#2fa58f', '#e8b020', '#e8506e'];
const cardOf = (c: {kind: RoadId; hard: number}): Theme => c.kind === 'tickets' ? {o: '#2c3350', a: KCOL[c.hard - 1], f: '#fbfbf6'} : c.kind === 'inbox' ? CARD[2] : CARD[c.hard];
const price = (x: number) => x < 1 ? '$' + x.toFixed(x < .01 ? 3 : 2).slice(1) : money(x);   // "$.02": a sign is 48 pixels wide ("$.003": Haiku 5.5's email)
/** A desk's answer, shown on its own name plate for a moment: the words, and the plate's colour. */
const SAID = {right: [['RIGHT'], '#1f9e55'], wrong: [['WRONG'], '#d23c3c'], ask: [['NOT', 'SURE'], '#2f6fd0']} as const, SAID_S = 1.2;
/** The sign under a desk, for the customer you hold: how often this desk gets that job right. A ticket: green from
 *  70%, amber from 50%, red below (rules.ts, lampOf). (A question, which no day brings now: blue for a desk that says
 *  "not sure".) */
const lamp = (c: {kind: RoadId; hard: number}, m: Model) => {
  const ch = chanceOf(c, m);
  if (c.kind === 'tickets') return [SAID.right[1], '#b06f10', SAID.wrong[1]][lampOf(ch * 100) - 1];
  return ch >= .9 ? SAID.right[1] : ch >= .4 ? '#b06f10' : m.guesses < 50 ? SAID.ask[1] : SAID.wrong[1];
};
const CHEAP = [...CARS].sort((a, b) => costOf('tickets', MODELS[a]) - costOf('tickets', MODELS[b]))[0];   // the desk that charges least for a ticket
const MEB: Record<string, Pose> = {idle: {}, point: {face: 'happy', armR: 100}, tell: {face: 'happy', armR: 60, armL: 20}, shocked: {face: 'shocked', armL: 60, armR: 60}, cheer: {face: 'happy', armL: 140, armR: 140}};

/* ---------- the game around the rules ---------- */
type View = {x: number; y: number; gone: number; left: boolean; moving: boolean};
type G = {
  s: Shop; phase: 'brief' | 'play' | 'bill'; clock: number; endT: number; billT: number;
  sel: number | null;                 // the customer you picked; nobody picked means the front one
  bot: Bot | null; botFn: ((s: Shop) => void) | null;
  view: Map<number, View>;
  meb: keyof typeof MEB; mebT: number;
  tip: {text: string; t0: number} | null; tips: string[]; told: Set<string>;
  sendTo: (i: number) => void; pick: (id: number) => void; tell: () => void; start: () => void;
};
const selOf = (g: G): Cust | undefined => g.s.line.find(c => c.id === g.sel) ?? g.s.line[0];

export const Desk: React.FC<{best: Record<string, number>; onEnd: (key: string, stars: number) => void; onQuit: () => void}> = ({best, onEnd, onQuit}) => {
  const [, setTick] = useState(0), [run, setRun] = useState(0);
  // the day on the board: it opens on the first one with no star yet, and the board's two arrows change it
  const [di, setDi] = useState(() => Math.max(0, DAYS.findIndex(d => !best[d.id]))), day = DAYS[di];
  const hop = (d: number) => {sfx('select', .25); setRun(0); setDi(i => (i + d + DAYS.length) % DAYS.length);};
  const ref = useRef<G | null>(null);
  const ended = useRef(onEnd); ended.current = onEnd;
  const quit = useRef(onQuit); quit.current = onQuit;
  // the cards show before the first morning; the ? on the morning board brings them back
  const [how, setHow] = useState(() => !seen(HOW_KEY)), howOn = useRef(how); howOn.current = how;
  useEffect(() => () => loop('bed-morning.mp3', 0), []);   // leaving the desk stops the morning's theme

  useEffect(() => {
    const s = makeShop(day, 1 + Math.floor(Math.random() * 1e6));
    const g: G = {s, phase: run ? 'play' : 'brief', clock: 0, endT: 0, billT: 0, sel: null, bot: null, botFn: null, view: new Map(), meb: 'idle', mebT: -9,
      tip: null, tips: [], told: new Set(), sendTo: () => {}, pick: () => {}, tell: () => {}, start: () => {}};
    ref.current = g;
    const tip = (key: string, text: string) => {if (!g.told.has(key)) {g.told.add(key); g.tips.push(text);}};
    const say = (text: string) => {g.tip = {text, t0: g.clock};};   // every time, and at once: why that answer was wrong
    const feel = (k: keyof typeof MEB) => {g.meb = k; g.mebT = g.clock;};
    g.start = () => {if (g.phase !== 'brief') return; g.phase = 'play'; loop('bed-morning.mp3', 0); sfx('go', .35); begin();};
    const begin = () => {loop('bed-shop.mp3', .1);
      tip('start', `${TOUCH ? 'TAP A DESK' : 'CLICK A DESK, OR PRESS 1 TO 6,'} TO SEND THE FRONT CUSTOMER THERE. THE SIGN UNDER A DESK IS ITS PRICE FOR THIS JOB, AND HOW OFTEN IT GETS ONE LIKE IT RIGHT.`);};
    g.sendTo = i => {
      const c = selOf(g);
      if (g.phase !== 'play' || !c) return;
      if (send(s, c, i)) {g.sel = null; feel('point'); sfx('blip', .3);} else sfx('buzz', .2);
    };
    g.pick = id => {if (g.phase === 'play' && s.line.some(c => c.id === id)) {g.sel = id; sfx('select', .25);}};
    g.tell = () => {
      const c = selOf(g);
      if (g.phase !== 'play' || !c) return;
      if (sendHome(s, c)) {g.sel = null; feel('tell'); sfx('select', .3);} else sfx('buzz', .2);
    };
    const onEv = (e: DEv) => {
      const c = e.c!, m = e.desk !== undefined ? s.desks[e.desk].m : null;
      switch (e.k) {
        case 'right': sfx('ding', .2);
          if (c.kind === 'inbox') tip('email', `EVERY DESK GETS AN EMAIL RIGHT, AND AN EMAIL PAYS ${money(FEE.inbox)}. A DESK THAT COSTS MORE THAN THAT LOSES MONEY ON IT.`);
          if (c.kind === 'tickets' && m!.id === CHEAP) tip('cheap', `${m!.name} GOT THAT ${labelOf(c)} TICKET RIGHT FOR ${money(costOf(c.kind, m!))}. THE SMALL DESK IS A BARGAIN ON THE KINDS IT IS GOOD AT.`);
          if (s.run === 2) tip('run', `TWO RIGHT IN A ROW: THE TIP GROWS WITH EVERY ONE, UP TO ×${RUN_MAX}. A WRONG ANSWER OR A WALK-OUT STARTS IT OVER.`); break;
        case 'wrong': sfx('fail', .3); feel('shocked');
          say(`${m!.name} ${c.kind === 'tickets' ? `GETS ${pct(chanceOf(c, m!))} OF THE ${labelOf(c)} TICKETS RIGHT ON THE REAL TEST. THIS WAS ONE OF THE REST.` : `KNOWS ${pct(chanceOf(c, m!))} OF THE ${labelOf(c)} QUESTIONS AND GUESSES AT THE REST.`} IT PAID NOTHING, COST ${money(costOf(c.kind, m!))} AND ENDED YOUR STREAK.`); break;
        case 'ask': sfx('select', .3);
          tip('ask', `"NOT SURE" IS AN HONEST ANSWER: NO REFUND, AND YOUR STREAK HOLDS. TRY ANOTHER DESK, OR ${TOUCH ? 'TAP' : 'PRESS SPACE:'} SAY NOT SURE AND LET THEM GO.`); break;
        case 'out': sfx('drain', .3); feel('shocked');
          tip('out', 'A CUSTOMER WALKED OUT, AND YOUR STREAK WITH THEM. A DESK THAT IS FREE NOW CAN BEAT THE BEST DESK IN THREE SECONDS.'); break;
        case 'end': g.endT = g.clock; break;
      }
    };
    const spot = (c: Cust): [number, number] => c.st === 'line' ? [LINE_X(Math.min(s.line.indexOf(c), SHOWN)), LINE_Y]
      : c.st === 'desk' ? [DX(s.desks.findIndex(d => d.c === c)) + 24, SEAT_Y] : [DOOR_X, LINE_Y - 9];
    const step = () => {
      g.clock += DT;
      if (!g.tip || g.clock - g.tip.t0 > TIP_S) {const next = g.tips.shift(); g.tip = next ? {text: next, t0: g.clock} : null;}
      if (g.phase !== 'play') return;
      if (s.end) {
        if (g.clock - g.endT > END_HOLD) {g.phase = 'bill'; g.billT = g.clock; loop('bed-shop.mp3', 0); sfx('victory', .4); ended.current(day.id, dayStars(s).filter(Boolean).length);}
      } else {
        g.botFn?.(s);
        for (const e of tick(s)) onEv(e);
      }
      for (const c of s.custs) {
        if (c.st === 'soon') continue;
        let v = g.view.get(c.id);
        if (!v) g.view.set(c.id, v = {x: DOOR_X, y: LINE_Y, gone: 0, left: true, moving: true});
        if (c.st === 'gone' && !v.gone) v.gone = g.clock;
        const walks = c.st !== 'gone' || c.end === 'out' || c.end === 'home';   // one that got an answer stays at the desk and fades
        const [tx, ty] = walks ? spot(c) : [v.x, v.y], k = Math.min(1, DT * 9);
        v.moving = Math.abs(tx - v.x) + Math.abs(ty - v.y) > 1.5;
        if (v.moving) v.left = tx < v.x;
        v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
      }
    };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (e.repeat || howOn.current) return;
      if (g.phase === 'brief') {if (k === 'enter' || k === ' ') g.start(); if (k === 'h') setHow(true); if (k === 'escape') quit.current();
        if (k === 'arrowleft' || k === 'arrowright') hop(k === 'arrowleft' ? -1 : 1); return;}
      if (g.phase === 'bill') {if (k === 'enter' || k === ' ') setRun(r => r + 1); if (k === 'escape' || k === 'l') quit.current();
        if (k === 'arrowright' && di < DAYS.length - 1) hop(1); return;}
      if (k >= '1' && k <= '6') g.sendTo(+k - 1);
      if (k === 'arrowleft' || k === 'arrowright') {
        const line = s.line.slice(0, SHOWN), cur = selOf(g);
        if (cur) {const n = line[Math.max(0, Math.min(line.length - 1, line.indexOf(cur) + (k === 'arrowright' ? 1 : -1)))]; if (n) g.sel = n.id;}
      }
      if (k === ' ' || k === 'enter') g.tell();
      if (k === 'escape') quit.current();
    };
    addEventListener('keydown', kd);
    if (g.phase === 'play') begin(); else loop('bed-morning.mp3', .1);   // the morning's theme, under the cards and the board
    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      acc += Math.min(.1, (now - last) / 1000); last = now;
      while (acc >= DT) {acc -= DT; step();}
      setTick(t => t + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setTick(t => t + 1);
    // ponytail: the rally's test hook, for a hidden browser (no animation frames there); only with #test in the address.
    // F9 runs 2 s, F10 runs 10 s, F6 runs 0.2 s, F7 hands the desk to a bot (sense, first, off); the state lands in document.body.dataset.pym
    const hook = (e: KeyboardEvent) => {
      const sec = e.key === 'F9' ? 2 : e.key === 'F10' ? 10 : e.key === 'F6' ? .2 : 0;
      if (e.key === 'F7') {g.bot = g.bot === null ? 'sense' : g.bot === 'sense' ? 'first' : null; g.botFn = g.bot ? makeBot(g.bot) : null;}
      for (let i = 0; i < sec / DT; i++) step();
      setTick(t => t + 1);
      document.body.dataset.pym = JSON.stringify({world: 'desk', day: day.id, phase: g.phase, bot: g.bot, t: +s.t.toFixed(1), end: s.end, spent: +s.spent.toFixed(3), took: +s.took.toFixed(3), made: +profit(s).toFixed(3), streak: s.run, right: s.right, wrong: s.wrong, out: s.out, home: s.home,
        line: s.line.map(c => `${c.id}:${WORD[c.kind][0]}${c.hard}${slip(c) ? '?' : ''}:${c.wait.toFixed(1)}`), desks: s.desks.map(d => d.c ? `${d.c.id}:${d.left.toFixed(1)}` : '-'),
        sel: selOf(g)?.id, stars: dayStars(s), tip: g.tip?.text});
    };
    if (location.hash === '#test') addEventListener('keyup', hook);
    return () => {cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', hook); loop('bed-shop.mp3', 0); ref.current = null;};
  }, [run, di]);

  const g = ref.current;
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#1b2440'}}>
    {g && <Room g={g}/>}
    {g && g.phase === 'play' && g.tip && <div style={{position: 'absolute', left: 250, right: 250, top: 6, textAlign: 'center', pointerEvents: 'none',
      opacity: Math.min(1, (g.clock - g.tip.t0) / .2) * Math.min(1, (TIP_S - (g.clock - g.tip.t0)) / .4)}}>
      <div style={{display: 'inline-block', padding: '6px 22px', ...GLASS, borderRadius: 14, borderColor: '#ffd23f', background: 'rgba(10,16,38,.9)'}}>
        <Mono size={22} style={{lineHeight: 1.3}}>{g.tip.text}</Mono></div></div>}
    {g && g.phase === 'play' && <Btn label="✕ QUIT" size={18} act={onQuit} style={{position: 'absolute', left: 12, top: 6}}/>}
    {g && g.phase === 'brief' && !how && <Clock.Provider value={g.clock}><Morning key={day.id} day={day} at={di} best={best[day.id] ?? 0} hop={hop} start={g.start} back={onQuit} how={() => setHow(true)}/></Clock.Provider>}
    {g && g.phase === 'bill' && <Clock.Provider value={g.clock - g.billT}><Tally s={g.s} again={() => setRun(r => r + 1)} next={di < DAYS.length - 1 ? () => hop(1) : undefined} back={onQuit}/></Clock.Provider>}
    {how && <Explain tag="Day one" cards={CARDS} last="Open the shop" done={() => {markSeen(HOW_KEY); setHow(false);}}/>}
  </div>;
};

/* ---------- the room ---------- */
const Room: React.FC<{g: G}> = ({g}) => {
  const s = g.s, day = s.day, t = g.clock, sel = g.phase === 'play' ? selOf(g) : undefined;
  const done = s.custs.filter(c => c.st === 'gone').length / s.custs.length;
  const pose = MEB[g.phase === 'bill' ? (dayStars(s).some(Boolean) ? 'cheer' : 'shocked') : t - g.mebT < (g.meb === 'shocked' ? 1 : .4) ? g.meb : 'idle'];
  const drawn = s.custs.filter(c => g.view.has(c.id)).map(c => ({c, v: g.view.get(c.id)!})).filter(({c, v}) => !v.gone || (c.end === 'right' || c.end === 'wrong' ? t - v.gone < .7 : v.x < DOOR_X - 20));
  const made = profit(s), next = day.stars.find(x => made < x - 1e-9);
  const hud: [string, string][] = [[`TODAY ${cash(made)}`, made <= -.005 ? '#ff6b5e' : '#6ef2a0'], [`STREAK ×${Math.min(RUN_MAX, s.run)}`, s.run > 1 ? GOLD : '#8a90a2'],
    [next ? `NEXT GOAL ${bucks(next)}` : 'ALL 3 GOALS', next ? '#fff' : GOLD]];
  let hx = 4;
  return <svg viewBox={`0 0 ${VW} ${VH}`} width={W} height={H} shapeRendering="crispEdges" style={{position: 'absolute', inset: 0, userSelect: 'none', touchAction: 'none'}}>
    <defs>
      <pattern id="dfloor" width={32} height={32} patternUnits="userSpaceOnUse">{FLOOR.map(([c, d]) => <path key={c} d={d} fill={c}/>)}</pattern>
      <pattern id="dpaper" width={8} height={4} patternUnits="userSpaceOnUse"><rect width={8} height={4} fill="#e8dff2"/><rect width={1} height={4} fill="#ddd2ea"/></pattern>
    </defs>
    <rect width={VW} height={44} fill="url(#dpaper)"/><rect width={VW} height={3} fill="#6a5a7a"/>
    <rect y={38} width={VW} height={8} fill="#b89878"/><rect y={38} width={VW} height={1} fill="#d8b898"/>
    <rect y={46} width={VW} height={VH - 46} fill="url(#dfloor)"/>
    {/* the mat Meb stands on, and the way in */}
    <rect x={8} y={156} width={44} height={9} fill="#c84848"/><rect x={8} y={156} width={44} height={1} fill="#e27070"/>
    <rect x={VW - 14} y={150} width={14} height={14} fill="#7a4e2a"/><rect x={VW - 13} y={151} width={13} height={12} fill="#26314a"/>
    {/* the desks: a clerk per model, its name, and the sign for the customer you're about to send */}
    {s.desks.map((d, i) => {
      const x = DX(i), m = d.m, busy = !!d.c, after = s.t - d.saidT, [fam, ver] = m.name.split(' ');
      // a working clerk bobs, eyes open, and an idle one blinks fast: half-shut eyes read as tired, and a model doesn't tire
      const face: ClerkFace = busy ? 'open' : d.said === 'right' && after < SAID_S ? 'happy' : Math.floor(t * 8 + i * 7) % 36 === 0 ? 'blink' : 'open';
      const hop = d.said && after < .16 ? 2 : busy ? Math.floor(t * 5 + i) % 2 : 0, no = sel && tried(sel, m.id), can = sel && !busy && !no;
      return <g key={m.id} onPointerDown={() => g.sendTo(i)} style={{cursor: can ? 'pointer' : 'default'}}>
        <rect x={x} y={8} width={48} height={76} fill="transparent"/>
        <Sp r={CLERKS[m.id][face]} x={x + 9} y={ROBO_Y - hop} o={no ? .45 : 1}/>
        <rect x={x} y={DESK_Y} width={48} height={26} fill={INK}/><rect x={x + 1} y={DESK_Y + 1} width={46} height={4} fill="#d8925a"/><rect x={x + 1} y={DESK_Y + 1} width={46} height={1} fill="#f0b07a"/>
        <rect x={x + 1} y={DESK_Y + 5} width={46} height={20} fill="#a86a3a"/>
        {d.said && after < SAID_S ? <g><rect x={x + 3} y={DESK_Y + 6} width={42} height={18} fill={SAID[d.said][1]}/>
            {(d.got ? [SAID[d.said][0][0], (d.got > 0 ? '+' : '-') + price(Math.abs(d.got))] : SAID[d.said][0]).map((word, j, all) =>
              <Tx key={j} s={word} x={x + 24} y={DESK_Y + (all.length > 1 ? 8 + j * 8 : 12)} c="#fff" align="c"/>)}</g>
          : <g><rect x={x + 3} y={DESK_Y + 6} width={42} height={18} fill={NAVY}/><rect x={x + 3} y={DESK_Y + 6} width={42} height={2} fill={m.paint}/>
            <Tx s={fam} x={x + 24} y={DESK_Y + 9} c="#fff" align="c"/><Tx s={ver} x={x + 24} y={DESK_Y + 17} c={m.ink} align="c"/></g>}
        {!TOUCH && <Tx s={`${i + 1}`} x={x + 3} y={ROBO_Y + 8} c="#fff" out={INK}/>}
        {busy ? <g><rect x={x + 2} y={SIGN_Y + 1} width={44} height={5} fill={INK}/><rect x={x + 3} y={SIGN_Y + 2} width={Math.round(42 * (1 - d.left / d.dur))} height={3} fill={GOLD}/></g>
          : no ? <g><rect x={x} y={SIGN_Y - 2} width={48} height={11} fill={INK}/><Tx s="ASKED" x={x + 24} y={SIGN_Y} c="#8a90a2" align="c"/></g>
          : sel && after > SAID_S ? <g><rect x={x} y={SIGN_Y - 2} width={48} height={20} fill={INK}/><rect x={x + 1} y={SIGN_Y + 8} width={46} height={9} fill={lamp(sel, m)}/>
            <Tx s={price(costOf(sel.kind, m))} x={x + 24} y={SIGN_Y} c={costOf(sel.kind, m) > FEE[sel.kind] ? '#ff8a7a' : '#fff'} align="c"/>
            <Tx s={pct(chanceOf(sel, m))} x={x + 24} y={SIGN_Y + 9} c="#fff" align="c"/></g> : null}
      </g>;})}
    {/* the customers: the video's walking coins, each with its job on a card while it waits */}
    {drawn.sort((a, b) => a.v.y - b.v.y).map(({c, v}) => {
      const x = Math.round(v.x), y = Math.round(v.y), fr = v.moving ? Math.floor(t * 8) % 2 : 0, inLine = c.st === 'line' && s.line.indexOf(c) < SHOWN;
      const fade = v.gone && (c.end === 'right' || c.end === 'wrong') ? 1 - (t - v.gone) / .7 : 1, hopY = c.end === 'right' ? Math.round(Math.abs(Math.sin((t - v.gone) * 14)) * 4) : 0;
      const shake = c.end === 'wrong' ? Math.round(Math.sin((t - v.gone) * 50) * 2) : 0, on = sel === c, top = CARD_Y - (on ? 3 : 0), w = c.wait / day.patience;
      return <g key={c.id} opacity={fade} onPointerDown={inLine ? () => g.pick(c.id) : undefined} style={{cursor: inLine ? 'pointer' : 'default'}}>
        <Shadow x={x} y={y - 2} w={10}/>
        <Sp r={CRIT[fr]} x={x - 7 + shake} y={y - 17 - hopY - (fr ? 0 : v.moving ? 1 : 0)} flip={v.left ? 14 : undefined}/>
        {inLine && <g>
          <rect x={x - 21} y={98} width={42} height={66} fill="transparent"/>
          {on && <rect x={x - 21} y={top - 1} width={43} height={33} fill={GOLD}/>}
          <JobCard x={x - 20} y={top} kind={c.kind} hard={c.hard}/>
          {/* the card you hold says what it is in a word: the picture is all the others show */}
          {on && !slip(c) && (() => {const word = labelOf(c), w = tw(word) + 8, x0 = Math.max(1, Math.min(VW - w - 1, Math.round(x - w / 2)));
            return <g><rect x={x0} y={top - 12} width={w} height={11} fill={INK}/><rect x={x0 + 1} y={top - 11} width={w - 2} height={9} fill={cardOf(c).a}/><Tx s={word} x={x0 + 4} y={top - 10} c={INK}/></g>;})()}
          <rect x={x - 20} y={144} width={40} height={2} fill="rgba(20,20,40,.3)"/>
          {(w > .25 || Math.floor(t * 6) % 2 === 0) && <rect x={x - 20} y={144} width={Math.max(1, Math.round(40 * w))} height={2} fill={w > .5 ? '#3fbf6a' : w > .25 ? '#ff9f2e' : '#e04848'}/>}
          {slip(c) && (on ? <g><rect x={x - 24} y={top - 11} width={48} height={10} fill={INK}/><rect x={x - 23} y={top - 10} width={46} height={8} fill="#2f6fd0"/><Tx s="NOT SURE" x={x} y={top - 9} c="#fff" align="c"/></g>
            : <g><rect x={x + 14} y={top - 3} width={8} height={8} fill={INK}/><rect x={x + 15} y={top - 2} width={6} height={6} fill="#2f6fd0"/></g>)}
        </g>}
      </g>;})}
    {s.line.length > SHOWN && <Tx s={`+${s.line.length - SHOWN}`} x={VW - 16} y={136} c="#fff" out={INK} align="c"/>}
    {/* Meb, at the counter */}
    <Shadow x={30} y={LINE_Y - 2} w={24}/><Sp r={mebR(pose)} x={10} y={LINE_Y - 38 - (pose === MEB.idle && Math.floor(t * 2) % 2 ? 1 : 0)}/>
    {/* the day so far */}
    <rect y={165} width={VW} height={15} fill={NAVY}/><rect y={165} width={Math.round(VW * done)} height={1} fill={GOLD}/>
    {hud.map(([text, c]) => {const x = hx; hx += text.length * 6 + 10; return <Tx key={text.slice(0, 3)} s={text} x={x} y={169} c={c}/>;})}
    {sel && slip(sel) && <g onPointerDown={() => g.tell()} style={{cursor: 'pointer'}}>
      <Box x={232} y={165} w={86} h={15} t={{o: '#fff', a: '#8fd3ff', f: '#2f6fd0'}}/><Tx s="SAY NOT SURE" x={275} y={169} c="#fff" align="c"/></g>}
  </svg>;
};

/* ---------- the cards it opens with (explain.tsx). Anthropic's tip: hand each job to the right model, a small one for
   small jobs and the main one for judgment. Drawn in the shop's own pixels, a room pixel to PX stage pixels. ---------- */
const HOW_KEY = 'pym3.deskhow';   // set once the cards have been read or skipped
const ADDY_COST = 'Addy Osmani (Anthropic), "What a task costs on Opus 5.5", claude.dev, 25 Sep 2026';
const PX = 6;
const Pix: React.FC<{w: number; h: number; k?: number; children: React.ReactNode}> = ({w, h, k = PX, children}) =>
  <svg viewBox={`0 0 ${w} ${h}`} width={w * k} height={h * k} shapeRendering="crispEdges" style={{display: 'block', overflow: 'visible'}}>{children}</svg>;
/** A job's card, as it hangs over a customer in the queue: its picture, in a frame of its kind's colour. */
const JobCard: React.FC<{x: number; y: number; kind: RoadId; hard: number}> = ({x, y, kind, hard}) => {const r = iconOf({kind, hard});
  return <g><Box x={x} y={y} w={40} h={30} t={cardOf({kind, hard})}/>{r && <Sp r={r} x={x + 8} y={y + 3} k={1.5}/>}</g>;};
/** A customer (the video's walking coin), stepping in place. */
const Walker: React.FC<{x: number; y: number; left?: boolean}> = ({x, y, left}) => {const f = Math.floor(useT() * 6) % 2;
  return <g><Shadow x={x} y={y - 2} w={10}/><Sp r={CRIT[f]} x={x - 7} y={y - 17 - (f ? 0 : 1)} flip={left ? 14 : undefined}/></g>;};
const COIN = toRuns(outline(raster(9, 9, (x, y) => !circ(x, y, 4.5, 4.5, 3.4) ? '.' : circ(x, y, 3.6, 3.6, 1.3) ? 'h' : 'y')), {o: INK, y: GOLD, h: '#fff6b0'});
const STAR_ROWS = ['...........', '.....#.....', '....###....', '....###....', '.#########.', '..#######..', '...#####...', '..###.###..', '..##...##..', '...........'];
const STAR = [false, true].map(on => toRuns(outline(STAR_ROWS.map(r => r.replace(/#/g, 'y'))), {o: INK, y: on ? GOLD : '#59607a'}));
const XR = toRuns(outline(raster(7, 7, (x, y) => x > 1 && x < 6 && y > 1 && y < 6 && (Math.abs(x - y) < .8 || Math.abs(x + y - 7) < .8) ? 'r' : '.')), {o: INK, r: '#ff5a4e'});
/** A coin and a price, centred on x. */
const Price: React.FC<{x: number; y: number; v: number; c?: string}> = ({x, y, v, c = '#3a1f14'}) => {const s = price(v), x0 = Math.round(x - (11 + tw(s)) / 2);
  return <g><Sp r={COIN} x={x0} y={y - 1}/><Tx s={s} x={x0 + 11} y={y} c={c}/></g>;};
const WOOD: Theme = {o: '#3a1f14', a: '#c8823a', f: '#f6e2b8'}, SIGN: Theme = {o: '#3a1f14', a: '#e04848', f: '#fff6ec'}, DARK: Theme = {o: INK, a: '#3a4466', f: NAVY};
/** A wooden button in the shop's pixels. */
const PBtn: React.FC<{x: number; y: number; w: number; h?: number; s: string; act: () => void; t?: Theme; c?: string; k?: number}> = ({x, y, w, h = 18, s, act, t = WOOD, c = '#3a1f14', k = 1}) =>
  <g data-ui="btn" onClick={e => {e.stopPropagation(); act();}} style={{cursor: 'pointer'}}><Box x={x} y={y} w={w} h={h} t={t}/><Tx s={s} x={x + w / 2} y={y + Math.round((h - 7 * k) / 2)} k={k} c={c} align="c"/></g>;
const name = (id: ModelId) => MODELS[id].real.replace('Claude ', '');
const DMOVES = [['A small job', 'model: haiku', 'a line in a helper\'s setup (a subagent): it runs on the small model'], ['The code', '/model', 'picks the main model: one that gets the code right'],
  ['The bill', '/usage', 'shows what the session has cost so far']];
const WOOD_CHIP: React.CSSProperties = {padding: '6px 24px', background: '#f6e2b8', border: '5px solid #3a1f14', boxShadow: 'inset 0 0 0 4px #c8823a', borderRadius: 6};
const LAMP = (ch: number) => ['#3fbf6a', '#e8a53a', '#ff6b5e'][lampOf(ch * 100) - 1];   // the signs' own colours, for a ticket
/** The third card's picture: every desk's sign for every kind of ticket, as lamps, with a ring on the best desk for
 *  each kind. The rings land on different rows: that is the card's point. A column drops in at a time. */
const KindGrid: React.FC<{at: number}> = ({at}) => {
  const cell = 148, row = 58, ch = (id: ModelId, k: number) => chanceOf({kind: 'tickets', hard: k + 1}, MODELS[id]);
  return <div style={{display: 'grid', gridTemplateColumns: `230px repeat(${KINDS.length}, ${cell}px) 150px`, columnGap: 6, rowGap: 6, alignItems: 'center'}}>
    <span/>{KINDS.map((k, i) => <In key={k.id} at={at + i * .18} how="drop" snd="place" vol={.12}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
      <Pix w={16} h={16} k={4}><Sp r={KICON[i]} x={0} y={0}/></Pix><span style={txt(22, 700)}>{k.name.length < 3 ? k.name : k.name[0] + k.name.slice(1).toLowerCase()}</span></div></In>)}
    <In at={at + KINDS.length * .18} how="drop"><span style={{...txt(22, 700, MUTE), display: 'block', textAlign: 'center'}}>A ticket costs</span></In>
    {CARS.map(id => <React.Fragment key={id}>
      <span style={{...txt(26, 700, MODELS[id].ink), textAlign: 'right', paddingRight: 12}}>{name(id)}</span>
      {KINDS.map((k, i) => {const v = ch(id, i), best = v >= Math.max(...CARS.map(x => ch(x, i))) - 1e-9;
        return <In key={k.id} at={at + i * .18 + .1} how="drop"><div style={{height: row, borderRadius: 10, boxSizing: 'border-box', display: 'grid', placeItems: 'center', background: LAMP(v), opacity: best ? 1 : .55,
          border: best ? '5px solid #fff' : '5px solid transparent', ...txt(26, 700, '#10182c')}}>{pct(v)}</div></In>;})}
      <In at={at + KINDS.length * .18 + .1} how="drop"><span style={{...txt(26, 700), display: 'block', textAlign: 'center'}}>{price(costOf('tickets', MODELS[id]))}</span></In>
    </React.Fragment>)}</div>;
};
/** One of the desk's three moves, played over and over in a little shop. */
const MiniD: React.FC<{n: number; at: number; snd: string; text: string; draw: (u: number) => React.ReactNode}> = ({n, at, snd, text, draw}) => {
  const u = Math.max(0, useT() - at);
  return <In at={at} snd={snd} vol={.15}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 440}}>
    <div style={{border: '5px solid #2c3350', borderRadius: 10, overflow: 'hidden'}}><Pix w={88} h={64} k={5}>
      <rect width={88} height={14} fill="#e8dff2"/><rect y={12} width={88} height={4} fill="#b89878"/><rect y={16} width={88} height={48} fill="#f4e9d4"/>
      {draw(u)}<rect x={2} y={2} width={10} height={10} fill={INK}/><Tx s={`${n}`} x={5} y={4} c="#fff"/></Pix></div>
    <div style={{...txt(28, 700), textAlign: 'center', minHeight: 72}}>{text}</div></div></In>;
};
const ClerkAt: React.FC<{id: ModelId; x: number; face?: ClerkFace; plate?: React.ReactNode}> = ({id, x, face = 'open', plate}) => <g>
  <Sp r={CLERKS[id][face]} x={x + 9} y={-2}/><rect x={x} y={30} width={48} height={14} fill={INK}/><rect x={x + 1} y={31} width={46} height={12} fill="#a86a3a"/>
  {plate ?? <g><rect x={x + 3} y={32} width={42} height={10} fill={NAVY}/><Tx s={MODELS[id].name.split(' ')[0]} x={x + 24} y={34} c="#fff" align="c"/></g>}</g>;
const CARDS: Card[] = [
  {title: 'Small jobs, big jobs', lines: ['Some jobs are small: *an email*, a lookup, a log to read. Some need *judgment*: the code.'], qAt: 2.4,
    art: <div style={{display: 'flex', gap: 200, alignItems: 'flex-end'}}>{([['inbox', 1, 'An email', .6], ['tickets', 1, 'A coding ticket', 1.3]] as [RoadId, number, string, number][]).map(([kind, hard, w, at]) =>
      <In key={kind} at={at} how="left" snd="place" vol={.2}><div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
        <Pix w={44} h={52}><JobCard x={2} y={0} kind={kind} hard={hard}/><Walker x={22} y={51}/></Pix>
        <div style={txt(36, 700)}>{w}</div></div></In>)}</div>},
  {title: 'Every desk gets an email right', lines: ['So the only difference is *the price*. An email pays ' + money(FEE.inbox) + '.'], qAt: 2.6,
    art: <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <Bars at={.6} rows={[...CARS].sort((a, b) => costOf('inbox', MODELS[a]) - costOf('inbox', MODELS[b])).map(id => {const c = costOf('inbox', MODELS[id]);
        return {label: name(id), v: c, text: price(c), c: c <= FEE.inbox ? '#6ef2a0' : '#ff8a7a'};})}/>
      <In at={2.4} how="up"><div style={txt(30, 500, MUTE)}>A <b style={{color: '#ff8a7a'}}>red</b> desk costs more than the email pays.</div></In></div>},
  {title: 'No desk is best at every kind', lines: ['A ticket has a *kind of work*. The *ring* is the best desk for it. A ticket pays *' + money(FEE.tickets) + '*.'], qAt: 2.8,
    src: <Proof to={VALS4}>Terminal-Bench 4.0 by Vals: how often each model finishes each kind of task (read {TB4_READ})</Proof>,
    art: <KindGrid at={.5}/>},
  {title: 'Your moves in Claude Code', lines: ['Hand *small jobs* to a small model, and keep *the code* where it comes out right.'], qAt: movesDone(DMOVES),
    quote: {text: 'Keep judgment calls on the main model.', who: ADDY_COST, to: COSTS},
    art: <Moves chip={WOOD_CHIP} rows={DMOVES}/>},
  {title: 'How the desk plays', lines: ['Customers walk in. *You* pick *the desk* for each one.'], qAt: 2.8,
    art: <div style={{display: 'flex', gap: 40}}>
      <MiniD n={1} at={.6} snd="door" text="A customer walks in with one job" draw={u => {const x = Math.round(96 - Math.min(1, (u % 2.6) / 1.6) * 56);
        return <g><JobCard x={x - 20} y={5} kind="tickets" hard={2}/><Walker x={x} y={58} left/></g>;}}/>
      <MiniD n={2} at={1.3} snd="select" text="Tap a desk: its sign is the price and how often it's right" draw={u => {const ch = chanceOf({kind: 'tickets', hard: 2}, MODELS.opus55);
        return <g><ClerkAt id="opus55" x={20}/>{u % 1.2 < .8 && <g><rect x={20} y={44} width={48} height={18} fill={INK}/><rect x={21} y={53} width={46} height={8} fill={LAMP(ch)}/>
          <Tx s={price(costOf('tickets', MODELS.opus55))} x={44} y={45} c="#fff" align="c"/><Tx s={pct(ch)} x={44} y={54} c="#fff" align="c"/></g>}</g>;}}/>
      <MiniD n={3} at={2} snd="coin" text="Right pays, and a streak grows the tip. Wrong pays nothing" draw={u => {const ok = u % 2.4 < 1.2, v = (u % 1.2) / 1.2;
        return <g><ClerkAt id="opus55" x={20} face={ok ? 'happy' : 'open'} plate={<g><rect x={23} y={32} width={42} height={10} fill={ok ? SAID.right[1] : SAID.wrong[1]}/>
          <Tx s={ok ? `+$${Math.round(FEE.tickets * 1.2)}` : 'WRONG'} x={44} y={34} c="#fff" align="c"/></g>}/>
          {ok && <Sp r={COIN} x={70} y={Math.round(40 - v * 26)} o={1 - v}/>}</g>;}}/></div>},
];

/* ---------- the morning, and the day's till: a pixel shop game's day start and its end-of-day tally ---------- */
const ordersOf = (day: Day) => day.jobs.flatMap(([kind, ns]) => ns.map((n, i) => ({kind, hard: i + 1, n})).filter(o => o.n));
const Morning: React.FC<{day: Day; at: number; best: number; hop: (d: number) => void; start: () => void; back: () => void; how: () => void}> = ({day, at, best, hop, start, back, how}) => {
  // up to four jobs hang as cards; a day with more (Thursday's eight) pins up the pictures alone
  const os = ordersOf(day), big = os.length <= 4, sp = big ? 44 : 22, x0 = 160 - (os.length * sp - (big ? 4 : 6)) / 2;
  const tk = os.map((o, i) => o.kind === 'tickets' ? i : -1).filter(i => i >= 0), mid = (i: number) => x0 + i * sp + (big ? 20 : 8);
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <svg viewBox={`0 0 ${VW} ${VH}`} width={W} height={H} shapeRendering="crispEdges" style={{position: 'absolute', inset: 0}}>
      <rect width={VW} height={VH} fill="rgba(10,12,34,.55)"/><rect y={165} width={VW} height={15} fill={NAVY}/>
      <PBtn x={4} y={4} w={44} s="< MAP" act={back}/><PBtn x={294} y={4} w={22} s="?" act={how}/>
      {/* which day, and an arrow each side of the board to change it */}
      <Tx s={`${at + 1}/${DAYS.length} · ${day.sub}`} x={160} y={10} c="#fff" out={INK} align="c"/>
      <PBtn x={36} y={56} w={22} h={24} s="<" k={2} act={() => hop(-1)}/><PBtn x={262} y={56} w={22} h={24} s=">" k={2} act={() => hop(1)}/>
      {/* today's orders, pinned up like a board in the shop */}
      <In g at={.1} how="drop" snd="paper" vol={.3}><g><Box x={64} y={22} w={192} h={92} t={WOOD}/>
        <rect x={67} y={25} width={186} height={20} fill="#d23c3c"/><rect x={67} y={25} width={186} height={2} fill="#ff7a6a"/>
        <Tx s={day.name} x={160} y={29} k={2} c="#fff" align="c"/></g></In>
      {os.map((o, i) => {const x = Math.round(x0 + i * sp), r = iconOf(o);
        return <In key={i} g at={.5 + i * (big ? .15 : .08)} snd="place" vol={.2}><g>{big ? <JobCard x={x} y={52} kind={o.kind} hard={o.hard}/> : r && <Sp r={r} x={x} y={59}/>}
          <Tx s={`×${o.n}`} x={mid(i)} y={86} c="#3a1f14" align="c"/></g></In>;})}
      {/* what one pays: an email, and any ticket (one price under all the tickets) */}
      <In g at={1}><g>{os.map((o, i) => o.kind !== 'tickets' && <Price key={i} x={mid(i)} y={98} v={FEE[o.kind]}/>)}
        {tk.length > 0 && <g><rect x={Math.round(mid(tk[0]) - 14)} y={95} width={Math.round(mid(tk[tk.length - 1]) - mid(tk[0]) + 28)} height={1} fill="#c8823a"/>
          <Price x={(mid(tk[0]) + mid(tk[tk.length - 1])) / 2} y={98} v={FEE.tickets}/></g>}</g></In>
      {/* the day's three goals */}
      {day.stars.map((v, i) => {const x = 81 + i * 54;
        return <In key={i} g at={1.2 + i * .15} how="slam" snd={best > i ? 'ding' : 'tick'} vol={.2}><g><Box x={x} y={122} w={50} h={18} t={DARK}/>
          <Sp r={STAR[best > i ? 1 : 0]} x={x + 4} y={126}/><Tx s={bucks(v)} x={x + 17} y={128} c="#fff"/></g></In>;})}
      <In g at={1.7} how="slam" snd="door" vol={.3}><g style={{animation: 'pym-nudge 1.2s ease-in-out 2.4s infinite', transformBox: 'fill-box', transformOrigin: 'center'}}>
        <PBtn x={120} y={148} w={80} h={24} s="OPEN" k={2} act={start} t={SIGN} c="#d23c3c"/></g></In>
    </svg>
    <Keys text="← → day  ·  Enter open the shop  ·  H how it works  ·  Esc map"/>
  </div>;
};
const Tally: React.FC<{s: Shop; again: () => void; next?: () => void; back: () => void}> = ({s, again, next, back}) => {
  const t = useT(), got = dayStars(s), made = profit(s), [more, setMore] = useState(false), [cmd, tip] = tipOf(s);
  const rows = s.desks.filter(d => d.jobs), tot = .6 + rows.length * .3, u = Math.max(0, Math.min(1, (t - tot) / .8));
  return <div style={{position: 'absolute', inset: 0}}>
    <style>{ANIM}</style>
    <svg viewBox={`0 0 ${VW} ${VH}`} width={W} height={H} shapeRendering="crispEdges" style={{position: 'absolute', inset: 0}}>
      <rect width={VW} height={VH} fill="rgba(10,12,34,.6)"/><rect y={165} width={VW} height={15} fill={NAVY}/>
      <In g at={0} how="drop"><g><Tx s={`${s.day.name}'S TILL`} x={100} y={6} k={2} c="#fff" out={INK} align="c"/></g></In>
      {/* the receipt: a row a desk, each landing with a coin */}
      <In g at={.2} how="up" snd="paper" vol={.3}><g><Box x={8} y={26} w={184} h={22 + rows.length * 17} t={WOOD}/></g></In>
      {rows.map((d, i) => {const y = 32 + i * 17, net = d.took - d.spent;
        return <In key={d.m.id} g at={.6 + i * .3} how="left" snd={net >= 0 ? 'coin' : 'buzz'} vol={.18}><g>
          <Sp r={CLERKS[d.m.id].happy} x={13} y={y - 1} k={.5}/><Tx s={d.m.name} x={32} y={y + 4} c="#3a1f14"/>
          <Tx s={`×${d.jobs}`} x={104} y={y + 4} c="#3a1f14"/>
          {d.wrong > 0 && <g><Sp r={XR} x={126} y={y + 4}/><Tx s={`${d.wrong}`} x={135} y={y + 4} c="#d23c3c"/></g>}
          <Tx s={(net >= -.005 ? '+' : '-') + bucks(Math.abs(net))} x={185} y={y + 4} c={net >= -.005 ? '#1f8a4a' : '#d23c3c'} align="r"/></g></In>;})}
      {/* the day's take, counted up, and the stars */}
      <In g at={.2} how="up"><g><Box x={198} y={26} w={116} h={58} t={DARK}/></g></In>
      <In g at={tot} how="pop" snd="sale" vol={.3}><g><Tx s="MADE" x={205} y={34} c="#cfe0ff"/>
        <Tx s={cash(made * (1 - (1 - u) ** 3))} x={307} y={31} k={2} c={made <= -.005 ? '#ff6b5e' : '#6ef2a0'} align="r"/></g></In>
      {got.map((ok, i) => <In key={i} g at={tot + .9 + i * .3} how="slam" snd={ok ? 'ding' : 'buzz'} vol={.25}><g>
        <Sp r={STAR[ok ? 1 : 0]} x={206 + i * 36} y={50} k={2}/><Tx s={bucks(s.day.stars[i])} x={217 + i * 36} y={72} c={ok ? '#fff' : '#8a90a2'} align="c"/></g></In>)}
      <In g at={tot + 1.9} how="left" snd="ding" vol={.2}><g><Box x={198} y={90} w={116} h={54} t={{o: INK, a: GOLD, f: NAVY}}/><Tx s="TIP" x={205} y={96} c={GOLD}/></g></In>
      <PBtn x={8} y={156} w={42} h={20} s="AGAIN" act={again} t={SIGN} c="#d23c3c"/>
      <PBtn x={54} y={156} w={64} h={20} s="BREAKDOWN" act={() => setMore(true)}/>
      {next && <PBtn x={122} y={156} w={58} h={20} s="NEXT DAY" act={next}/>}
      <PBtn x={next ? 184 : 122} y={156} w={28} h={20} s="MAP" act={back}/>
    </svg>
    {/* the tip's words in the menus' own type: a command is lower case, and the pixel font has none */}
    <In at={tot + 2} how="up" style={{position: 'absolute', left: 205 * PX, top: 106 * PX, width: 104 * PX}}>
      <span style={{display: 'inline-block', padding: '2px 16px', background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 32, color: '#39ff88'}}>{cmd}</span>
      <div style={{...txt(30, 500), marginTop: 8}}>{tip}</div></In>
    <div style={{position: 'absolute', left: 1230, width: 650, top: 0, height: H}}><Keys text={next ? 'Enter again  ·  → next day  ·  Esc map' : 'Enter again  ·  Esc map'}/></div>
    {more && <Sheet title="Breakdown" close={() => setMore(false)}>{billLines(s).map((l, i) => <div key={i} style={{...txt(28, 500, i ? MUTE : '#fff'), marginTop: i ? 10 : 0, maxWidth: 1400}}>{l}</div>)}</Sheet>}
  </div>;
};
