# QR Sign-in Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a rounded, branded QR sign-in code whose rainbow color appears only through a localized pointer-following spotlight.

**Architecture:** Keep QR generation and countdown ownership inside `QrSignin`. Generate one scan-safe render model, draw it twice as aligned SVG layers, and reveal the rainbow layer with a CSS radial mask. The centered app mark is protected by omitting modules from a small center region while high error correction preserves scan reliability.

**Tech Stack:** Angular 22 standalone components, signals, SVG, CSS masks, `qrcode-generator`, Solar icons.

## Global Constraints

- The rainbow must color QR modules only, never the white plate or outer frame.
- Preserve the existing payload, countdown, skeleton, reveal, refresh, and expiry behavior.
- Use `/home/app-icon.svg`; add no asset or icon dependency.
- Keep pointer, touch, keyboard, and reduced-motion behavior accessible.

---

### Task 1: Build a scan-safe rounded QR render model

**Files:**

- Modify: `src/app/features/auth/components/qr-signin/qr-signin.ts`

**Interfaces:**

- Consumes: `qrcode-generator` dark-module matrix.
- Produces: `modules: QrModule[]`, `finders: FinderPattern[]`, and center-clearance geometry used by both SVG layers.

- [x] **Step 1: Switch QR generation from error correction `M` to `H`.**

Use `qrcode(0, 'H')` so the protected center remains recoverable by scanners.

- [x] **Step 2: Exclude finder-pattern and center-logo cells from ordinary modules.**

Add exact helpers `isFinderModule(row, col, size): boolean` and `isLogoModule(row, col, size): boolean`; finder regions are the three 7×7 corners and the logo region is the centered 7×7 square.

- [x] **Step 3: Expose finder geometry and pointer reset methods.**

Add `FinderPattern { x: number; y: number }`, a computed three-item finder list offset by the quiet zone, `trackSpotlight(event: PointerEvent)`, `finishSpotlight(event: PointerEvent)`, and `resetSpotlight()`.

- [x] **Step 4: Run the TypeScript check.**

Run: `npx tsc --noEmit`
Expected: exit code 0.

### Task 2: Render aligned purple and rainbow QR layers

**Files:**

- Modify: `src/app/features/auth/components/qr-signin/qr-signin.html`
- Modify: `src/app/features/auth/components/qr-signin/qr-signin.css`

**Interfaces:**

- Consumes: the shared `modules`, `finders`, and `viewBox` from Task 1.
- Produces: `.qr__code--base` and `.qr__code--rainbow` layers with identical geometry.

- [x] **Step 1: Replace the single SVG with a two-layer SVG stack.**

Each layer renders rounded ordinary modules, rounded 7×7 finder frames, white 5×5 finder gaps, and circular 3-module finder centers.

- [x] **Step 2: Add the centered app mark.**

Place `/home/app-icon.svg` in an absolutely centered, decorative `.qr__logo` badge above both SVG layers.

- [x] **Step 3: Apply the localized rainbow mask.**

Fill only `.qr__code--rainbow` from a six-stop SVG spectrum gradient and use a soft radial CSS mask centered on `--mx` and `--my`. Keep the white plate unchanged.

- [x] **Step 4: Preserve reveal and expiry states.**

Apply module reveal animations to both SVG layers and fade the entire layer stack during expiry.

### Task 3: Refine refresh action and interaction states

**Files:**

- Modify: `src/app/features/auth/components/qr-signin/qr-signin.html`
- Modify: `src/app/features/auth/components/qr-signin/qr-signin.css`

**Interfaces:**

- Consumes: existing `refresh()` and `expired()` behavior.
- Produces: `.qr__refresh` pill and responsive spotlight interaction.

- [x] **Step 1: Replace the generic expired button classes with `.qr__refresh`.**

Style a purple pill with white text, refresh icon, 44px minimum height, hover lift, and visible focus ring.

- [x] **Step 2: Wire pointer and touch lifecycle events.**

Track pointer movement over the plate, reset on pointer leave/cancel, and reset on non-mouse pointer up.

- [x] **Step 3: Honor reduced motion.**

Disable spotlight and button easing while retaining the localized color response.

- [x] **Step 4: Verify formatting and compilation.**

Run: `npx prettier --check src/app/features/auth/components/qr-signin/qr-signin.{ts,html,css}`
Expected: all matched files use Prettier style.

Run: `npx tsc --noEmit`
Expected: exit code 0.

Run: `npm run build`
Expected: Angular build completes; any existing bundle-budget warning is reported separately.

- [ ] **Step 5: Manual scan and interaction check.**

Open login QR mode, scan at desktop and phone widths, confirm the pointer spotlight affects modules only, confirm the logo is centered, and let the code expire to verify the pill refresh action.
