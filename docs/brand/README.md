# adrop brand

A coin-yellow tile with a drop cut out of it. The tile is the app; the drop is the ad that lands in it and the value that lands in the viewer's wallet. The drop is a hole: it takes the colour of whatever the tile sits on. Where a hole is impossible (app icon, print on yellow) it is filled with ink.

## Files

| File | Use |
|---|---|
| `mark.svg` | Default mark. Cut-out, so it works on paper, white and any flat light surface |
| `mark-dark.svg` | Drop filled with ink. For dark surfaces that are not flat (photos, gradients) and anywhere the icon must be opaque |
| `mark-mono.svg` | One colour, `currentColor`. Inherits the text colour of its context |
| `favicon.svg` | Same mark with a larger drop and tighter corners so it reads at 16 px. Use below 24 px |
| `wordmark.svg` / `wordmark-dark.svg` | Mark + `adrop`, for paper / for ink. Type is outlined; no font needed |
| `og.png` 1200×630, `title-card.png` 1920×1080, `app-icon.png` 1024×1024 | Ready to use as-is |

## Palette

| Name | Hex | Role |
|---|---|---|
| Ink | `#111111` | Type, dark surfaces, the drop on dark |
| Coin | `#F5C518` | The tile. The only accent colour |
| Paper | `#FAFAF7` | Light surfaces, type on dark |

Coin never carries text. Ink on Coin and Coin on Ink both pass WCAG AA for large text and graphics (contrast 11.6:1).

## Type

**Inter Display SemiBold** (`opsz` 32 in the variable font), tracking −0.025 em, for the wordmark. **Inter Display Medium** for taglines, **Inter** for running text and URLs. Inter by Rasmus Andersson, SIL Open Font License 1.1, on Google Fonts as "Inter" (the Display cut is the `opsz` axis at 32). Redistributable with the Apache-2.0 repo; the SVGs embed no font.

## Construction

Tile 64 × 64, corner radius 15. Drop: circle r 15 centred at (32, 38), tip rounded r 2.5, apex at y 7.5. In the lockup the tile height equals the ascender height of the `d`, the tile sits on the baseline, and the gap between tile and `a` is 0.34 × tile height.

## Minimum size

Mark 24 px (screen) / 6 mm (print); below 24 px use `favicon.svg`, down to 16 px. Wordmark 24 px tall (screen) / 8 mm (print). App icon: `app-icon.png` as delivered; let the platform apply its own corner mask.

## Clear space

Keep a margin of half the tile's side on all four sides of the mark, and of the wordmark as a whole. Nothing else inside that margin.

## Don'ts

Do not rotate the tile or point the drop any way but up. Do not add a coin, a shadow, a gradient, a stroke or a glow. Do not change the corner radius or the drop's size inside the tile. Do not recolour the tile: Coin, or `currentColor` in the mono file, nothing else. Do not set the wordmark in another typeface or weight, and do not capitalise it: it is `adrop`, never `Adrop` or `ADROP`, in the lockup. Do not place the mark on Coin. Do not put type inside the tile.
