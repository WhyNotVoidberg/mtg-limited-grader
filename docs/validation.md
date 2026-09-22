# v1.5 local validation — 2026-09-22

## Completed

- 12 Node regression tests passed, including malformed/cancelled imports, both
  conflict policies, failed recovery/primary writes, legacy migration idempotence,
  stale/unopened form protection, and preservation of manually cleared tags.
- Private real JSON backup imported and exported with every field unchanged.
  FRA remained at 285 cards, 280 grades, and five ungraded basics. Private files
  were read directly, not added as repository fixtures.
- Headless Microsoft Edge: desktop 1440×1000 and mobile-sized 390×844 grading flows
  passed. Verified fields, tags without scroll jumps, navigation, gallery badges,
  import policies, and JSON export. Reviewed screenshots of both grading layouts
  and the mobile Data controls.
- Real backup imported twice in an isolated browser context, testing actual browser
  quotas. IndexedDB recovery data exactly matched the source on the second import.
- Actual Edge service-worker transition from origin/main v1.4 to v1.5 passed on
  reload: new assets/version, removal of the v1.4 cache, existing grade preservation,
  and subsequent offline shell loading.
- DSK booster import and FRA paper fallback were exercised with deterministic API
  responses. This verifies the paths, not current live Scryfall availability.

## Release checks

- After deployment, verify the upgrade on an installed iPhone Home Screen PWA. Desktop Chromium and
  a narrow viewport do not establish Safari/Home Screen lifecycle behavior.
- Live Scryfall search smoke checks passed: DSK booster query returned 276 cards;
  FRA paper query returned 285 cards. Browser fallback/pagination logic is covered
  by the local tests. No production browser storage was modified during testing.
- User reviewed the local preview and authorized publication of v1.5.

## Reproduce

Run from the repository root with Node:

```text
node --test tests/reliability.test.cjs
node tests/browser.cjs
```

The browser suite needs Playwright and Microsoft Edge installed. Set NODE_PATH if
Playwright is provided by an external runtime instead of local node_modules.
Optional environment variables:

- `MTG_TEST_BACKUP`: absolute path to a private original JSON export; enables the
  real-data round-trip checks. Never commit that file.
- `MTG_TEST_GIT`: Git executable path; enables upgrade testing against origin/main.

Browser screenshots are generated in ignored `test-results/`. Browser test data
is synthetic except for the optional isolated real-backup check, which does not
print assessments or capture them in screenshots.
