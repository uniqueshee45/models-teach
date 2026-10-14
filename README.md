# Pick Your Model

A free browser game about working with Claude. Six worlds, each teaching one idea:

- **The rally**: which model fits which job. The model is your co-driver.
- **The front desk**: send each customer's job to the right model.
- **The blocks**: when to check a model's work.
- **The arena**: read why a try missed, then pick the fix (effort, a better ask, more context, another model).
- **The court**: how to ask. Your first draft takes the stand, line by line.
- **The ship**: hidden orders (prompt injection), as the watcher or the impostor.

Every number in the game comes from a public test or Anthropic's own pages, and each one links to its source on
the numbers page (press N in the game).

## Play

Open `game/dist/index.html` in a browser, or serve the folder:

```
npx serve game/dist
```

Works with keyboard, mouse or touch.

## Build

Needs Node 18+.

```
npm install
npm run build
```

This runs the balance check (`game/src/check.ts`) and writes `game/dist/`. The sounds in `game/dist/sfx` are
committed and kept as they are.

`remotion/` holds the drawing and 3D files the game shares with the video it came from, at the same paths, so
the imports work unchanged.

## Notice

Unofficial fan game. Not made, endorsed or checked by Anthropic. "Claude" and the model names belong to
Anthropic. The font is Be Vietnam Pro, under the SIL Open Font License 1.1.
