/**
 * Build the game into channel/game/dist/ — open dist/index.html in a browser, or zip dist/ for itch.io.
 *   node channel/game/build.cjs
 * Runs the balance check (src/check.ts) first and stops if it fails. Uses the esbuild, three and React that
 * channel/remotion already has installed; 'remotion' itself is swapped for src/shim-remotion.tsx.
 * The public repo (github.com/uniqueshee45/models-teach) has the same layout with its own node_modules at the top,
 * and no video sounds: there dist/sfx is committed and kept.
 */
const fs = require('fs'), os = require('os'), path = require('path'), {execFileSync} = require('child_process');
const here = __dirname, channel = path.dirname(here), remotion = path.join(channel, 'remotion');
const esbuild = require(require.resolve('esbuild', {paths: [remotion, channel]}));
// the sound list lives once, in src/sound.ts
const SOUNDS = JSON.parse(fs.readFileSync(path.join(here, 'src/sound.ts'), 'utf8').match(/SOUNDS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const SFX = path.join(channel, 'episodes/opus-55-update/sfx');
const FFMPEG = path.join(channel, '../lib/ffmpeg/ffmpeg-7.0-essentials_build/ffmpeg.exe');
const dist = path.join(here, 'dist');
const common = {absWorkingDir: here, bundle: true, jsx: 'automatic', logLevel: 'warning',
  nodePaths: [path.join(remotion, 'node_modules')], alias: {remotion: './src/shim-remotion.tsx'}};

// 1. the balance check, from the real numbers
const check = path.join(os.tmpdir(), 'pick-your-model-check.cjs');
esbuild.buildSync({...common, entryPoints: ['src/check.ts'], platform: 'node', format: 'cjs', outfile: check});
try {execFileSync(process.execPath, [check], {stdio: 'inherit'});} catch {process.exit(1);}

// 2. the game
const hasSfx = fs.existsSync(SFX);
if (hasSfx) fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(path.join(dist, 'sfx'), {recursive: true});
esbuild.buildSync({...common, entryPoints: ['src/main.tsx'], outfile: path.join(dist, 'game.js'), format: 'iife', minify: true,
  target: 'es2020', loader: {'.ttf': 'dataurl'}, define: {'process.env.NODE_ENV': '"production"'}});
// a new build must never run a browser's cached copy of the old one
fs.writeFileSync(path.join(dist, 'index.html'), fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace('src="game.js"', `src="game.js?v=${Date.now()}"`));
if (hasSfx) for (const n of SOUNDS) fs.copyFileSync(path.join(SFX, n + '.wav'), path.join(dist, 'sfx', n + '.wav'));
// the video's music for the race, the shop, the map, the arena, the blocks, the court and the ship, as mp3 (each wav is 3 to 4.5 MB);
// the pre-game themes (bed-select, the arena's; bed-lobby, the ship's; bed-build, the blocks'; bed-morning, the desk's; bed-garage, the rally's; bed-docket, the court's) are the game's own (music.py writes them to channel/game/sfx)
const wavOf = bed => [SFX, path.join(here, 'sfx')].map(d => path.join(d, bed + '.wav')).find(f => fs.existsSync(f));
if (!hasSfx) console.log('no sound sources here: keeping dist/sfx');
else if (fs.existsSync(FFMPEG)) for (const bed of ['bed-race', 'bed-shop', 'bed-map', 'bed-fight', 'bed-blocks', 'bed-court', 'bed-space', 'bed-select', 'bed-lobby', 'bed-build', 'bed-morning', 'bed-garage', 'bed-docket'])
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wavOf(bed), '-b:a', '128k', path.join(dist, `sfx/${bed}.mp3`)]);
else console.warn('ffmpeg not found: no music');
const kb = f => Math.round(fs.statSync(f).size / 1024);
console.log(`built dist/  game.js ${kb(path.join(dist, 'game.js'))} KB`);
