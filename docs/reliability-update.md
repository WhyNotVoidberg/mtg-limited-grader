# Reliability update (v1.5)

## Storage and migration behavior

The primary storage key remains `mtgLimitedGraderV1`, with the existing JSON shape.
There is no new assessment schema or historical lock in this release. FRA's original
files remain private and unchanged. Test them by path, never as committed fixtures.

Existing legacy migrations remain supported, including F+/F- to F. Values from 1–5
are ambiguous in old unversioned card backups, so do not guess that they were 1–10.
Do not broaden that historical conversion without provenance. Import migration runs
on a detached copy before combining it with current state.

Only a form bound to a rendered card may save. Leaving that form invalidates its
binding. Text/select edits save immediately; page hiding also flushes pending input.
Defaults stay intentional. Existing explicit tag arrays, including empty arrays,
must survive the first render of an older rating.

Imports validate the complete backup before changing state. They retain all current
sets/cards and unknown fields. New card and mechanic assessments are added. On a
conflict, the default keeps the entire existing assessment (including intentional
blanks); the user can explicitly choose the backup assessment instead. Conflicts
are counted and confirmed before writing. Metadata merges retain current values
and add missing fields/cards. Successful imports return to Sets with no stale form.

Before import, store the previous state in IndexedDB (`mtgLimitedGraderRecovery`,
`backups` store, `beforeImport` key). This avoids doubling usage of the much smaller
localStorage quota. A Data button exports that recovery copy. Only after both recovery and primary writes
succeed is the active in-memory state replaced. A failed primary write leaves the
original primary state intact. Invalid startup data stops initialization instead
of being replaced by an empty state. Storage failures remain visible, and exporting
the in-memory backup remains possible.

## Validation

Use Node's built-in test runner for isolated DOM/state regression tests. The optional
`MTG_TEST_BACKUP` environment variable points at a private real backup. Browser checks
exercise desktop/mobile navigation, input, tag clicks, import and export, and scroll
behavior. An installed iPhone Home Screen PWA update remains a device verification
step; a desktop browser does not establish that behavior.
