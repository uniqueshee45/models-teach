/**
 * The cards a world opens with, before its first round: what the idea is, how it works in Claude, and Anthropic's own
 * words for the facts (the user's call, 2026-10-05: explain the concept, not a practice round). One idea a card.
 * They show once per world; HOW IT WORKS on the picking screen brings them back. A quote stays a few words, in
 * quotation marks, with who said it and where. That byline, and a card's source line, are links to the page they were
 * read from (the user, 2026-10-12: "make it clickable and open the source of truth link"): a quote can't be written
 * without its `to`, and a `src` is built from `Proof`s, or the type check fails.
 * A card plays like a game's training screen, not a page (the user, 2026-10-05: "more lively/animated, and easier to
 * read"): a wipe, the title slams in, the line's words land one by one with its key words in gold (*like this*), then
 * the drawing builds in reading order, each part with its sound (`In`), and the quote comes last. Drawings that move
 * read the card's clock (`useT`).
 */
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {MONO} from '../../remotion/src/meb-hatch/rig';
import {sfx} from './sound';
import {Button, GOLD, Hit, INK, Icon, MUTE, Proof, UI, txt} from './ui';

export type Card = {title: string; lines: string[]; quote?: {text: string; who: string; to: string}; src?: React.ReactElement; art?: React.ReactNode; qAt?: number};
// ':2': every world's cards open by themselves once more, in any browser (the user asked to see them all again, 2026-10-06). Bump it to do that again.
const K = (key: string) => key + ':2';
export const seen = (key: string) => {try {return !!localStorage.getItem(K(key));} catch {return true;}};
export const markSeen = (key: string) => {try {localStorage.setItem(K(key), '1');} catch { /* private window: show them again next time */ }};

/** A menu screen can provide its own clock, so the same drawings move there too. */
export const Clock = createContext(0);
/** Seconds since this card opened, for a drawing that moves: a fighter breathing, an aura charging, a number counting. */
export const useT = () => useContext(Clock);
/** The keyframes `In` uses; a menu screen that lands its parts with `In` puts this in a <style> too. */
export const ANIM = `@keyframes pym-pop{0%{opacity:0;transform:scale(.3)}65%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}
@keyframes pym-up{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}
@keyframes pym-left{from{opacity:0;transform:translateX(-90px)}to{opacity:1;transform:none}}
@keyframes pym-drop{0%{opacity:0;transform:translateY(-160px)}70%{opacity:1;transform:translateY(8px)}100%{opacity:1;transform:none}}
@keyframes pym-slam{0%{opacity:0;transform:scale(2.4)}55%{opacity:1;transform:scale(.92)}100%{opacity:1;transform:none}}
@keyframes pym-wipe{from{transform:translateX(-1000px) skewX(-20deg)}to{transform:translateX(2300px) skewX(-20deg)}}
@keyframes pym-drift{to{transform:translateX(83px)}}
@keyframes pym-nudge{0%,100%{transform:none}50%{transform:scale(1.08)}}
[data-ui=cards] a{padding:12px 0}
@media (prefers-reduced-motion:reduce){[data-ui=cards] *{animation:none!important}}`;

/** A part of a card that lands `at` seconds after the card opens, with its sound. `g` for a part inside an svg. */
export const In: React.FC<{at: number; how?: 'pop' | 'up' | 'left' | 'drop' | 'slam'; snd?: string; vol?: number; g?: boolean; style?: React.CSSProperties; children: React.ReactNode}> =
  ({at, how = 'pop', snd, vol = .2, g, style, children}) => {
  const s: React.CSSProperties = {animation: `pym-${how} ${how === 'slam' ? .45 : .4}s ease-out ${at}s both`, ...style};
  const start = (e: React.AnimationEvent) => {if (snd && e.target === e.currentTarget) sfx(snd, vol);};
  return g ? <g style={{...s, transformBox: 'fill-box', transformOrigin: 'center'}} onAnimationStart={start}>{children}</g>
    : <div style={s} onAnimationStart={start}>{children}</div>;
};
/** A link on a card. It can't be tapped before it has landed (`at`): a tap anywhere on a card is "next", and one that
 *  fell on a link nobody can see yet would open a page. (ANIM makes a card's links taller than their text, for a thumb.) */
export const Cite: React.FC<{to: string; at: number; children: React.ReactNode}> = ({to, at, children}) =>
  <Proof to={to} style={{pointerEvents: useT() < at ? 'none' : undefined}}>{children}</Proof>;
/** A number that counts up from 0 once `at` is reached. */
export const Count: React.FC<{to: number; at: number}> = ({to, at}) => {const u = Math.max(0, Math.min(1, (useT() - at) / .6)); return <>{Math.round(to * (1 - (1 - u) ** 3))}</>;};
/** Text typed out a letter at a time from `at`, with a key click for each. */
export const Typed: React.FC<{text: string; at: number}> = ({text, at}) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((useT() - at) * 20)));
  useEffect(() => {if (n > 0) sfx('key', .15);}, [n]);
  return <>{text.slice(0, n)}</>;
};

export const Explain: React.FC<{tag: string; cards: Card[]; last: string; done: () => void}> = ({tag, cards, last, done}) => {
  const [i, setI] = useState(0), c = cards[i], end = i === cards.length - 1;
  const t0 = useRef(performance.now()), [t, setT] = useState(0);
  useEffect(() => {let raf = 0; const f = () => {setT((performance.now() - t0.current) / 1000); raf = requestAnimationFrame(f);}; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);}, []);
  const go = (d: number) => {const n = i + d; if (n >= cards.length) return done(); if (n >= 0) {t0.current = performance.now(); setT(0); setI(n);}};
  useEffect(() => {   // ahead of the world's own keys, which stay quiet while the cards are up
    const kd = (e: KeyboardEvent) => {
      const k = e.key, act = k === 'Enter' || k === ' ' || k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'Escape' ? 0 : null;
      if (act === null) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (act) go(act); else done();
    };
    addEventListener('keydown', kd, true);
    return () => removeEventListener('keydown', kd, true);
  }, [i]);
  const q = (s: string) => <span style={{color: GOLD, fontSize: '1.3em', lineHeight: 0}}>{s}</span>;
  // the line, a word at a time; *starred* words are the ones to take away, in gold
  // (glue: no space before it, like the comma straight after a gold phrase)
  const words: {w: string; hot: boolean; glue: boolean}[] = [];
  let prev = ' ';
  for (const p of c.lines.join(' ').split(/(\*[^*]+\*)/)) {
    if (p.startsWith('*')) words.push({w: p.slice(1, -1), hot: true, glue: words.length > 0 && !/\s$/.test(prev)});
    else p.split(' ').forEach((w, k) => {if (w) words.push({w, hot: false, glue: k === 0 && words.length > 0});});
    prev = p;
  }
  const step = Math.min(.06, .7 / Math.max(1, words.length)), qAt = c.qAt ?? 2;
  return <div data-ui="cards" onClick={() => go(1)} style={{position: 'absolute', inset: 0, zIndex: 5, cursor: 'pointer', color: '#fff', overflow: 'hidden', background: 'radial-gradient(circle at 50% 85%, #26174d, #0a0818 70%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 100px 40px', boxSizing: 'border-box'}}>
    <style>{ANIM}</style>
    <div style={{position: 'absolute', top: 0, bottom: 0, left: -200, right: -200, pointerEvents: 'none', animation: 'pym-drift 3s linear infinite',
      background: 'repeating-linear-gradient(-70deg, transparent 0 70px, rgba(255,255,255,.035) 70px 78px)'}}/>
    <Clock.Provider value={t}><React.Fragment key={i}>
      <div onAnimationStart={() => sfx('swish', .3)} style={{position: 'absolute', top: -100, bottom: -100, left: 0, width: 700, zIndex: 3, pointerEvents: 'none', background: GOLD,
        boxShadow: '0 0 0 14px rgba(255,255,255,.5)', animation: 'pym-wipe .5s ease-in both'}}/>
      <In at={.05} how="left" style={{alignSelf: 'flex-start'}}><div style={{padding: '8px 24px', background: GOLD, transform: 'skewX(-10deg)', ...txt(26, 700, INK)}}>{tag} · {i + 1} / {cards.length}</div></In>
      <In at={.15} how="slam" style={{marginTop: 4}}><div style={{...txt(78, 700), transform: 'skewX(-6deg)', textAlign: 'center', textShadow: '0 8px 0 rgba(0,0,0,.35)'}}>{c.title}</div></In>
      {words.length > 0 && <div style={{...txt(38, 500), maxWidth: 1720, textAlign: 'center', marginTop: 12}}>{words.map((x, k) => <React.Fragment key={k}>{k > 0 && !x.glue && ' '}
        <span style={{display: 'inline-block', color: x.hot ? GOLD : '#fff', fontWeight: x.hot ? 700 : 500, animation: `pym-up .3s ease-out ${.3 + k * step}s both`}}>{x.w}</span></React.Fragment>)}</div>}
      <div style={{flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><In at={.45} how="up">{c.art}</In></div>
      {c.quote && <In at={qAt} how="up" style={{maxWidth: 1600, textAlign: 'center'}}><div style={txt(36, 500, '#fff3c4')}>{q('“')}{c.quote.text}{q('”')}</div>
        <div style={{...txt(24, 500, MUTE), marginTop: 8}}><Cite to={c.quote.to} at={qAt + .3}>{c.quote.who}</Cite></div></In>}
      {c.src && <In at={qAt} how="up" style={{...txt(22, 500, MUTE), marginTop: 8, pointerEvents: t < qAt + .3 ? 'none' : undefined}}>Source: {c.src}</In>}
    </React.Fragment></Clock.Provider>
    <div style={{alignSelf: 'stretch', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{width: 520}}>{i > 0 && <Button icon="back" act={() => go(-1)}/>}</div>
      <div style={{display: 'flex', gap: 10}}>{cards.map((_, k) => <div key={k} style={{width: 22, height: 30, borderRadius: 5, transform: 'skewX(-10deg)', background: k < i ? '#b9a3ff' : k === i ? GOLD : 'rgba(255,255,255,.15)'}}/>)}</div>
      <div style={{width: 520, display: 'flex', gap: 24, justifyContent: 'flex-end', alignItems: 'center'}}>
        {!end && <Button label="Skip" act={done}/>}
        <div key={i} style={{animation: `pym-nudge 1s ease-in-out ${qAt + .8}s infinite`}}><Hit label={end ? last : 'Next'} icon="arrow" act={() => go(1)} size={40}/></div></div>
    </div>
  </div>;
};

/** What the two kinds of thing on a moves card are, for someone who has never opened Claude Code (the review of
 *  2026-10-06: the commands and CLAUDE.md were shown and never explained). A card gets only the kinds it uses. */
const KINDS: [RegExp, string, string][] = [[/(^|[\s"(])\/[a-z]/, '/…', 'a command you type in Claude Code'],
  [/CLAUDE\.md/, 'CLAUDE.md', 'a notes file you write. Claude reads it every time it starts']];
/** The game's moves and their Claude Code commands, row by row from `at`, each command typed out:
 *  [the move, the command or file ('' for none), what it does, in plain words ('' for nothing)]. `chip` is the
 *  world's own chip look. Under the rows, once they have landed: what a slash command and CLAUDE.md are. */
export const Moves: React.FC<{rows: string[][]; at?: number; chip: React.CSSProperties}> = ({rows, at = .5, chip}) => {
  const all = rows.map(r => `${r[1]} ${r[2]}`).join(' '), kinds = KINDS.filter(k => k[0].test(all));
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
    <div style={{display: 'grid', gridTemplateColumns: 'auto 50px auto', columnGap: 22, rowGap: 22, alignItems: 'center'}}>{rows.map(([fx, cmd, what], r) => {const a = at + r * .4;
      return <React.Fragment key={fx}>
        <In at={a} how="left" snd="swish" vol={.12} style={{justifySelf: 'end'}}><div style={{...chip, ...txt(32, 700, INK)}}>{fx}</div></In>
        <In at={a + .1} how="left"><Icon name="arrow" size={40}/></In>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>{cmd && <In at={a + .15}><span style={{display: 'inline-block', padding: '6px 20px', borderRadius: 12, background: '#0b1310', border: '2px solid #39ff88', fontFamily: MONO, fontSize: 32, color: '#39ff88'}}>
          <Typed text={cmd} at={a + .2}/><span style={{opacity: .6}}>▌</span></span></In>}
          {what && <In at={a + .2 + cmd.length / 20} how="up"><span style={txt(30, 500, MUTE)}>{what}</span></In>}</div></React.Fragment>;})}</div>
    {kinds.length > 0 && <In at={movesDone(rows, at)} how="up" snd="blip" vol={.12}><div style={{display: 'flex', gap: 50, padding: '10px 28px', borderRadius: 14, background: 'rgba(255,255,255,.07)'}}>
      {kinds.map(([, k, w]) => <span key={k} style={{display: 'flex', alignItems: 'baseline', gap: 14, ...txt(26, 500, MUTE)}}><span style={{fontFamily: MONO, color: '#39ff88'}}>{k}</span>{w}</span>)}</div></In>}
  </div>;
};
/** When the last row of `Moves` has landed, for its card's quote. */
export const movesDone = (rows: string[][], at = .5) => at + (rows.length - 1) * .4 + .5 + rows[rows.length - 1][1].length / 20;

/** Rows of numbers as bars, for a card: a label, the bar, and its value in words. Row by row from `at`, each bar growing. */
export const Bars: React.FC<{rows: {label: string; v: number; text: string; c?: string}[]; max?: number; w?: number; lw?: number; at?: number}> = ({rows, max, w = 1100, lw = 340, at = .6}) => {
  const t = useT(), top = max ?? Math.max(...rows.map(r => r.v)), bw = w - lw - 220;
  return <svg width={w} height={rows.length * 62} style={{overflow: 'visible'}}>{rows.map((r, k) => {const a = at + k * .25, u = 1 - (1 - Math.max(0, Math.min(1, (t - a - .1) / .6))) ** 3;
    return <In key={r.label} g at={a} how="left" snd="blip" vol={.15}><g transform={`translate(0 ${k * 62})`}>
      <text x={lw - 20} y={38} textAnchor="end" fontFamily={UI} fontWeight={700} fontSize={30} fill="#fff">{r.label}</text>
      <rect x={lw} y={10} width={bw} height={38} rx={19} fill="rgba(255,255,255,.12)"/>
      <rect x={lw} y={10} width={Math.max(38, bw * r.v / top) * u} height={38} rx={19} fill={r.c ?? GOLD}/>
      <text x={lw + bw + 20} y={38} fontFamily={UI} fontWeight={700} fontSize={30} fill="#fff" opacity={u}>{r.text}</text></g></In>;})}</svg>;
};
