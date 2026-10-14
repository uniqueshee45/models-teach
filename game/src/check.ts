/**
 * The check (build.cjs runs it before every build). It prints what each car does on each road from the real
 * numbers in stats.ts, driven three ways: trusting every call (as the rivals drive), looking at the hard
 * questions, and looking at every fork; and the Opus cars again with fast mode held.
 * Nothing here picks a winner. It fails the build on nonsense, if a road can't be three-starred at all, and if
 * one car could earn every star on every road, because then the game would teach "always pick that one".
 */
import {DT, ROADS, SWAP, carsOf, counts, forksOf, goalsOf as roadGoals, lap, mmss, money, pitOf, raceTip, rateOf as roadRate, run, scoreText, stars, topOf, wait} from './rules';   // (money is the desk's too)
import type {Style} from './rules';
import {CARS, CODE_ALL, INJECT, KINDS, MODELS} from './stats';
import type {ModelId} from './stats';
import {DAYS, WORD, chanceOf as deskChance, costOf, dayStars, gameS, goalsOf, jobsOf, labelOf, play, profit, tipOf} from './desk';
import type {Bot, Shop} from './desk';
import {FIGHTERS, STAGES, dialOf, goalsOf as arenaGoals, mixOf, play as fight, stars as arenaStars, tipOf as arenaTip} from './arena';
import type {Bot as ArenaBot, Fight} from './arena';
import {BUILDERS, SITES, blocksOf, canFast, costOf as blockCost, crackOf, goalsOf as siteGoals, layOf, makeBuild, play as buildTower, stars as towerStars, tick as towerTick} from './blocks';
import type {Bot as BlockBot, Build} from './blocks';
import {CREW, ROOMS, beatOf, canWork, goalsOf as roomGoals, makeBot as shipBot, makeShift, rateOf, roleOf as shipRole, stars as shiftStars, tick as shipTick, waiting as shipWaiting} from './ship';
import type {Bot as ShipBot, Room, Shift} from './ship';
import {CASES, MARKS, STAMPS, leftOf, makeTrial, moveAt, moveOf, newIn, shout, play as trial, stars as courtStars, tipOf as courtTip} from './court';
import type {Bot as CourtBot} from './court';

declare const process: {exit(code: number): never};
const bad: string[] = [];
const ok = (c: boolean, msg: string) => {if (!c) bad.push(msg);};
const full: Record<string, number> = {};   // roads where the car can earn all three stars
const SEEDS = [1, 2, 3];                   // where the wrong calls fall changes per race: every seed must agree
// Every road has all six cars. The coding test of the desk and the tickets road scores each kind of work apart: a
// model's seven scores, weighted by how many tasks each kind has, must come back to the overall score the test prints
// (a typo in one of 42 numbers shows up here).
ok(ROADS.every(r => carsOf(r).length === CARS.length), 'a road is missing a car');
for (const id of CARS) {const c = MODELS[id].code, avg = c.by.reduce((x, p, i) => x + p * KINDS[i].tasks, 0) / CODE_ALL;
  ok(c.by.length === KINDS.length && Math.abs(avg - c.all) < .05, `${MODELS[id].name}: its coding scores by kind average ${avg.toFixed(2)}%, the test prints ${c.all}%`);}
// Haiku 5.5 is priced by prompt length: the open-book road's contract is over 100,000 tokens, the emails' input is not
{const [mail, book] = ['inbox', 'openbook'].map(id => ROADS.find(r => r.id === id)!), h = MODELS.haiku55, s = MODELS.sonnet55;
  ok(Math.abs(roadRate(book, h) / roadRate(mail, h) - h.long!.outP / h.outP) < 1e-9 && roadRate(book, s) === roadRate(mail, s), 'the open-book road should charge the long-prompt price, and only to a car that has one');}

for (const r of ROADS) {
  console.log(`\n${r.name}   ${r.job}   ${r.goals.join(' · ')}`);
  let any = false;
  for (const id of carsOf(r)) {
    const m = MODELS[id], [a, b, c] = counts(r, m);
    console.log(`  ${m.name.padEnd(11)} top ${topOf(r, m).toFixed(1).padStart(5)} m/s   pit ${pitOf(r, m).toFixed(2)} s   calls ${a} right / ${b} not sure / ${c} wrong`);
    let three = false;
    for (const fast of m.fast ? [false, true] : [false]) for (const style of ['trust', 'smart', 'careful'] as Style[]) {
      const runs = SEEDS.map(seed => run(id, r, seed, style, fast)), s = runs[0], n = Math.min(...runs.map(x => stars(x).filter(Boolean).length));
      console.log(`    ${(style + (fast ? ' fast' : '')).padEnd(13)} ${lap(s.t).padStart(7)}  ${money(s.spent).padStart(7)}  ${scoreText(s).padEnd(20)} real ${wait(s.real).padStart(11)}${'★'.repeat(n)}${'☆'.repeat(3 - n)}`);
      for (const x of runs) {
        ok(Number.isFinite(x.t) && Number.isFinite(x.spent), `${r.name} ${m.name} ${style}: not a number`);
        ok(x.right + x.wrong === forksOf(r), `${r.name} ${m.name} ${style}: answers don't add up`);
        if (style === 'trust') ok(x.wrong === c, `${r.name} ${m.name}: trusting every call should hit ${c} walls, hit ${x.wrong}`);
        if (style === 'careful') ok(x.wrong === 0, `${r.name} ${m.name}: looking at every fork should hit no wall, hit ${x.wrong}`);
      }
      if (n === 3) three = true;
    }
    if (three) {full[id] = (full[id] || 0) + 1; any = true;}
  }
  ok(any, `${r.name}: no car can earn three stars`);
}
console.log('\nroads each car can three-star: ' + CARS.map(id => `${MODELS[id].name} ${full[id] || 0}`).join(' · '));
for (const id of CARS) ok((full[id] || 0) < ROADS.filter(r => carsOf(r).includes(id)).length, `${MODELS[id].name} can earn every star on every road it drives`);
// the first card's picture (main.tsx SwapArt): the same two cars on two roads, and the better one changes. On the first
// road both get the same answers right; on the second only the better one knows enough for the road's goal.
SWAP.roads.forEach((rid, k) => {
  const r = ROADS.find(x => x.id === rid)!, [win, lose] = [SWAP.cars[k], SWAP.cars[1 - k]], [a, b] = [win, lose].map(id => counts(r, MODELS[id])[0]);
  ok(roadGoals(win, r) === 3 && roadGoals(lose, r) < 3, `the first card: only ${MODELS[win].name} of its two cars should earn every goal on ${r.name}`);
  ok(k ? a >= r.minRight && b < r.minRight : a === b, `the first card: ${r.name} no longer shows what the card says (${a} right against ${b})`);
});
// the results' tip: never fast mode for a car without it, never "switch to Sonnet 5.5" from Sonnet 5.5, and each kind turns up
const tipped = new Map<string, number>();
for (const r of ROADS) for (const id of carsOf(r)) for (const seed of [1, 2, 3]) for (const style of ['trust', 'careful'] as Style[]) for (const fast of MODELS[id].fast ? [false, true] : [false]) {
  const [cmd, line] = raceTip(run(id, r, seed, style, fast));
  tipped.set(cmd, (tipped.get(cmd) ?? 0) + 1);
  ok(cmd !== '/fast' || !!MODELS[id].fast, `${MODELS[id].name} on ${r.name}: a fast-mode tip for a car without it`);
  ok(!fast || !line.startsWith('The same model, sooner'), `${MODELS[id].name} on ${r.name}: told to turn on fast mode it already used`);
  ok(fast || !line.startsWith('Fast mode costs more'), `${MODELS[id].name} on ${r.name}: told to turn off fast mode it never used`);
  ok(!(cmd === '/model sonnet' && id === 'sonnet55'), `${r.name}: Sonnet 5.5 is told to switch to Sonnet 5.5`);
  ok(!(cmd === '/model haiku' && (id === 'haiku55' || r.id !== 'inbox')), `${MODELS[id].name} on ${r.name}: sent to Haiku 5.5 off the easy emails, or from Haiku 5.5`);
  ok(r.id !== 'tickets' || !line.includes('not sure'), `${MODELS[id].name} on TICKETS: a "not sure" tip on the road where it always says done`);
}
console.log('results tips: ' + [...tipped].map(([c, n]) => `${c} ${n}`).join(' · '));
for (const c of ['CLAUDE.md', '/model opus', '/model sonnet', '/model']) ok(tipped.has(c), `the rally never ends on ${c}`);

/* ---------- world 2, the front desk: each day, played by bots that tap twice a second ---------- */
// A day must not be three-starred by ignoring the cards (the first free desk) or by one desk alone, and a player
// who has learned the desks must three-star it on every draw of the customers.
const DESK_SEEDS = [...Array(12).keys()].map(i => i + 1);
for (const day of DAYS) {
  console.log(`\nFRONT DESK · ${day.name}   ${jobsOf(day)} customers   ${goalsOf(day).join(' · ')}`);
  console.log('  one job at each desk:  ' + day.jobs.map(([k]) => `${WORD[k]} ` + CARS.map(id => `${MODELS[id].name} ${gameS(k, MODELS[id]).toFixed(1)}s ${money(costOf(k, MODELS[id]))}`).join(', ')).join('\n                         '));
  for (const [kind, counts] of day.jobs) counts.forEach((n, t) => {   // a card nobody can answer is not a choice
    if (!n) return;   // a kind the day doesn't bring
    const c = {kind, hard: t + 1}, odds = CARS.map(id => deskChance(c, MODELS[id]));
    console.log(`  ${`${n} ${labelOf(c)}`.padEnd(16)} the signs: ${CARS.map((id, i) => `${MODELS[id].name} ${Math.round(odds[i] * 100)}%`).join(', ')}`);
    ok(Math.max(...odds) >= .4, `${day.name}: no desk knows ${labelOf(c)} (the best sign reads ${Math.round(Math.max(...odds) * 100)}%)`);
  });
  for (const bot of ['sense', 'first', ...CARS] as Bot[]) {
    const runs = DESK_SEEDS.map(seed => play(day, seed, bot)), n = runs.map(s => dayStars(s).filter(Boolean).length), lo = Math.min(...n), hi = Math.max(...n);
    const span = (f: (s: Shop) => number, d = 0) => {const v = runs.map(f), a = Math.min(...v), b = Math.max(...v); return a === b ? a.toFixed(d) : `${a.toFixed(d)}-${b.toFixed(d)}`;};
    console.log(`    ${(MODELS[bot as ModelId]?.name ?? bot).padEnd(11)} made $${span(profit, 2).padEnd(11)} took $${span(s => s.took, 2).padEnd(10)} cost $${span(s => s.spent, 2).padEnd(10)} out ${span(s => s.out).padEnd(6)} right ${span(s => s.right).padEnd(6)} wrong ${span(s => s.wrong).padEnd(6)} "not sure" ${span(s => s.home).padEnd(5)} best run ${span(s => s.bestRun).padEnd(6)} ${'★'.repeat(lo)}${'☆'.repeat(3 - lo)}${hi > lo ? ` to ${'★'.repeat(hi)}` : ''}`);
    for (const s of runs) {
      ok(Number.isFinite(s.spent) && s.t < 600, `${day.name} ${bot}: the day doesn't end`);
      ok(s.right + s.wrong + s.home + s.out === jobsOf(day), `${day.name} ${bot}: customers don't add up`);
    }
    if (bot === 'sense') ok(lo === 3, `${day.name}: a player who knows the desks can't always earn three stars`);
    else ok(hi < 3, `${day.name}: "${bot}" can earn three stars without reading a card`);
  }
  // the till's tip follows the play: sloppy routing gets /model, every email at a dear desk gets the subagent, a good day /usage
  for (const [bot, cmd] of [['first', '/model'], ['opus55', 'model: haiku'], ['sense', '/usage']] as [Bot, string][])
    ok(DESK_SEEDS.every(seed => tipOf(play(day, seed, bot))[0] === cmd), `${day.name}: "${bot}" doesn't always end on ${cmd}`);
}

/* ---------- world 4, the arena: each round, each fighter, each dial setting, fought by bots with a hand's delay ---------- */
// reader: the right fix for every sign. effort: EFFORT UP on every miss (TAG IN or TRY AGAIN at the top). Each takes
// a second to read a new sign (a hand at .6 s and 1.1 s too, for the reader). A round must be three-starred on every
// draw by some fighter and dial with the reader at every hand, never by the effort bot, never at MAX where X-HIGH is
// open (higher is not always better); no dial setting and no fighter earns three stars in every round.
const HANDS = [1, .6, 1.1];
const byDial: Record<string, Set<string>> = {}, byWho: Record<string, Set<string>> = {}, arenaTips = new Map<string, number>();
for (const who of [...FIGHTERS, 'opus5' as ModelId]) console.log(`\nARENA · ${MODELS[who].name}${mixOf(who) === who ? '' : ` (misses in ${MODELS[mixOf(who)].name}'s mix)`}   `
  + dialOf(who).map(L => `${L.name} passes ${L.index}% ${money(L.cost)} busy ${L.busy}s`).join(' · '));
for (const st of STAGES) {
  console.log(`\nARENA · ${st.name}   ${st.jobs} jobs${st.reads ? `, ${st.reads} reads` : ''}${st.old ? `, ${MODELS[st.old].name} first` : ''}   ${arenaGoals(st).join(' · ')}`);
  let any = false;
  for (const who of FIGHTERS) {
    const dial = dialOf(st.old ?? who);
    dial.forEach((L, d) => {
      const lows: number[] = [];
      for (const bot of ['reader', 'effort'] as ArenaBot[]) for (const hand of bot === 'reader' ? HANDS : [1]) {
        const runs = DESK_SEEDS.map(seed => fight(st, who, seed, bot, d, hand)), n = runs.map(f => arenaStars(f).filter(Boolean).length), lo = Math.min(...n), hi = Math.max(...n);
        const span = (g: (f: Fight) => number, k = 0) => {const v = runs.map(g), a = Math.min(...v), b = Math.max(...v); return a === b ? a.toFixed(k) : `${a.toFixed(k)}-${b.toFixed(k)}`;};
        if (hand === 1) console.log(`  ${(st.old ? `${MODELS[st.old].name}, ${MODELS[who].name} on the bench` : MODELS[who].name).padEnd(26)} ${L.name.padEnd(7)} ${bot.padEnd(7)} spent $${span(f => f.spent, 2).padEnd(12)} tries ${span(f => f.tries).padEnd(6)} wrong ${span(f => f.wrong).padEnd(5)} past ${span(f => f.past).padEnd(4)} ${runs.filter(f => f.won).length}/${runs.length} won  ${'★'.repeat(lo)}${'☆'.repeat(3 - lo)}${hi > lo ? ` to ${'★'.repeat(hi)}` : ''}`);
        for (const f of runs) {
          ok(Number.isFinite(f.spent) && f.t < 600, `${st.name} ${who} ${L.name} ${bot}: the fight doesn't end`);
          ok(f.ko + f.past === st.jobs || f.hearts === 0, `${st.name} ${who} ${L.name} ${bot}: jobs don't add up`);
          if (hand === 1) {const cmd = arenaTip(f, d)[0]; arenaTips.set(cmd, (arenaTips.get(cmd) ?? 0) + 1);   // the result's tip: never "effort up" for the bot whose wrong fixes were all EFFORT UP
            ok(!(bot === 'effort' && f.wrong && cmd === '/effort'), `${st.name} ${who} ${L.name}: told to turn effort up after EFFORT UP was the wrong fix`);}
        }
        if (bot === 'reader') lows.push(lo);
        else ok(hi < 3, `${st.name}: ${MODELS[who].name} at ${L.name} earns three stars with EFFORT UP on every miss`);
      }
      if (Math.min(...lows) === 3) {any = true; (byDial[L.name] ??= new Set()).add(st.id); (byWho[who] ??= new Set()).add(st.id);
        ok(L.name !== 'MAX' || !dial.some(x => x.name === 'X-HIGH'), `${st.name}: ${MODELS[who].name} earns three stars at MAX with X-HIGH open`);}
    });
  }
  ok(any, `${st.name}: no fighter and dial always earns three stars reading every miss right`);
}
console.log('\narena results tips: ' + [...arenaTips].map(([c, n]) => `${c} ${n}`).join(' · '));
console.log('\nrounds three-starred, reading right, by dial setting: ' + Object.entries(byDial).map(([k, v]) => `${k} ${v.size}`).join(' · ')
  + '; by fighter: ' + FIGHTERS.map(id => `${MODELS[id].name} ${byWho[id]?.size ?? 0}`).join(' · '));
for (const [k, v] of Object.entries(byDial)) ok(v.size < STAGES.length, `the dial at ${k} earns every star in every round`);
for (const id of FIGHTERS) ok((byWho[id]?.size ?? 0) < STAGES.length, `${MODELS[id].name} can earn every star in every round`);

/* ---------- world 3, the blocks: each site, each builder (the Opus models in fast mode too), built by bots ---------- */
// meter: a check when the risk passes a third, as a person watching the meter would. each: after every block.
// never: only once the tower is up. A site must be three-starred on every draw by some builder playing by the meter,
// never without checking, and no builder (in either mode) earns every star on every site.
const built: Record<string, Set<string>> = {};
for (const st of SITES) {
  console.log(`\nBLOCKS · ${st.job}   ${blocksOf(st)} blocks   a check waits ${st.checkS} s   ${siteGoals(st).join(' · ')}`);
  let any = false;
  for (const id of BUILDERS) for (const fast of canFast(id) ? [false, true] : [false]) {
    const m = MODELS[id], name = m.name + (fast ? ' FAST' : '');
    console.log(`  ${name.padEnd(14)} a block: ${money(blockCost(m, fast))}, ${layOf(m, fast).toFixed(2)} s   cracks: ${st.mix.map(([k]) => `${k} ${Math.round(crackOf(m, k) * 100)}%`).join(', ')}`);
    for (const bot of ['meter', 'each', 'never'] as BlockBot[]) {
      const runs = DESK_SEEDS.map(seed => buildTower(st, id, seed, bot, fast)), n = runs.map(b => towerStars(b).filter(Boolean).length), lo = Math.min(...n), hi = Math.max(...n);
      const span = (g: (b: Build) => number, d = 0) => {const v = runs.map(g), a = Math.min(...v), b = Math.max(...v); return a === b ? a.toFixed(d) : `${a.toFixed(d)}-${b.toFixed(d)}`;};
      console.log(`    ${String(bot).padEnd(6)} time ${span(b => b.t).padEnd(8)} spent $${span(b => b.spent, 2).padEnd(14)} laid ${span(b => b.laid).padEnd(7)} fell ${span(b => b.lost).padEnd(6)} checks ${span(b => b.checks).padEnd(6)} ${runs.filter(b => b.won).length}/${runs.length} done  ${'★'.repeat(lo)}${'☆'.repeat(3 - lo)}${hi > lo ? ` to ${'★'.repeat(hi)}` : ''}`);
      for (const b of runs) {
        ok(Number.isFinite(b.spent) && b.t <= st.dark + 1, `${st.job} ${name} ${bot}: the day doesn't end`);
        ok(b.laid === b.lost + b.tower.length && (!b.won || b.ok === blocksOf(st)), `${st.job} ${name} ${bot}: blocks don't add up`);
      }
      if (bot === 'meter' && lo === 3) {any = true; (built[id] ??= new Set()).add(st.id);}
      if (bot === 'never') ok(hi < 3, `${st.job}: ${name} can earn three stars without one check before the end`);
    }
  }
  ok(any, `${st.job}: no builder always earns three stars checking by the meter`);
}
console.log('\nsites each builder three-stars, checking by the meter: ' + BUILDERS.map(id => `${MODELS[id].name} ${built[id]?.size ?? 0}`).join(' · '));
for (const id of BUILDERS) ok((built[id]?.size ?? 0) < SITES.length, `${MODELS[id].name} can earn every star on every site`);
// A fallen block is built again from nothing. The user saw a cracked block "still there": its twin had landed the
// moment it fell, because the block that was coming kept its progress through the check. Tapped as late as a hand can.
{
  const b = makeBuild(SITES[0], 'sonnet5', 1), whole = layOf(b.m);   // its MEDIUM blocks crack often enough for one here
  let since = whole, cracks = 0;
  while (!b.end) {
    since += 1 / 60;
    for (const e of towerTick(b, b.tower.length > b.ok && (b.lay > whole * .9 || b.tower.length === b.plan.length))) {
      if (e.k === 'crack') {since = 0; cracks++;}
      if (e.k === 'lay') ok(since >= whole - 1e-6, `blocks: a block landed ${since.toFixed(2)} s after a crack, sooner than the ${whole.toFixed(2)} s it takes to lay`);
    }
  }
  ok(cracks > 0, 'blocks: the rebuild test saw no crack');
}

/* ---------- world 6, the ship: each shift, each crew member with a published number for it, played by rules in both roles ---------- */
// The watcher's Mebs: sharp (always answers right), tired (YES to one hidden order in three), stamper (YES to everything).
// The impostors: patient (tries only while a console is ringing), reckless (tries the moment a read is over).
// The watcher must never stand idle for long; a sharp one must be able to three-star every shift with some crew; saying
// YES to everything must fail where the crew gives in half the time, and there a tired one must do worse than with the
// shift's hardest crew.
// A patient impostor must get its tries in, win where the crew gives in half the time, rarely beat a shift's hardest
// crew, and be voted out less often than a reckless one.
// the fourth card's line (shipview.tsx): the smallest model holds up best against the attacker that studied the coding jobs
ok([...CREW].sort((a, b) => INJECT[a]!.probes! - INJECT[b]!.probes!)[0] === CARS[0], 'the ship\'s "Bigger is not safer" card: the smallest model no longer holds up best with the probes on');
const SHIP_SEEDS = [...Array(40).keys()].map(i => i * 7919 % 9973 + 1), IDLE_S = 6;   // IDLE_S: the longest a watcher may have nothing to answer and nothing to run to
const shareOf = (ss: Shift[], f: (s: Shift) => boolean) => ss.filter(f).length / ss.length, pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);
const midOf = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1], three = (s: Shift) => shiftStars(s).every(Boolean);
/** A shift played by rules, and the longest stretch before the vote in which Meb had nothing to answer and nothing to run to. */
function shipRun(r: Room, id: ModelId, seed: number, bot: ShipBot) {
  const s = makeShift(r, id, seed, shipRole(bot)), f = shipBot(bot, seed);
  let idle = 0, worst = 0, rush = 0;
  while (!s.end) {
    shipTick(s, f(s));
    if (s.clean || s.meet) continue;
    idle = shipWaiting(s) || s.alarm ? 0 : idle + DT;
    worst = Math.max(worst, idle);
    if (s.rush > 0) rush += DT;
  }
  return {s, idle: worst, rush: rush / s.t};
}
for (const r of ROOMS) {
  console.log(`\nSHIP · ${r.place} · ${r.tag}   ${r.files} files, ${r.tasks} reads each (${r.asks} ask), a try every ${r.cool} s, the scene holds ${r.freeze} s   ${roomGoals(r).join(' · ')}   as the impostor: ${roomGoals(r, 'imp').join(' · ')}`);
  const crew = CREW.filter(id => canWork(r, id)), byRate = [...crew].sort((a, b) => rateOf(r, a) - rateOf(r, b)), hard = byRate[0], easy = byRate[byRate.length - 1];
  const full: Partial<Record<ShipBot, Partial<Record<ModelId, number>>>> = {}, out: Record<string, number> = {};
  for (const id of CREW) {
    const m = MODELS[id];
    if (!canWork(r, id)) {console.log(`  ${m.name}: no published number for this shift`); continue;}
    console.log(`  ${m.name.padEnd(11)} a try fools it ${(rateOf(r, id) * 100).toFixed(2)}%   reads a file in ${beatOf(m).toFixed(2)} s`);
    for (const bot of ['sharp', 'tired', 'stamper', 'patient', 'reckless'] as ShipBot[]) {
      const runs = SHIP_SEEDS.map(seed => shipRun(r, id, seed, bot)), ss = runs.map(x => x.s), imp = shipRole(bot) === 'imp', ts = ss.map(s => s.t), idles = runs.map(x => x.idle);
      const avg = (g: (s: Shift) => number) => (ss.reduce((a, s) => a + g(s), 0) / ss.length).toFixed(1), won = shareOf(ss, s => s.won), all = shareOf(ss, three);
      (full[bot] ??= {})[id] = all;
      console.log(`    ${bot.padEnd(8)} time ${midOf(ts).toFixed(0).padStart(3)} (${Math.min(...ts).toFixed(0)}-${Math.max(...ts).toFixed(0)})  tries ${avg(s => s.strikes)}  fooled ${avg(s => s.fooled)}  through ${avg(s => s.obeyed)}  `
        + (imp ? `won ${pct(won)}  unseen ${pct(shareOf(ss, s => !s.heat))}  voted out ${pct(shareOf(ss, s => s.clean))}  Meb rushed ${pct(runs.reduce((a, x) => a + x.rush, 0) / runs.length)}`
          : `done ${pct(won)}  on time ${pct(shareOf(ss, s => shiftStars(s)[1]))}  out at ${midOf(ss.map(s => s.outAt || r.dark)).toFixed(0)} s  idle ${midOf(idles).toFixed(1)} s (worst ${Math.max(...idles).toFixed(1)})`) + `  ★★★ ${pct(all)}`);
      for (const s of ss) {
        ok(s.t <= r.dark + 1, `${r.place} ${m.name} ${bot}: the shift doesn't end`);
        ok(s.files.filter(f => f.bad).length === 1 && !s.files.some(f => f.bad && f.clear), `${r.place} ${m.name} ${bot}: the carrier was cleared`);
        ok(s.fooled <= s.strikes && s.obeyed + s.stopped <= s.fooled, `${r.place} ${m.name} ${bot}: the tries don't add up`);
        if (bot === 'sharp') ok(!s.obeyed && !s.noes && !s.wrong, `${r.place} ${m.name}: the sharp watcher got something wrong`);
        if (imp) ok(s.won === (s.obeyed > 0), `${r.place} ${m.name} ${bot}: the impostor wins when its order gets its way, and only then`);
      }
      if (bot === 'sharp') ok(midOf(idles) <= IDLE_S, `${r.place} ${m.name}: a watcher usually has nothing to do for ${midOf(idles).toFixed(1)} s`);
      if (bot === 'stamper' && rateOf(r, id) >= .5) ok(all <= .5, `${r.place} ${m.name}: saying YES to everything earns three stars on ${pct(all).trim()} of shifts`);
      // the impostor: its odds are the model's number, so only where a crew gives in half the time must it usually win
      if (bot === 'patient' && rateOf(r, id) >= .5) ok(won >= .85, `${r.place}: a patient impostor beats ${m.name}, which gives in half the time, on only ${pct(won).trim()} of shifts`);
      if (bot === 'patient' && id === hard) ok(won <= .2, `${r.place}: a patient impostor beats ${m.name}, the hardest crew, on ${pct(won).trim()} of shifts`);
      if (bot === 'patient') ok(+avg(s => s.strikes) >= 2.5 || won >= .5, `${r.place} ${m.name}: a patient impostor gets only ${avg(s => s.strikes)} tries a shift`);
      if (imp) out[bot + id] = shareOf(ss, s => s.clean);
      if (bot === 'reckless') ok(out['patient' + id] < out[bot + id], `${r.place} ${m.name}: a reckless impostor is voted out no more often than a patient one`);
    }
  }
  const best = (bot: ShipBot) => crew.filter(id => full[bot]![id] === Math.max(...crew.map(x => full[bot]![x]!)));
  ok(Math.max(...crew.map(id => full.sharp![id]!)) >= .9, `${r.place}: no crew earns three stars with a sharp watcher on nine shifts in ten`);
  // the pick has to matter to a tired watcher: a crew that gives in half the time costs it stars
  for (const id of crew) if (rateOf(r, id) >= .5) ok(full.tired![id]! <= full.tired![hard]! - .2, `${r.place}: a tired watcher does as well with ${MODELS[id].name} as with ${MODELS[hard].name}`);
  console.log(`  best for a tired watcher: ${best('tired').map(id => MODELS[id].name).join(', ')}   easiest for the impostor: ${MODELS[easy].name}, hardest: ${MODELS[hard].name}`);
}

/* ---------- world 5, the court: each case, each deal, tried by bots ---------- */
// reader: knows every stamp's move. objector and waiter: one shout at every line. rester: rests at once. random: a
// coin per line. The reader must three-star every case on every deal and nobody else may; every line has one right
// move, a WAIT! line has three cards, a rule about saved instructions only shows where there are some; and the
// result's tip has to fit what happened.
const courtTips = new Map<string, number>(), stamped = new Set<string>(), words = (s: string) => s.trim().split(/\s+/).length;
for (const c of CASES) {
  const need = c.lines.filter(l => moveOf(l) === 'wait').length, cut = new Set(c.lines.filter(l => moveOf(l) === 'object').map(l => l.mate ?? l.text)).size;
  console.log(`\nCOURT · ${c.name}   ${c.lines.length} lines: ${need} to say better, ${cut} to strike, ${c.lines.filter(l => !l.stamp).length} fine   new: ${newIn(c).map(s => STAMPS[s].name).join(', ')}`);
  ok(need > 0 && cut > 0, `${c.name}: a case needs a line to say better and a line to strike`);
  ok(!c.lines[0].stamp, `${c.name}: the job line comes first and is fine`);
  for (const l of c.lines) {
    if (l.stamp) stamped.add(l.stamp);
    // one line may be long on purpose: the long how-to inside the notes, which POINT TO IT is about. It has to look long.
    ok(l.long ? words(l.text) >= 25 && l.stamp === 'point' : words(l.text) <= 9, `${c.name}: "${l.text}" is over nine words (or is the long line, and is not long)`);
    ok((moveOf(l) === 'wait') === !!l.fix, `${c.name}: "${l.text}" has cards if and only if it is a WAIT! line`);
    if (l.fix) ok(new Set(l.fix).size === 3 && l.fix.every(x => words(x) <= 12), `${c.name}: "${l.text}" needs three different cards of twelve words or fewer`);
    if (l.stamp && STAMPS[l.stamp].saved) ok(!!c.saved, `${c.name}: ${STAMPS[l.stamp].name} is a rule about saved instructions, and this case has none`);
    if (l.mate) ok(moveOf(l) === 'object' && c.lines.filter(x => x.mate === l.mate).length === 2 && c.lines.every(x => x.mate !== l.mate || x.stamp === l.stamp), `${c.name}: a pair has two halves under one stamp`);
    if (l.keep) ok(!l.stamp, `${c.name}: "${l.text}" has a reason to stay and a stamp`);
  }
  ok(c.lines.filter(l => l.long).length <= 1, `${c.name}: more than one long line`);
  // a pair: keep one. Alone, a half is fine; with both heard, an OBJECTION! at either strikes that one and settles the pair.
  for (const mate of new Set(c.lines.flatMap(l => l.mate ? [l.mate] : []))) for (const which of [0, 1]) {
    const t = makeTrial(c, 7), a = t.rows.findIndex(r => r.line.mate === mate), hit = a + which;
    ok(t.rows[a + 1].line.mate === mate, `${c.name}: the pair "${mate}" was dealt apart`);
    ok(shout(t, a, 'object', a + 1)?.k === 'wrong' && t.rows[a].st === 'raw', `${c.name}: half of "${mate}" was struck before its other half was heard`);
    ok(shout(t, hit, 'object')?.k === 'struck' && t.rows[2 * a + 1 - hit].st === 'raw', `${c.name}: an objection to "${mate}" has to strike one half and keep the other`);
    ok(moveAt(t, 2 * a + 1 - hit) === 'pass' && !leftOf(t).includes(t.rows[a].line.stamp!) && shout(t, 2 * a + 1 - hit, 'object')?.k === 'wrong', `${c.name}: the half of "${mate}" that was kept is not fine`);
  }
  for (const bot of ['reader', 'objector', 'waiter', 'rester', 'random'] as CourtBot[]) {
    const runs = DESK_SEEDS.map(seed => trial(c, seed, bot)), n = runs.map(t => courtStars(t).filter(Boolean).length), lo = Math.min(...n), hi = Math.max(...n);
    const span = (g: (t: typeof runs[0]) => number) => {const v = runs.map(g), a = Math.min(...v), b = Math.max(...v); return a === b ? `${a}` : `${a}-${b}`;};
    console.log(`  ${bot.padEnd(9)} wrong shouts ${span(t => t.wrong).padEnd(4)} left on the record ${span(t => leftOf(t).length).padEnd(4)} ${runs.filter(t => t.dismissed).length}/${runs.length} dismissed  ${'★'.repeat(lo)}${'☆'.repeat(3 - lo)}${hi > lo ? ` to ${'★'.repeat(hi)}` : ''}`);
    if (bot === 'reader') ok(lo === 3, `${c.name}: knowing every rule doesn't earn three stars`);
    else ok(bot === 'random' ? lo < 3 : hi < 3, `${c.name}: the ${bot} bot can earn three stars`);
    for (const t of runs) {
      const [cmd, tip] = courtTip(t), left = leftOf(t);
      courtTips.set(cmd, (courtTips.get(cmd) ?? 0) + 1);
      ok(t.marks === MARKS - t.wrong && t.dismissed === t.marks <= 0, `${c.name} ${bot}: the patience marks don't add up`);
      ok(!tip.startsWith('Name the finish line') || left.includes('finish'), `${c.name} ${bot}: told to name a finish line that is on the record`);
      ok(cmd !== '/doctor' || !!c.saved, `${c.name} ${bot}: /doctor is for saved instructions, and this case has none`);
      ok(t.rows.every((x, i) => !x.line.mate || t.rows[i - 1]?.line.mate === x.line.mate || t.rows[i + 1]?.line.mate === x.line.mate), `${c.name} ${bot}: a pair was dealt apart`);
      ok(!tip.startsWith('Remembered') || !t.wrong && !left.length, `${c.name} ${bot}: the clean-run tip after a slip`);
    }
  }
}
for (const s of Object.keys(STAMPS)) ok(stamped.has(s), `court: no line carries the stamp ${s}`);
console.log('\ncourt results tips: ' + [...courtTips].map(([c, n]) => `${c} ${n}`).join(' · '));

if (bad.length) {console.error('\nCHECK FAILED\n  ' + bad.join('\n  ')); process.exit(1);}
console.log('\ncheck passed');
