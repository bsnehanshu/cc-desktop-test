---
name: click-through
description: Build a hand-drawn whiteboard click-through explainer, a diagram that builds up one step at a time with a caption per step (click or arrow keys, #n deep links, light and dark), as one self-contained HTML file, and publish it as an artifact. Use when asked for a click-through, step-through, whiteboard or Excalidraw-style explainer, or to walk through an architecture, decision tree, request flow or interview answer step by step.
---

# Click-through explainer

One scene drawn cumulatively. Step n shows everything from steps 1..n, so each step
lists only the shapes it adds. The caption under the board changes per step.
Controls: click or → / Space next, click the left quarter or ← back, Home/End, F full screen.
URL `#3` opens step 3.

Files here: `build.mjs` (spec → HTML), `page.html` (template: player, theme tokens),
`excalifont-latin.css` (Excalifont, SIL OFL 1.1), `examples/claude-on-bedrock.json`.

## Build

```bash
cd .claude/skills/click-through && npm i --silent     # once: roughjs
node build.mjs examples/claude-on-bedrock.json "$SCRATCH/out.html"
```

Then publish `out.html` with the Artifact tool (it is page content with no doctype; the
artifact skeleton wraps it). The page is about 70 KB and loads nothing external. To
update, rebuild to the same path and publish the same file path again.

## Spec

```json
{
  "title": "Claude on Bedrock Explainer",
  "label": "one sentence a screen reader says for the whole diagram",
  "canvas": [1620, 940],
  "steps": [ { "caption": "Said under the board at this step.", "draw": [ ...elements ] } ]
}
```

Coordinates are on the canvas (default 1620×940, origin top left). Elements (`kind`):

| kind | required | optional |
|---|---|---|
| `title` | `text` | `y` (84), `fs` (42), `underline` (true: red hand-drawn line) |
| `card` | `x y w h title` | `lines` [], `color` (gray), `fs` 27, `lfs` 19 |
| `bubble` | `x y w h lines tip:[x,y]` | `tail` top/bottom, `tailAt` (x where the tail leaves the edge), `color` (yellow), `fs` 22 |
| `arrow` | `points:[[x,y],…]` (2+; elbows allowed) | `color` (ink), `label`, `labelAt:[x,y]`, `labelColor`, `width` |
| `text` | `x y text` (`\n` breaks) | `fs` 20, `color` ink, `anchor` start/middle/end |
| `line` | `points` | `color`, `width`, `curve` true |

Colors: `ink muted red green blue orange purple yellow gray`; fills (`card`, `bubble`):
`green blue orange purple yellow gray`. Every color has a light and a dark value in
`page.html`, so never write hex in a spec.

House colors: AWS = orange, Anthropic or Claude = purple, the customer or their app = blue,
questions and decisions = yellow, results and answers = green, optional or neutral = gray,
emphasis = red (the title underline, once).

## Composing

- 4 to 8 steps. Step 1 has the title and the starting point. The last step is a one-line takeaway.
- Excalifont runs about 0.5 em per character. A 420-wide card fits about 36 characters at `lfs` 19. Keep cards to a title plus 1 to 3 lines.
- Lay out a row of 3 cards as x 60 / 600 / 1140, w 420, gap 120. Arrows run edge to edge with 10 px clearance, forward on the upper lane, return on the lower lane.
- Add shapes in the order they first appear. Seeds follow element order, so inserting one early reshuffles the hand-drawn wobble of everything after it (harmless).
- Captions are one or two plain sentences, spoken style, and say what the new shapes mean.
- Facts on the board must be true as they stand. Label examples as examples.

## Check

Optionally take one look before publishing: wrap the output in a doctype and screenshot `#<last step>` with Playwright
(`require('/opt/node-tools/node_modules/playwright')`, Chromium from `/opt/pw-browsers`),
light and dark, then fix any text that overruns its card in one pass.
