# Fang League

A tiny fantasy-football manager in the pocket-league style. You take one original side — orcs, humans, dwarves, elves, dark elves, undead, rat-folk, lizardfolk, goblins, halflings, ogres, or the doomsworn — through a ten-match division (each rival twice) and, if you finish first, a cross-division cup final.

No build step. The site is static HTML, ES modules, and a canvas.

## Play

```bash
python3 -m http.server 8743
```

Open [http://127.0.0.1:8743](http://127.0.0.1:8743). Chrome blocks ES modules from `file://`, so use a static server (Vercel serves this folder as-is).

Headless balance report:

```bash
node sim.js 40 20
```

`sim.html` runs a shorter version of the same report in the browser. `simulateMatch(teamA, teamB, seed)` is exported from `src/match.js` and assigned to `window.simulateMatch`.

## How to play

1. Pick a race. The card shows the crest colors, a one-line style, and a large neutral portrait (or the 512px body painting until a portrait exists).
2. Between matches, use **Squad**, **Recruit**, **Upgrades**, **League**, and **Match**.
   - Train a stat if you can afford it. From training ground level 2, one session in four adds 2.
   - Heal injured players. They miss the listed matches. Undead healing costs half.
   - Release is on the card (not right-click only). You cannot drop below 5 players.
   - Sign from the three-player pool. Reroll costs gold. Roster max is 10.
   - Upgrade the training ground (cheaper training, cheaper heals) or the stadium (gate and fans).
3. **Kick off**. The match plays itself on a side-view pitch: runs, tackle wind-ups, fumbles, touchdowns, casualties. Speed is 1× / 2× / 4×. Pause freezes the clock. Press **M** (or Missing art) to list files that 404'd.
4. Win your division of six (ten matches, each rival twice). A tie plays up to three sudden-death rounds. Each side drives once a round, and an unanswered score wins. Still level after that, the draw stands. The Fen champion plays the Ridge champion in the cup. A draw in the final goes to the side with more division points, then point difference, then points scored. You can train at most 3 times between matches. You cannot release a player if the squad would drop below 7, or below 5 fit players.
5. Next season keeps your squad, gold, fans, and buildings. Injuries clear. Every rival gains +1 to all stats. Stats cap at 20, shown as `Str 8/20`.

Gold never goes negative. Buttons that cost more than you have are disabled, and the handler refuses the purchase anyway. Restart sits apart from the other controls, asks first, and sets speed back to 1×.

No check is outside 14–86%, so a maxed side can still lose.

## Divisions and teams

| Division | Race | Team | Style |
| --- | --- | --- | --- |
| Fen | Orcs | Ironjaw Brawlers | hit hard |
| Fen | Humans | Riverwatch Guard | balanced and steady |
| Fen | Elves | Silverleaf Gliders | fast and fragile |
| Fen | Goblins | Muckpit Sneaks | quick, cheap, and fragile |
| Fen | Undead | Gravecall March | heal faster |
| Fen | Halflings | Bramblefoot Band | small and slippery |
| Ridge | Dwarves | Deepforge Anvils | tough and slow |
| Ridge | Dark Elves | Nightglass Reavers | cruel and quick |
| Ridge | Rat-folk | Sewerfang Rush | very fast |
| Ridge | Lizardfolk | Sunscale Fangs | strong and quick |
| Ridge | Ogres | Gutrock Maw | huge and slow |
| Ridge | Doomsworn | Ashmaw Host | heavy and wild |

Positions (seven players, four types):

| Race | Positions |
| --- | --- |
| Orcs | 3 Lineman, 2 Blitzer, 1 Thrower, 1 Big Brute |
| Humans | 3 Lineman, 2 Catcher, 1 Thrower, 1 Blitzer |
| Dwarves | 3 Lineman, 2 Blocker, 1 Runner, 1 Warden |
| Elves | 3 Lineman, 2 Catcher, 1 Thrower, 1 Dancer |
| Goblins | 3 Lineman, 2 Dodger, 1 Thrower, 1 Scrapper |
| Undead | 3 Shambler, 2 Runner, 1 Thrower, 1 Brute |
| Rat-folk | 3 Lineman, 2 Runner, 1 Thrower, 1 Sneak |
| Lizardfolk | 2 Lineman, 2 Brute, 2 Runner, 1 Thrower |
| Dark Elves | 3 Lineman, 2 Blitzer, 1 Thrower, 1 Shade |
| Halflings | 3 Lineman, 2 Dodger, 1 Thrower, 1 Scout |
| Ogres | 2 Lineman, 3 Brute, 1 Crusher, 1 Thrower |
| Doomsworn | 3 Lineman, 2 Blitzer, 1 Thrower, 1 Ravager |

Stats are Strength, Speed, Agility, and Passing. Trait text on the squad screen is generated from the same numbers the match uses.

## Balance (starting point)

- Start at 230 gold and 40 fans. Win purse is about 70g before upgrades; a loss still pays the gate.
- Training starts near 70–90g (`32 + 7 × stat`, then −12% per training-ground level).
- Training ground costs 150 / 280 / 420. Stadium costs 170 / 320 / 480.
- A reasonable manager (heal starters, train the thrower's passing and the runner's speed, then buy a training ground) can win a division. Idle play does it less often. Stronger races are not locks, and a fully maxed side still loses some matches.
- Re-check with `node sim.js`.

## Asset manifest

Drop files in `assets/`. Names are `{prefix}-{position}-…`. Players are drawn **facing right**. The away side, and anyone moving left, is mirrored at draw time. Smoothing is **off** only when a file is marked `pixelated: true`. Player and portrait art defaults to `pixelated: false` (smooth downscale). Override a single file in `ASSET_OVERRIDES` in `src/data.js` with `{ pixelated, frameWidth }`.

On the pitch, figures are about **96px tall** on the 800×600 canvas. Source frames can be 128×128 or up to 512×512; the game reads the natural size. A strip whose width is an even multiple of its height is treated as square frames. One painted frame is enough.

Recommended sizes:

| Kind | File | Size | pixelated |
| --- | --- | --- | --- |
| Pitch body, one frame or a strip | `{prefix}-{position}-idle.png` | 128×128 per frame | false |
| Pitch body, small master | `{prefix}-{position}-hd-128.png` | 128×128 | false |
| Portrait fallback / team select | `{prefix}-{position}-hd.png` | 512×512 | false |
| Optional pose strip | `{prefix}-{position}-run.png`, `-tackle.png`, `-down.png` | 128×128 per frame | false |
| Expression portrait | `{prefix}-{position}-portrait-neutral.png` (also `happy`, `angry`, `hurt`) | 256×256 | false |
| Crest | `crest-{prefix}.png` | 256×256 | false |
| Ball | `ball.png` | 16×16 (current pixel ball) | true |
| HUD | `icon-gold.png`, `icon-fans.png` | 32×32 | true |
| Side-view pitch | `pitch.png` | 800×600. Feet line near y=430. Ticker covers y=508–600. | false |

Prefixes: `orc`, `human`, `dwarf`, `elf`, `darkelf`, `goblin`, `undead`, `ratfolk`, `lizard`, `halfling`, `ogre`, `doom`.

### Orcs and humans (painted set)

These eight positions ship as paintings, not the old 32px sheets. The loader **does not** request `{prefix}-{position}.png`, `-run.png`, `-tackle.png`, or `-down.png` for orcs or humans, so those obsolete files cannot sneak back in.

| File | Use |
| --- | --- |
| `orc-lineman-hd-128.png`, `orc-blitzer-hd-128.png`, `orc-thrower-hd-128.png`, `orc-brute-hd-128.png` | Pitch (128×128) |
| `orc-lineman-hd.png`, `orc-blitzer-hd.png`, `orc-thrower-hd.png`, `orc-brute-hd.png` | Portrait fallback (512×512) |
| `human-lineman-hd-128.png`, `human-catcher-hd-128.png`, `human-thrower-hd-128.png`, `human-blitzer-hd-128.png` | Pitch |
| `human-lineman-hd.png`, `human-catcher-hd.png`, `human-thrower-hd.png`, `human-blitzer-hd.png` | Portrait fallback |
| `orc-lineman-portrait-neutral.png`, `-happy`, `-angry`, `-hurt` | 256×256 |
| `human-lineman-portrait-neutral.png`, `-happy`, `-angry`, `-hurt` | 256×256 |

`style-test-v2.png` is a contact sheet only. It is not loaded.

Until tackle and down paintings exist, the match fakes them on the single body frame: run bobs and squashes, tackle winds back then lunges with a small rotation, knockdown rotates about 90° into a dust puff. Happy shows on a touchdown, angry on a tackle and on the player who caused a casualty, hurt on the injured player and on the injured list. Neutral is the roster and team-select face.

### Fallback order

Pitch body: `idle` → `hd-128` → `hd` → plain `{prefix}-{position}.png` (plain is skipped for orcs and humans). A missing run, tackle, or down file uses that body with the fake motion above.

Portrait: the requested expression → `portrait-neutral` → `hd` → `idle` → `hd-128` → the plain file for other races → a colored shape with jersey and shoulder-pad colors. Each team’s primary color also tints the select card, the HUD stripe, the table row, and the ground ring under the player.

Missing files log once in the console as `[fang-league] missing art:`. Press **M** or the Missing art button to list them.

### Still to paint

Every position that is not in the orc/human table above still needs `idle` or `hd-128`, `hd`, and four portraits. Crests and a side-view `pitch.png` are still open. Shape stand-ins cover anything that 404s.
