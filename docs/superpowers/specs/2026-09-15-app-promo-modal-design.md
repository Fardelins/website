# App promo modal design

Date: 2026-09-15

## Problem

The customer dashboard pitched the mobile app with a static `Fardelins Mobile App` card parked in
profile settings. Nobody goes to settings to discover an app, so the pitch sat where intent was
lowest and took up a settings row that had nothing to do with the rest of the page.

## Approach

Replace the card with one modal that appears at moments where a phone is obviously the better
device, governed by a single service that owns the cadence. Call sites report a moment, never a
decision.

## Components

### `AppPromoService` (`src/app/features/app-promo/app-promo.service.ts`)

The only thing that decides whether the prompt appears. Pages call `request(trigger)`; the service
applies the cadence and, if eligible, flips its `active` signal after a 900ms settle delay so the
prompt never collides with a page landing.

Cadence:

| rule | value |
| --- | --- |
| per session | 1 |
| between prompts | 14 days |
| `Not now` | snooze 30 days |
| `Get the app` | retire permanently |
| 2nd dismissal (close or backdrop) | retire permanently |

`first-signin` and `milestone` are one-shot per account on top of that.

State persists in `localStorage` under `fardelins.app-promo.<userId>`, so a second account signing
in on the same browser starts clean. A storage failure (private browsing) degrades to the
in-memory session guard alone rather than throwing.

`open()` is the manual path used by the sidebar account menu, and deliberately bypasses cadence.

### `AppPromoModal` (`src/app/features/app-promo/components/app-promo-modal/`)

Media-top card. The panel holds a brand gradient wash plus a drifting dot field, and a flip card
that rotates 180 degrees on the Y axis between a phone screenshot and a live QR code.

- The QR is encoded at open time with `qrcode-generator` (already a dependency, lazily imported)
  and points at `/download?ref=promo-<trigger>`, so desktop viewers get something they can act on.
- The QR sits on a fixed white plate in both themes. A dark QR on a dark card does not scan.
- Default face follows the device: QR on desktop, phone screenshot on mobile, where the store
  button is the thing that matters.
- `prefers-reduced-motion` swaps the flip for a cross-fade and stops the dot drift.
- The primary CTA is platform-aware through `AppPlatformService`. Store URLs are still empty in
  `APP_DOWNLOAD_CONFIG`, so it currently routes to `/download` instead of leaving the site.
- `Send a link to my phone` is built but gated behind `APP_DOWNLOAD_CONFIG.sendLink.enabled`,
  which ships `false` until the backend endpoint exists. Nothing non-functional is on screen.

Copy varies per trigger through `APP_PROMO_COPY`, since a first sign-in and a just-booked parcel
are not the same pitch.

### Mount point

Mounted once in `app-shell.html` beside the command palette. Singleton overlay at the shell root,
not per page.

## Triggers

| trigger | call site | condition |
| --- | --- | --- |
| `first-signin` | `app-home` after the deliveries list resolves | no delivery history |
| `milestone` | `app-home` after the deliveries list resolves | 3+ deliveries, or one handed over |
| `order-success` | `order-success` constructor | always, cadence permitting |
| `profile-saved` | `profile` save profile and save address | on success only |
| `manual` | sidebar account menu | user asked, no cadence |

`delivered` means out-for-delivery in this API, so a handover is `received` or `completed`.

## Removed

The `app-download` aside in `profile.html` and its CSS. The path stays reachable through the new
`Get the mobile app` item in the sidebar account menu, and through `/download` as before.

## Verification

Playwright against an isolated dev server on port 4271: the prompt auto-opens on the dashboard
without help, starts on the QR face on desktop, renders real QR modules, flips to the phone face,
closes, and reopens from the account menu after a dismissal. Screenshots checked in dark, light,
and at 400px width, where the card becomes a bottom sheet.
