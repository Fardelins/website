# Search Spotlight Implementation Plan

> **For agentic workers:** Implement inline and verify the search component through focused tests and a production build.

**Goal:** Give dashboard search a branded visual treatment and make its no-results state an interactive search metaphor.

**Architecture:** Retain the existing command palette and reusable ASCII spotlight component. Use CSS masks driven by pointer-position custom properties so animation remains GPU-friendly and avoids per-character DOM updates.

**Tech Stack:** Angular 22, CSS masks and gradients, requestAnimationFrame.

## Global Constraints

- Preserve keyboard and screen-reader access to search actions.
- Respect reduced-motion preferences.
- Avoid new runtime dependencies.

### Task 1: Branded search trigger

- [ ] Replace the grey search treatment with a restrained purple surface, accent border, icon well, and shortcut badge.
- [ ] Preserve existing responsive hiding and focus behavior.

### Task 2: ASCII flashlight scene

- [ ] Make the grid span the entire no-results canvas.
- [ ] Increase cipher density and wordmark scale.
- [ ] Reveal the cipher and wordmark through the pointer-driven beam.
- [ ] Remove the opaque content plate and retain clear recovery actions.
- [ ] Verify formatting, focused tests, and the production build.
