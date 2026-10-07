# Dashboard refresh

Design approved by the user on September 7, 2026. Implementation completed; validation notes are in the implementation plan.

## Direction

Keep the existing dashboard structure and map style. Give surfaces subtle violet tint, clearer elevation, stronger typography and purposeful status colour in both themes. Preserve existing work already present in the workspace.

Activity options considered: rounded stacked bars (recommended for comparing actual parcel counts and status by period), a calendar heatmap (good for frequency but weaker for status), or refreshed area curves (less visual change and overlapping series remain harder to compare).

## Shader and artwork

Investigate the dashboard artwork shader separately from the background shader. Verify tablet portrait/landscape sizing, readiness, texture loading and resize handling. Keep the PNG visible until rendered artwork can replace it; recover the fallback on failure. Respect reduced motion and avoid hiding artwork when shader support is unavailable.

## Activity

Use rounded stacked columns, expressive status colours, a prominent period total, compact status totals and hover/tap detail. Keep the current range selector and actual data semantics. Provide a readable empty state, accessible totals and reduced-motion behaviour. Do not introduce fictional activity.

## Map and recent parcels

Use a shared fixed row height when side by side, initially 520px, with internal scrolling for the parcel list. Stack cleanly on smaller screens with sufficient map space for controls and the summary card. Preserve the map's current tile style.

Keep a single MapLibre instance alive across parcel changes. Enable drag, touch pan, pinch zoom and accessible zoom buttons. Resize with its container. Update route source and markers in place, smoothly frame new bounds and redraw the route without replacing the map with a loading state. Respect reduced motion. Ignore stale asynchronous responses and prefetch/cache routes where useful. Keep route and visible parcel details consistent during switching and handle unavailable addresses without displaying the previous parcel as the new one.

Show distinct isometric house markers for From and To, plus a rider marker along the route. The existing position is derived from delivery stage, not GPS; use an accessible marker description that reflects this.

Always show a compact summary card containing receiver name, item name, order date, status chip, From and To, a View parcel link, and previous/next controls with position count. Remove collapse/expand, arrival, phase steps and supplementary small captions. Frame the route clear of the card.

For no active parcels, retain the same framed map container and show a country overview using an available profile/address country. Use a configured service-country fallback when country is unknown; do not prompt for location automatically. Add a concise empty-state message and send-parcel action. Provide a styled fallback if map resources cannot load.

## Verification

Run the production build and relevant existing tests. Add focused regression coverage for asynchronous route switching if supported by existing test infrastructure. Check tablet portrait/landscape, desktop and mobile, both themes, empty and populated states, long addresses, rapid next/previous, map controls, shader failure and reduced motion. Report any device-specific checks that cannot be reproduced locally.
