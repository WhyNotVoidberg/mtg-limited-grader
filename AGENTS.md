# MTG Limited Grader — Codex Instructions

This repository contains a responsive, desktop-first PWA with mobile support for independently grading Magic: The Gathering Limited cards before comparing those grades with expert opinions and 17Lands data.

## Updated user decisions (2026-09-22)

- One app supports desktop and mobile; Excel remains the analysis layer.
- Defaults are intentional speed features. Preserve them.
- Future history: one explicit whole-set pre-release lock, followed by explicit per-card reassessments with dated revisions. Untouched cards do not acquire new history.
- Arena release date anchors relative dates.
- Tier list switches between pre-release and current grades.
- Cloud sync is requested for personal PC/phone use, with offline support and conflict preservation. Multi-user sharing is not a current priority.
- Collect pre-release and revised rankings/notes for colors and color pairs. Excel compares color pairs to performance.
- Excel shows latest 17Lands data, with historical snapshots separately; retain personal and global card/color-pair results and sample sizes.
- Implement in milestones. This milestone is repository setup, guidance consolidation, and saving/import reliability only.

## Core rule: preserve user data

The app's browser data is more important than any code refactor.

- The production localStorage key is `mtgLimitedGraderV1`. Do not rename, clear, replace, or invalidate it without an explicit migration.
- Existing sets, ratings, notes, tags, mechanics, and card metadata must survive upgrades.
- Any schema change must be backward compatible or include a tested migration.
- Never overwrite a user's existing nonblank grading field with a newly inferred/default value.
- Backup import/export compatibility is required across releases whenever practical.
- Before a change that touches storage, write down the migration behavior and test it against a real backup JSON.

## Protected historical data

Reality Fracture (`FRA`) is the first true prospective grading experiment. Its pre-release grades are a locked historical snapshot.

- Do not rewrite, normalize, "improve," or replace locked pre-release grades with later opinions.
- Post-format opinions must live in separate fields/snapshots.
- Expert grades and 17Lands results must never overwrite user grades.
- The canonical locked snapshot is the user backup exported on 2026-09-21 with 285 FRA cards: 280 graded nonbasic cards and five intentionally ungraded basic lands.
- The companion workbook is `Reality_Fracture_PreRelease_LOCKED_2026-09-21.xlsx`.
- Do not commit personal grading backups or analysis workbooks to this public repository unless the user explicitly asks.

## Current production baseline

Current release: **v1.5**. Previous production baseline: **v1.4**.

Production repository: `WhyNotVoidberg/mtg-limited-grader`.

GitHub Pages serves the repository root. The PWA consists primarily of:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `README.txt`

The current production code has already fixed two historically important regressions:

1. Tag-button clicks must not erase unsaved grade/confidence/role data or jump the user back to the top. Tag buttons are `type="button"`; the click path saves the current form first and does not rerender the entire card.
2. The service worker must not trap users on stale JavaScript/CSS. v1.3+ uses a versioned cache, `skipWaiting()`, `clients.claim()`, old-cache deletion, network-first behavior for app-shell/navigation assets, versioned asset URLs, and a visible app version.

Do not regress either behavior.

## Release/versioning rules

For every app release:

- Update `APP_VERSION` in `app.js`.
- Update the visible version in `index.html`.
- Update query-string versions for `app.js`, `styles.css`, and `manifest.webmanifest`.
- Update the service-worker registration version.
- Change the service-worker cache name.
- Change the one-time `controllerchange` reload guard key if needed.
- Preserve network-first app-shell behavior and deletion of stale app caches.
- Update `README.txt` with a concise release note.
- Test that an existing backup still imports and existing localStorage data still loads.

## Set import behavior

Cards are fetched client-side from Scryfall.

Current logic:

1. Try `set:<CODE> is:booster`.
2. If that returns no usable cards or errors for a newly previewed/unreleased set, fall back to `set:<CODE> game:paper`.
3. Remove digital cards and deduplicate by `oracle_id` (falling back to name when needed).
4. Keep Scryfall card metadata used by the UI and exports.

Do not special-case FRA unless unavoidable. Prefer a general Limited-environment import model. Be aware that `is:booster` is not a perfect definition of an Arena/Premier Draft card pool and bonus-sheet cards may require explicit environment handling later.

## Grading scale and fields

Canonical grade scale:

`A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / F`

Do not reintroduce `F+` or `F-`. Legacy `F+`/`F-` migrates to `F`.

Per-card fields:

- `grade`
- `confidence`: `High | Medium | Low`
- `primaryRole`
- `secondary[]`
- `synergy[]`
- `power`: 1–5
- `consistency`: 1–5
- `synergyReliance`: `Liability | Independent | Assisted | Dependent`
- `notes`
- `autoVersion`

Power and Consistency are **relative modifiers to the overall grade**, not independent absolute card grades. Default is 3.

Synergy Reliance semantics:

- `Liability`: becomes less desirable / creates opportunity cost in a highly synergistic deck.
- `Independent`: works on its own and neither requires nor contributes meaningful synergy. Default.
- `Assisted`: works independently but improves meaningfully with support.
- `Dependent`: the grade substantially assumes support/enabling.

If numeric analysis is useful, a conceptual encoding is Liability=-1, Independent=0, Assisted=1, Dependent=2. Do not expose that as the user-facing scale unless requested.

## Primary roles

Exactly one primary role answers: **"Why am I putting this card in my Limited deck?"**

Allowed roles:

- Creature
- Removal
- Combat Trick
- Card Advantage
- Interaction
- Ramp
- Mana/Fixing
- Recursion
- Build-Around
- Payoff
- Other

A creature defaults to `Creature` even if it also has removal/card-advantage text. Other functions can be secondary tags.

## Tags and automatic defaults

Automatic/default tags are intentionally aggressive; the user reviews and edits them while grading.

Secondary tags currently include:

- Evasion
- Burn
- Cantrip
- Card Selection
- Modal
- Token Maker
- Value
- ETB
- Death Trigger
- Sacrifice Outlet
- Graveyard Filler
- Finisher
- Defensive
- Aggressive
- Tempo
- Protection

Synergy tags currently include:

- Artifacts
- Enchantments
- Rooms
- Eerie
- Manifest Dread
- Face-Down
- Delirium
- Survival
- Graveyard
- Reanimator
- Tokens
- +1/+1 Counters
- Sacrifice
- Lifegain
- Discard
- Go-Wide
- Go-Tall
- Power 2 or Less
- Aggro
- Control
- Tempo

Functional Limited taxonomy is preferred over strict rules ontology.

Burn means any effect that directly reduces an opponent's life total without combat damage, including direct damage to a player/opponent/any target and explicit life loss. Creature-only damage is not Burn. Drain is represented as Burn + Lifegain; there is no separate Drain tag currently.

Automatic inference must only fill missing/default fields. It must never silently overwrite the user's manual selections.

## Sorting and gallery behavior

Default card order:

1. Two-color uncommon signposts first (current heuristic: any two-color uncommon).
2. Then White, Blue, Black, Red, Green.
3. Within each color: Common, Uncommon, Rare, Mythic.
4. Then remaining Multicolor.
5. Then Colorless.
6. Then Lands.

Gallery filters must continue to support color, rarity, and graded/ungraded status.

## Mobile grading UX

Desktop is the primary future interface; iPhone remains supported. Preserve the existing mobile workflow.

- Keep grading low-friction and tap-oriented.
- Avoid requiring the keyboard except for Notes.
- On the grading screen, the card image starts larger and becomes a compact sticky reference after scrolling.
- Tapping the card image opens a larger modal image.
- Preserve sticky navigation and safe-area handling.
- Test narrow mobile layouts before merging UI changes.

## Set mechanics

Mechanic ratings use six 1–5 controls plus Notes:

- Power
- Fun to play
- Fun to play against
- Synergy reliance
- Desire to return
- Likelihood to return
- Notes

The 1–5 meaning is Very Low / Low / Average / High / Very High, default 3.

Mechanic Synergy Reliance is a 1–5 magnitude. It is **not** the same four-state card-level Synergy Reliance model.

Long term, mechanics need separate pre-format and post-format snapshots. DSK is retrospective/current. FRA should preserve a pre-format snapshot when mechanic ratings are added.

## Expert and 17Lands data

The app currently does not own expert/17Lands data. The spreadsheet is the analysis layer.

Long-term comparison fields include:

- Limited Level-Ups raw grade
- Limited Resources raw grade
- Other expert raw grade(s)
- Derived expert consensus
- Global 17Lands GIH WR, OH WR, Games, ALSA
- Personal 17Lands GIH/OH WR and sample sizes when available
- Historical snapshots by date/format day
- Post-format user grade/opinion kept separate from the locked pre-release grade

Never overwrite raw creator labels with normalized values. Store raw values separately and derive normalized/consensus values elsewhere.

## Spreadsheet rules

The workbook is an analysis artifact; the JSON backup remains the raw source of truth for app grading data.

For FRA:

- `Pre-Release Grade` is immutable historical data.
- Confidence, Power, Consistency, Synergy Reliance, roles, tags, and pre-release notes should also be preserved as the pre-release snapshot.
- Add post-format evaluations in separate columns/sheets rather than replacing the locked values.
- Expert and 17Lands data are added after the independent grading snapshot is locked.
- Keep sample sizes visible for statistical data.
- Do not invent missing expert or 17Lands data.

Preferred compact working view puts the most useful columns up front and keeps detail fields available but visually collapsed/hidden. Current design direction is roughly:

`Mana Cost | Card | Pre-Release Grade | LLU | Expert Consensus | GIH WR`

with color, rarity, confidence, detailed evaluation, additional experts, deeper 17Lands metrics, and post-format fields retained as secondary detail.

## Validation checklist before committing

At minimum, verify:

- Existing localStorage state loads.
- A real JSON backup imports without losing ratings.
- Exported JSON still contains all sets and rating fields.
- Changing a tag does not erase grade/confidence/role or jump to the top.
- Grade, confidence, role, Power, Consistency, Synergy Reliance, tags, and Notes persist after navigating away and back.
- Gallery graded/ungraded counts remain correct.
- FRA can be added using set code `FRA`.
- DSK still loads and remains compatible.
- Mobile grading image shrinks/expands correctly.
- Service-worker update path serves the new app version rather than stale assets.
- No migration overwrites nonblank user data.

When a requested change conflicts with one of these invariants, stop and explain the conflict instead of silently choosing a destructive implementation.
