# QR Sign-in Visual Refinement

## Goal

Refine the existing QR sign-in panel so the code feels branded and tactile without reducing scan reliability. The pointer interaction should behave like a rainbow torchlight that colors only nearby QR modules, never the surrounding white plate.

## Visual design

- Keep a solid Fardelins purple QR layer as the default state.
- Render a second rainbow QR layer directly above the base layer.
- Reveal the rainbow layer through a small, soft-edged circular mask centered on the current pointer or touch position.
- Reset the spotlight to the center after pointer exit or touch completion.
- Render ordinary dark modules as rounded squares.
- Render the three finder patterns with rounded outer and inner shapes so they remain visually distinct and scannable.
- Place only the Fardelins app mark at the exact center inside a compact white badge.
- Replace the expired-state refresh action with a purple pill button containing the refresh icon and “Get a new one”.

## QR generation and reliability

- Generate the code with high error correction (`H`) to tolerate the centered mark.
- Reserve a small square region around the QR center by omitting modules from both rendered layers there.
- Keep the existing quiet zone intact.
- Use the same module data for the purple and rainbow layers so the masked layer aligns perfectly.
- Preserve the current payload, countdown, refresh behavior, skeleton, reveal animation, and expired-state logic.

## Interaction

- Pointer movement updates CSS custom properties for the spotlight center.
- The spotlight mask affects only the rainbow QR layer.
- Touch movement uses the same coordinate path.
- Pointer leave and touch end return the spotlight to the center.
- Reduced-motion mode disables animated easing but retains the localized color response.

## Assets

- Use the existing `/home/app-icon.svg` asset for the centered Fardelins mark.
- Do not add new image or icon dependencies.

## Accessibility

- Keep the QR SVG’s existing accessible name.
- Treat the centered logo and rainbow layer as decorative.
- Retain the expired-state text and button semantics.
- Preserve a visible keyboard focus state on the refresh pill.

## Verification

- Confirm the rainbow never colors the white QR plate or outer container.
- Confirm the spotlight tracks pointer and touch coordinates locally.
- Scan the QR at desktop and phone sizes after adding rounded modules and the center mark.
- Verify refresh, expiry, skeleton, reduced-motion, and keyboard focus behavior.
- Run formatting, TypeScript, and Angular template checks.
