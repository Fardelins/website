# Send Card Studio Stage Design

**Status:** Approved for implementation

## Purpose

The dashboard send card is the primary call to action on `/app`, but it currently reads as a flat purple panel with a static illustration. Make it feel like a lit product stage — a physical object photographed on a seamless purple backdrop, with light that responds to the cursor — so the primary action draws the eye without shouting.

Scope is this one card. The rotating multi-variant pattern from the reference material (different art and headline per context) is explicitly out of scope.

## Experience principles

- Alive at rest, responsive on approach. Ambient light drifts slowly with no input; the cursor nudges it.
- Restraint over spectacle. This card is seen every session. Motion is slow, damped, and clamped — it must never compete with the headline or the CTA.
- The light serves the product. The key light pools bottom-right behind the parcel art, reinforcing the lit-object read rather than decorating the whole panel.
- Degrade to something good. Every fallback path lands on the existing purple gradient, which stays as the card's CSS background.

## Component shape

A new `send-card-stage` component renders the lit backdrop and nothing else. It mirrors the existing `hero-liquid-background` pattern: a thin wrapper that owns a shader preset and hands it to the shared `ShaderBackground`.

`send-parcel-card` continues to own its content, CTA, and layout. It also owns the pointer listener, because the whole card is the hover surface, and passes a normalized `{ x, y }` pointer position down to the stage as an input signal.

This is one-way data flow: the parent owns the state, the child receives it. The alternative — the stage reaching up to `parentElement`, as `TiltDirective` does — works and has precedent in this codebase, but upward reaching hides a component's dependencies from its own signature and makes it harder to test in isolation.

## Visual treatment

A single `StudioBackground` node. No nesting is required; it provides key, fill, and back lights, vignette, and ambient drift internally.

| Prop | Value | Reason |
| --- | --- | --- |
| `color` | `#3a1370` | Deep purple cove, darker than the current gradient so lights read against it |
| `keyColor` | `#b57bff` | Bright violet key light |
| `fillColor` | `#6d28d9` | Matches the existing card gradient mid-tone |
| `backColor` | `#8a38f5` | Matches the marketing hero's bright end |
| `keyIntensity` | `55` | |
| `keySoftness` | `65` | Diffuse enough to avoid a hard spotlight edge |
| `fillIntensity` | `18` | |
| `backIntensity` | `28` | |
| `brightness` | `18` | Ambient floor |
| `vignette` | `25` | Darkens edges, protects headline legibility |
| `center` | `{ x: 0.72, y: 0.78 }` | Anchor: where the light meets the floor, behind the art |
| `lightTarget` | `85` | Depth dial, not an aim point |
| `wallCurvature` | `18` | Gentle cove |
| `ambientIntensity` | `40` | |
| `ambientSpeed` | `0.6` | The library default of `2` is far too fast for a surface seen daily |

Values are a starting point derived from the shader's prop metadata, not from seeing it render. They are expected to be tuned live.

## Interaction

Two layers move at different depths, which is what produces the sense of physical space.

**Ground.** Pointer position drives the `center` prop through `ShaderBackground.update()`, which patches the live uniform without rebuilding the shader. Two constraints apply:

- **Clamped.** `center` travels no more than `±0.12` on x and `±0.10` on y around its anchor, so the light stays in the art quadrant and never wanders under the headline.
- **Damped.** The current value eases toward the target each animation frame rather than snapping, using the same lerp approach as `TiltDirective`. On pointer leave it eases back to the anchor.

**Art.** The existing `TiltDirective` applies roughly 8 degrees of tilt with `appTiltSurface="parent"`, so the entire card is the interaction surface.

Copy does not tilt. Rotating text costs legibility and reads cheap.

## Copy

The card's current copy is functional but flat. New copy, with every claim verifiable from the existing product:

- **Headline, returning user:** `What are we moving today?`
- **Headline, first parcel:** `Your first delivery starts here`
- **Supporting line:** `Compare couriers, pick your price, track it door to door.`
- **CTA:** `Create delivery` (unchanged; clear, and already routed)

The supporting line is grounded in shipped behaviour: `/public/get-shipment-rates` returns multiple couriers with prices and ratings, and the tracking feature exposes door-to-door status. No timing, pricing, or guarantee claims are made, because none are verifiable from the codebase.

No micro-reassurance line is added. The reference material uses one, but every candidate would assert something unverified.

## Fallbacks

1. **Low-end and data-saver devices.** `deviceCanAffordShader()` bails before the ~360 KB import. The canvas stays transparent and the card's existing CSS purple gradient shows through. No new work.
2. **Reduced motion.** The preset sets `ambientSpeed: 0` and `ShaderBackground.renderStill()` paints a single static lit frame. Pointer-driven updates are skipped. `TiltDirective` already self-disables.
3. **Touch devices.** No cursor, so the interactive layer is inherently desktop-only; touch gets ambient drift only. No tilt or scroll substitute is invented.
4. **Small screens.** Below 520px the art is already hidden and the shader is disabled: no hover is available, and it is battery spend for a sliver of purple.
5. **Server-side rendering.** `ShaderBackground` is already browser-only.

## Verification

Type check and the existing unit suite must stay green. Beyond that, this change is visual and cannot be verified by assertion — the shader values are educated guesses from prop metadata. It must be run with `npm start` and reviewed in a browser, at desktop width and below 520px, and with reduced motion enabled.

## Open dials

- **Godrays.** Omitted. They would add drama but risk competing with the headline. Cheap to add as a nested node later.
- **Shadow coherence.** The art's `drop-shadow` is currently fixed. It could shift opposite the moving key light. Deferred as polish; not worth the complexity until the base reads well.
