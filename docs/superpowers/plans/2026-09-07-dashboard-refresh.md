# Dashboard refresh implementation plan

**Goal:** Implement the approved dashboard refresh while preserving the existing working tree.
**Architecture:** Keep MapLibre mounted, update route data in place, and atomically publish resolved parcel details with geometry. Use existing ECharts and Angular signals. Keep shader fallback independent of renderer readiness.
**Tech stack:** Angular 22, MapLibre 6, ECharts 6, shaders.

## Constraints

Preserve existing map tiles and actual parcel data. Respect reduced motion. Keep both lower panels at 620px, show at most seven recent parcels, and avoid nested scrolling. No new dependencies or location permission prompts. Execute inline as already authorized.

## Tasks

- [x] Map: replace `src/app/shared/components/route-map/route-map.ts` lifecycle with a persistent map, ResizeObserver, interactive controls, route source updates, cancellable line reveal and animated bounds. Add house/rider SVG marker artwork in a focused helper. Keep the current route-map inputs; add a bottom inset input for the summary overlay.
- [x] Parcel card: update active-delivery-card TS/HTML/CSS to always display details and inline navigation. Resolve details and geometry before publishing the selected parcel; ignore stale requests. Clear to the country view when no route is available. Add order date to dashboard models and mapper. Always render the card in app-home, including empty deliveries.
- [x] Artwork: inspect library texture readiness, correct tablet art dimensions, retain fallback on renderer/texture failure, and clean up animation/listeners. Verify portrait and landscape at tablet widths.
- [x] Activity and surfaces: use the existing ECharts bar registration with `type: 'bar', stack: 'parcels'`, rounded ends, actual period totals, accessible status summary and data table. Apply local violet surface accents in app-home and dashboard cards, preserving other app pages.
- [x] Verification: format touched files, run production build and existing tests; add route-switch regression tests with delayed responses. Inspect populated/empty states and responsive sizing using available browser tooling. Review the final changes and document any unavailable device checks.


## Validation results

- Production build passed with warnings for the 542.47 kB initial bundle (500 kB warning threshold) and app-shell CSS (16.28 kB against 16 kB warning threshold).
- Focused dashboard and routing suite: 12 tests passed, including range consistency, status grouping, route splitting, recenter support, stale responses and map reuse.
- Full suite: 100 passed, 2 failed. Failures are in footer link expectations and reduced-motion haptics, outside this change.
- The repository-wide formatting check still reports 50 pre-existing files outside the touched dashboard paths. `git diff --check` passed for the dashboard changes, and all touched dashboard files were formatted with Prettier.
- Independent code review completed. Corrected responsive canvas sizing, mobile implicit grid tracks, bounded navigation after list shrinkage and map style-error fallback.
- MapLibre stylesheet added to served map assets for navigation controls and marker positioning; its presence in the final build was verified.
- Playwright used the installed Chromium build to verify the populated dashboard at 1440px and 1024px. The map loaded without browser errors; drag changed the camera, Recenter restored the exact route bounds, the travelled layer was dashed, three map markers rendered, both lower panels measured 618px inside their borders, and the compact summary measured 348×196px. At 1024px, the lower panels stack at 687px wide. The shader remained sized to its artwork host.
- Country overview uses profile country when present; Nigeria is the service-country fallback. Rider position remains an estimate from delivery stage, with that meaning exposed in its accessible description.
- Existing working-tree edits were preserved. No deployment or publication performed.
