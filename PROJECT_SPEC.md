# MTG Limited Grader — Project Handoff Specification

Version: 1.1  
Handoff date: 2026-09-21  
Production app baseline: v1.4  
Repository: `WhyNotVoidberg/mtg-limited-grader`

## Current decisions and milestone scope (2026-09-22)

These decisions supersede the original handoff wherever it differs.

- One responsive app, PC first with mobile support. Desktop redesign is a later milestone.
- Personal use for the foreseeable future; online account storage and PC/phone sync are explicitly requested. Preserve offline edits and resolve conflicts without silently losing either assessment. No provider selected yet.
- An explicit action locks all pre-release assessments. Later, Update assessment prefills a single card and saving records its dated revision. No repeated whole-set reassessment or duplicated history for untouched cards. FRA's supplied locked backup is its baseline.
- Relative dates use each set's Arena release date; keep exact timestamps too.
- Tier-list view offers current and pre-release grades with filters.
- Excel main table: pre-release grade, current grade, change, last reassessed. Separate Grade History rows retain individual revisions.
- 17Lands snapshots are independent of assessment revisions: latest imported statistics on the main table, dated history separately, with event type, covered dates and sample sizes.
- Capture the user's ranked ten color pairs with notes before release; compare with color-pair results in Excel. Clarify splashes when selecting the data source.
- Capture ranked W/U/B/R/G colors with descriptions, and dated later revisions. Treat color performance comparisons as contextual.
- Retain personal/global card and color-pair statistics including small samples, game counts and draft counts when available. Missing observations are not zero win rates.
- JSON is the raw grading export; Excel remains the comparison/analysis layer.

First development milestone: connect repository, consolidate guidance, fix saving and backup imports, test preservation. No history schema, tier list, cloud service, or desktop redesign ships in this milestone. See docs/reliability-update.md.

## 1. Project purpose

MTG Limited Grader is a long-term Magic: The Gathering Limited evaluation project with two cooperating layers:

1. **Desktop-first responsive grading PWA** — optimized for independently grading an entire set quickly on PC, with mobile supported.
2. **Excel analysis workbook** — used after independent grading to compare predictions with expert grades, 17Lands performance, later personal results, and post-format opinions.

The point is not merely to produce a tier list. The long-term goal is to measure how the user's card-evaluation process performs across sets and identify recurring tendencies such as overrating synergy-dependent cards, underrating consistency, or systematically disagreeing with expert/data signals in particular card roles.

The workflow therefore depends on preserving historical snapshots. A prediction made before playing must remain available later even if the user's opinion changes.

## 2. Current state

### App

Production is currently **v1.4** on GitHub Pages.

The repository root contains the static PWA:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `README.txt`

No backend exists. Scryfall is fetched directly from the browser. Ratings are local-only unless the user exports a backup.

### Reality Fracture milestone

Reality Fracture (`FRA`) is the first set treated as a true pre-release/prospective experiment.

The locked backup exported on 2026-09-21 contains:

- 285 FRA cards in the imported set
- 280 graded nonbasic cards
- 5 intentionally ungraded basic lands: Plains, Island, Swamp, Mountain, Forest

The locked analysis workbook is:

`Reality_Fracture_PreRelease_LOCKED_2026-09-21.xlsx`

These pre-release values are historical data and must not be overwritten by later opinions.

### Duskmourn milestone

Duskmourn: House of Horror (`DSK`) is used primarily as a retrospective/current-grade test set. It helped validate the app and workbook design but is not the same kind of clean prospective experiment as FRA.

## 3. Source-of-truth model

### Raw grading source of truth

The app's exported JSON backup is the authoritative raw record of grading inputs.

The workbook is derived analysis data. It should be reproducible from JSON plus later external comparison data whenever possible.

Current localStorage key:

`mtgLimitedGraderV1`

Do not change it casually. If the app schema evolves, preserve backward compatibility or implement an explicit migration.

### Card identity

The app keys ratings by:

`oracle_id || id`

The imported card list retains Scryfall IDs and card metadata. Deduplication also prefers `oracle_id`, falling back when necessary.

This is important for stable joins between backups, spreadsheets, and later external data.

## 4. App data schema

Top-level shape is conceptually:

```json
{
  "sets": {
    "fra": {
      "name": "Reality Fracture",
      "ratings": {},
      "mechanics": {},
      "created": "...",
      "cards": []
    }
  }
}
```

### 4.1 Card metadata retained from Scryfall

Each imported card currently stores fields including:

- `id`
- `oracle_id`
- `name`
- `set`
- `set_name`
- `collector_number`
- `rarity`
- `mana_cost`
- `type_line`
- `oracle_text`
- `power`
- `toughness`
- `colors`
- `color_identity`
- `image_uris`
- selected `card_faces` fields for multiface cards

Do not remove metadata without verifying it is unused by the app, exports, or workbook pipeline.

### 4.2 Per-card grading data

Canonical fields:

| Field | User-facing meaning |
|---|---|
| `grade` | Overall Limited grade |
| `confidence` | High / Medium / Low |
| `primaryRole` | One primary reason to include the card |
| `secondary` | Multiple functional tags |
| `synergy` | Multiple archetype/synergy tags |
| `power` | 1–5 relative to overall grade |
| `consistency` | 1–5 relative to overall grade |
| `synergyReliance` | Liability / Independent / Assisted / Dependent |
| `notes` | Free-text thoughts |
| `autoVersion` | Version marker for automatic defaults/inference |

Legacy backups can contain obsolete `flexibility`. It is not part of the active grading form and should not be reintroduced unless the user explicitly decides to restore it.

## 5. Grading system

### 5.1 Overall grade

Canonical scale:

`A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / F`

`F+` and `F-` were removed. Legacy values migrate to `F`.

### 5.2 Confidence

- High
- Medium
- Low

### 5.3 Power

1–5 tap scale, default 3.

Power is not another absolute card grade. It describes whether the card's ceiling/raw impact feels lower or higher than what is typical for the assigned overall grade.

Approximate interpretation:

- 1 — much lower than typical for this grade
- 2 — below typical
- 3 — typical
- 4 — above typical
- 5 — much higher than typical

### 5.4 Consistency

Same 1–5/default-3 model, describing reliability relative to the overall grade.

### 5.5 Synergy Reliance

Four states:

- **Liability** — the card becomes less desirable or imposes opportunity cost in highly synergistic decks.
- **Independent** — default; works on its own and neither needs nor meaningfully contributes synergy.
- **Assisted** — works independently but improves meaningfully with support.
- **Dependent** — the grade substantially assumes support/enabling.

This field is contextual and manual. Do not infer Liability mechanically from rules text.

For private numerical analysis, a useful encoding is:

- Liability = -1
- Independent = 0
- Assisted = 1
- Dependent = 2

Do not replace the categorical UI with those numbers unless requested.

## 6. Roles and tags

### 6.1 Primary Role

Exactly one role answers:

**"Why am I putting this card in my Limited deck?"**

Allowed values:

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

Creature wins as the default primary role whenever the card is a creature, including Artifact Creature or Enchantment Creature. ETB removal/card advantage can still be represented in tags.

### 6.2 Secondary Tags

Current vocabulary:

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

### 6.3 Synergy Tags

Current vocabulary:

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

### 6.4 Burn definition

Use a functional Limited definition:

A card gets Burn when it can directly reduce the opponent's life total without combat damage. This includes direct damage to a player/opponent/any target and explicit life loss. Creature-only damage is not Burn. Drain is represented by Burn + Lifegain.

## 7. Automatic inference/defaults

The user prefers aggressive sensible defaults because reviewing/editing a tag is faster than manually building every classification.

Current intent:

- Every creature defaults Primary Role to Creature.
- Noncreatures may infer Removal, Interaction, Combat Trick, Card Advantage, Ramp, Mana/Fixing, Recursion, Payoff, etc. from Oracle text.
- Flying/menace/trample/unblockable-style text -> Evasion.
- `draw a card` -> Cantrip.
- Net-positive multi-card draw -> Value/Card Advantage as appropriate.
- Token creation -> Token Maker.
- ETB and death text -> ETB / Death Trigger.
- Protection/hexproof/indestructible -> Protection.
- Rules/mechanic text can add relevant synergy tags.

Automatic defaults must be editable and must never overwrite a nonblank/manual value.

`autoVersion` exists so inference rules can evolve without silently rewriting established user data.

## 8. App screens and expected behavior

### 8.1 Sets/Home

- Shows imported sets and graded/total progress.
- DSK is added automatically on first launch if absent.
- User can add another set by Scryfall set code.

### 8.2 Gallery

- Card-image gallery.
- Filters: Color, Rarity, Graded/Untgraded.
- Grade badge shown on graded cards.
- Tapping a card opens it in the grading view.

### 8.3 Grade

Mobile-first form with:

- Card image
- Grade
- Confidence
- Primary Role
- Secondary tags
- Synergy tags
- Power 1–5
- Consistency 1–5
- Synergy Reliance four-state control
- Notes
- Previous / Save & Next

Important UX behavior:

- The card image becomes a compact sticky reference after scrolling on mobile.
- Tapping the image opens a larger modal.
- Keyboard use should be limited mainly to Notes.
- Changing tags must not rerender the card or lose unsaved fields.

### 8.4 Mechanics

Current UI supports six 1–5 mechanic metrics plus Notes.

DSK is initialized with:

- Rooms
- Manifest Dread
- Survival
- Eerie
- Impending
- Delirium

FRA currently has no mechanic list initialized in the v1.4 backup. A future design should make mechanics set-configurable instead of hard-coded to DSK.

### 8.5 Data

Currently supports:

- visible app version
- graded progress summary
- JSON backup export
- CSV card-rating export
- JSON backup import

Expert and 17Lands data are intentionally not yet integrated into the app.

## 9. Scryfall importing

Current v1.4 behavior:

1. Request `set:<code> is:booster`.
2. If no cards are returned or a newly previewed set lacks booster metadata, retry `set:<code> game:paper`.
3. Exclude digital cards.
4. Deduplicate.
5. Sort into grading order.

This change was introduced because `FRA` initially failed to import while the set was newly revealed.

Longer term, a better concept is **Limited Environment** rather than simply **Set**. The exact Draft/Play Booster pool can include bonus-sheet or cross-set cards, and `is:booster` is not guaranteed to match the Arena Premier Draft pool exactly.

Do not guess at a Limited environment. When implementing environment-specific pools, derive them from reliable set/product data and make the composition inspectable.

## 10. Sorting

Default sort order:

1. Signpost uncommons first. Current heuristic: any two-color uncommon.
2. White
3. Blue
4. Black
5. Red
6. Green
7. Remaining Multicolor
8. Colorless
9. Lands

Within normal colors, rarity order is:

Common -> Uncommon -> Rare -> Mythic

Long term, a dedicated signpost marker would be preferable to assuming every two-color uncommon is a signpost.

## 11. Persistence and migrations

### 11.1 Existing migrations

Current code handles:

- `F+` / `F-` -> `F`
- old 1–10 Power/Consistency -> 1–5 conversion
- old numeric Synergy Reliance -> categorical model
- old mechanic 1–10 values -> 1–5 conversion

### 11.2 Migration philosophy

- Migrations must be idempotent.
- Do not destructively rewrite unknown fields.
- Preserve older fields even if the active UI no longer exposes them when doing so is cheap.
- Never infer a replacement over a nonblank user value.
- Test with a real backup before shipping.

## 12. Service worker and PWA update behavior

A prior version frequently appeared to "revert" because stale app-shell assets remained cached.

v1.3 established the current stability pattern:

- visible version indicator
- versioned cache name
- versioned asset query strings
- `skipWaiting()` during install
- delete old caches on activation
- `clients.claim()`
- network-first fetch for app-shell/navigation assets
- no-store network fetch for those assets when online
- hourly registration `update()` checks
- one-time page reload on new service-worker controller

Preserve this behavior. Any service-worker change requires explicit testing on an installed Home Screen PWA, not only a desktop browser tab.

## 13. Historical bug: tag state loss

A prior build had a serious grading bug:

After entering grade/confidence/primary role, clicking a secondary or synergy tag rerendered the card before unsaved form values were persisted. This reset fields and scroll position.

The fix is intentionally simple:

- tag buttons are `type="button"`
- click prevents default behavior
- call `saveCurrent()` before changing tag state
- toggle the saved tag array
- update only the clicked chip's visual state
- persist
- do **not** call full `renderCard()`

Do not rewrite this path in a way that reintroduces a full rerender unless form state is preserved explicitly.

## 14. Workbook purpose and layout

The workbook is the long-term analysis layer, not the raw grading source.

The current FRA workbook contains sheets conceptually including:

- Dashboard
- Card Ratings
- Expert Comparison
- Set Mechanics
- 17Lands History
- Instructions
- Future Set Template

### 14.1 Compact Card Ratings design

The user prefers a compact default working view. The most important columns should be immediately visible; metadata/detail remains available without dominating the sheet.

Preferred leading columns:

1. Mana Cost
2. Card
3. Pre-Release Grade (for prospective sets)
4. Limited Level-Ups
5. Expert Consensus
6. GIH WR

Secondary/detail fields include:

- Color
- Rarity
- Confidence
- Power
- Consistency
- Synergy Reliance
- Primary Role
- Secondary Tags
- Synergy Tags
- Notes
- Limited Resources
- Other Expert
- Games
- ALSA
- OH WR
- 17Lands Notes
- Type
- P/T
- Performance Equivalent
- Grade vs Reality
- Post-Format Notes / Post-Format Grade

Color is retained for sorting/filtering even if hidden/collapsed by default.

The user would eventually like true mana-symbol artwork in the Mana Cost display instead of textual `{2}{W}{U}` notation, while still keeping sortable technical data available.

### 14.2 Row styling and sorting

Desired workbook style:

- muted/subtle color backgrounds by card color
- multicolor uses muted gold
- filterable by color and rarity
- signposts first, then WUBRG, then multicolor, colorless, lands
- compact default view with detail available on demand

### 14.3 Locked vs later fields

For FRA, the following are part of the immutable pre-release snapshot:

- Pre-Release Grade
- Confidence
- Power
- Consistency
- Synergy Reliance
- Primary Role
- Secondary Tags
- Synergy Tags
- pre-release Notes

Later information goes in separate fields:

- Post-Format Grade
- Post-Format Notes
- expert ratings
- expert consensus
- 17Lands metrics
- personal 17Lands metrics

Never repurpose the original prediction columns as "current opinion" columns.

## 15. Expert comparison model

Primary expert sources currently planned:

- Limited Level-Ups
- Limited Resources
- optional other experts

Rules:

- Preserve each creator's raw grade/label.
- Normalize only in a separate derived calculation if needed.
- Do not show expert grades to the user during independent pre-release grading.
- Add expert comparison only after the user's grading snapshot is locked.

A canonical numeric grade rank for calculations can be:

- A+ = 12
- A = 11
- A- = 10
- B+ = 9
- B = 8
- B- = 7
- C+ = 6
- C = 5
- C- = 4
- D+ = 3
- D = 2
- D- = 1
- F = 0

If a difference column is used, define the sign clearly, e.g. positive = user rated higher than comparator.

## 16. 17Lands comparison model

Desired global fields include:

- GIH WR
- OH WR
- Games / sample size
- ALSA

Desired personal fields when obtainable:

- Personal GIH WR
- Personal OH WR
- Personal Games
- copies drafted/played if available
- overall personal win rate
- personal vs global deltas

Small samples should still be retained; show N rather than hiding them or inventing a separate reliability score.

### 16.1 Historical snapshots

Long-term `17Lands History` should retain multiple snapshots rather than only final values.

Suggested global cadence:

- Day 3–4
- Week 1
- Week 2
- Week 4
- Final

Suggested personal cadence:

- Week 1
- Week 2
- Week 4
- Final

The main Card Ratings sheet can show the latest/final headline metrics while the History sheet preserves time-series snapshots.

## 17. Set mechanics analysis

Mechanic categories:

- Power
- Fun to Play With
- Fun to Play Against
- Synergy Reliance
- Desire to Return
- Likelihood to Return
- Notes

Each quantitative field is 1–5 with default 3.

For prospective sets, preserve two snapshots:

- Pre-format expectation
- Post-format evaluation

This enables analysis of not only card-evaluation accuracy but also predictions about set design and play experience.

## 18. Long-term analytical questions

The system should eventually make it easy to answer questions such as:

- Does the user overrate or underrate synergy-dependent cards?
- Are high-confidence predictions more accurate than low-confidence predictions?
- Does the user systematically underrate raw Power but correctly identify Consistency?
- Which Primary Roles produce the largest disagreements with experts?
- Are differences concentrated in specific colors/rarities?
- Does the user evaluate commons differently from rares/mythics?
- Which tags correlate with overperformance or underperformance relative to initial grades?
- Do pre-format mechanic predictions match post-format experience?

Avoid drawing strong conclusions from very small slices. Always retain sample sizes.

## 19. Recommended architecture evolution

Short term:

- Keep the app static and simple.
- Preserve local-first grading.
- Improve imports and configuration without introducing unnecessary infrastructure.
- Add automated tests around pure functions and state migrations if practical.

Medium term:

- Add a reproducible script that converts a backup JSON into a standard analysis table/workbook input.
- Add explicit snapshot/stage metadata (`pre-release`, `post-format`, etc.) instead of relying only on workbook conventions.
- Make set mechanics configurable rather than DSK-hardcoded.
- Consider an explicit Limited-environment definition so bonus-sheet and Draft-pool composition are correct.
- Consider card search and explicit grade locking if they improve workflow without adding friction.

Cloud sync/authentication is now explicitly requested for personal cross-device use. Implement it in a later milestone while retaining low-friction offline grading.

## 20. Development/testing expectations

Before committing a meaningful change:

1. Inspect the existing implementation first; do not replace the app wholesale without reason.
2. State which files and data structures will change.
3. Preserve the storage key and write migrations for schema changes.
4. Test against a real exported backup.
5. Exercise the complete grading flow on a narrow/mobile viewport.
6. Verify set import using both DSK and FRA.
7. Verify tag clicks preserve unsaved form state.
8. Verify JSON export/import round-trip.
9. Verify service-worker version/update behavior.
10. Keep release notes/version values synchronized across app assets.

For spreadsheet changes:

1. Treat locked pre-release fields as immutable.
2. Keep raw expert data separate from derived consensus.
3. Keep sample sizes adjacent to performance metrics.
4. Preserve sort/filter helper data even when hidden from the compact default view.
5. Verify formulas after column reordering.
6. Scan for formula errors before delivering.

## 21. Handoff files to keep together

Recommended Codex working inputs:

- repository `WhyNotVoidberg/mtg-limited-grader`
- `AGENTS.md`
- `PROJECT_SPEC.md`
- locked FRA JSON backup exported 2026-09-21
- `Reality_Fracture_PreRelease_LOCKED_2026-09-21.xlsx`

The public repo should contain code and nonpersonal project documentation. Personal grades/backups/workbooks should remain local/private unless the user explicitly chooses otherwise.
