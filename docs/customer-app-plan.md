# Customer Web App — plan & findings

Living document. Owner: Bami. Backend counterpart: Joseph.

Everything below was checked against the live spec at `https://staging.fardelins.com/api-json`
on 2026-08-03. Where something says "missing", it means the endpoint genuinely isn't in the
spec — not that it's undocumented.

---

## 0. Where we stopped (2026-10-07)

**Built and working on dev** (verified in a browser and with unit tests): send-a-parcel wizard with
five steps (Package, Pickup, Drop-off, Delivery, Courier), including office or door delivery and
priority, photos required, phone numbers converted to `+234`, prices from the chosen options;
Paystack payment and the return page (with a transactions fallback); My parcels (paging, filters,
"Awaiting payment" status); parcel page (photos carousel with lightbox, status rules, cancel dialog,
Complete payment); transactions and receipts; storefront courier picker.

**Also built (2026-10-07):** a shared toast system (`@core/services/toast.service.ts` and `<app-toaster>`
in the app shell) that confirms or reports failure for storefront actions, every settings save, parcel
refresh and cancel, receipt download and order failure. Failed courier loads now surface instead of
returning an empty list.

**Waiting on BE** (the full numbered list is in the Claude Docs backend doc, section "Open list for
BE, 2026-10-07"): cancel answers 400 after applying and leaves the order pending; the refund for a
cancelled paid shipment doesn't exist yet although the dialog promises it; photos aren't enforced;
customers can't download an invoice (both invoice endpoints answer 403);
seed durations make the expected date 74 days; the chosen box size isn't on the row; emails;
recipient safety for `@username` orders; webhook and callback URL setup.

**Held on purpose:** `@username` auto-fill (until recipient safety exists); the refund promise in the
cancel dialog must not go live before BE refunds; showing an expected delivery date (until the seed
durations are sane).

**To retest when BE's next PR is on dev:** cancel (response, order status, pay-again refused), a
paid-order cancel with a real Paystack test payment (card 4084 0840 8408 4081, any future expiry,
CVV 408), photos enforced, seed durations, emails, the invoice.

**Working notes:**

- Tests: `npm test -- --no-watch --include=<spec path>` in PowerShell (calling `vitest` directly
  fails; the Bash tool has had no PATH in this setup).
- The BE backend repo is private and not readable with the shared GitHub login; only the Bruno
  collection (`Fardelins/delivery-bruno-api`) and the website repo are. Dev data comes from
  `https://staging.fardelins.com/v1` (Swagger at `/api-json`).
- A test account on staging holds many unpaid test orders; BE only has Abuja/Durumi rates.
- Dev builds send `mode: "demo"`; production builds send `live`.
- Known quirks recorded in the changelog below: the shipments list is filtered by user, door delivery
  is the default, rate durations are days, Paystack redirects to `https://localhost:3000` until BE
  makes the callback configurable (edit the host to `http://localhost:4200` to test the return page).

---

## 1. Decisions made

| Decision      | Choice                                                       | Why                                                                                           |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Repo          | This one (`fardelins-landing-page`)                          | Reuses design tokens, shared components, `logistics-api.config.ts`, proxy config. One deploy. |
| URL shape     | `fardelins.com/app/*` — **not** a subdomain                  | See below.                                                                                    |
| Marketing nav | Swaps `Login / Sign Up` → avatar + menu when authenticated   |                                                                                               |
| App chrome    | Own shell — bottom nav on mobile, sidebar on desktop         | Marketing header isn't built for a product surface.                                           |
| Rendering     | `/app/*` is client-rendered; marketing stays prerendered/SSR | Auth-gated pages have no SEO value and must not be prerendered.                               |

### Why not `app.fardelins.com`

`localStorage` is partitioned by **origin** (scheme + host + port). `app.fardelins.com` and
`fardelins.com` are different origins and cannot read each other's storage. If the token lives
in `localStorage` on a subdomain, the marketing site has no way to know you're logged in — which
breaks the nav-swap decision above.

Cookies are the exception: a cookie set with `Domain=.fardelins.com` _is_ shared across
subdomains. So a subdomain works **only if** BE sets an httpOnly cookie rather than returning
tokens as JSON. That isn't the case today.

Same-origin `/app/*` gets the nav swap for free, avoids CORS, and needs no cookie-domain
negotiation. Moving to a subdomain later is a deploy/config change, not a rewrite — the
feature-first structure keeps the app extractable.

---

## 2. Scope decisions — cut, deferred, and the one real blocker

Five things in the designs had no backend behind them. Rather than block on BE, we've cut or
deferred all of them. **Build against what exists.** 2.6 and 2.7 both block work.

### 2.1 Apple sign-in — cut for now

Designs show **"Continue With Apple"**; only `POST /v1/auth/google-oauth` exists.

**Decision: no Apple connection yet.** The button comes out of the build. The flow is being
rethought anyway — the likely direction is _scan a QR code with the Fardelins app to continue_,
which replaces third-party social sign-in rather than adding to it. Revisit when that flow is
designed; it'll need its own endpoints regardless.

### 2.2 Phone OTP (SMS / WhatsApp) — cut for now

Designs show a phone screen, a 6-digit code, and a **"Send Via SMS" / "Send Via WhatsApp"**
channel choice. The spec's OTP flow is email-only (`request-registration-otp` takes `{ email }`).

**Decision: drop the phone-number flow entirely.** Verification is email-only:
`request-registration-otp` → `verify-registration-otp`, or the `auth/verify/{token}` link.
The phone screens from the designs aren't built.

`phone` stays an optional field on `CreateCustomerDto` — collected, just not verified.

**Exception, built: `/signup/phone`.** This is not the cut OTP flow. It is a one-field step for an
account with no phone on file, which only happens after Google sign-in (Google never returns a
phone number). Login and signup send those users there, and `needsPhoneGuard` keeps everyone else
out. The number is saved, still not verified.

**Gap found 2026-10-07, closed the same day:** the step was only enforced at the moment of Google
sign-in, so a Google user could skip it by opening `/app` directly. Decision: a phone is required.
`authGuard` now sends a signed-in user with no phone to `/signup/phone` (asking `/user/me` first, in case
the stored user lags), and back to where they were going afterwards. If that lookup fails the user is let
in rather than locked out.

### 2.3 Login by phone number — cut for now

Designs label the field **"Email Address or Phone Number"**; `EmailLoginDto` is
`{ email, password }`.

**Decision: use what exists.** Email + password only. The field is labelled "Email Address".

### 2.4 Saved cards — deferred

No customer-facing saved-card endpoint exists. (`credit-account/bank` is payout accounts,
not stored cards.)

**Decision: out of scope for now.** Payment goes through the medium picked at checkout each
time. Revisit when BE has somewhere to store a card authorization.

### 2.5 Storefront — deferred

Partly built already (see 3.9 — properties, API keys, `customer-property/*` ordering), but the
public customer-facing side is undefined.

**Decision: out of scope for now.** Notes kept in 3.9 so we don't re-derive them later.

### 2.6 Registration fails for everyone — backend bug ⚠️ **BLOCKING**

Confirmed live against staging on 2026-08-29. `POST /v1/user/register` throws a Prisma error
whenever `currency_id` is omitted, which it always is — `currency_id` is documented as optional
on `CreateCustomerDto`, but `customer-handler.service.js:37` still runs
`currency: { connect: { id: currency_id } }` unconditionally. `connect` with `id: undefined`
is rejected by Prisma:

```
Argument `connect` of type CurrencyWhereUniqueInput needs at least one of `id` arguments.
```

No signup can succeed until BE either skips the `currency.connect` block when `currency_id` is
absent, or makes the field genuinely required and validates it before it reaches Prisma. Not
something to work around client-side — guessing a currency ID to send would mask the bug rather
than fix it (wrong currency assigned, breaks again once they add validation).

### 2.7 Auth response shape — needs confirming ⚠️ **BLOCKING**

`POST /v1/auth/login` documents only a bare `201` with no response schema. Before Phase 0 we
need to know:

- What the success body actually contains (access token, refresh token, user object?)
- Whether tokens come back as JSON or as `Set-Cookie`
- Access token lifetime, and the exact contract for `PATCH /v1/auth/refresh`

**Ask for httpOnly cookies if it's not too late.** It's meaningfully safer than `localStorage`
and keeps the subdomain option open. If tokens stay JSON, our working assumption is: access
token in memory, refresh token in `localStorage`, silent refresh via an HTTP interceptor.

### 2.8 Payment after placing an order — needs confirming

Order Confirmed (`/app/send/:orderId/success`) has no payment step. `POST
/v1/customer-shipment/order/{rate_id}` and `GET
/v1/customer-shipment/pending-payment-request/{medium}/{order_id}` both have no response schema
in the spec, and `medium` has no enum there either.

Cross-checked against the `Fardelins/delivery-bruno-api` repo on 2026-09-25 (not this repo — a
separate collection Joseph maintains). Its `pending payment request.yml` has a saved passing
example against the storefront-scoped `customer-property/shipment-payment-request` variant:

```json
{
  "message": "payment link generated sucessfully.",
  "code": 200,
  "data": {
    "authorization_url": "https://checkout.paystack.com/ianxqrfo9qcbqbn",
    "access_code": "ianxqrfo9qcbqbn",
    "reference": "emrn5ab4qc"
  }
}
```

That answers 6.2 below: Paystack is a redirect (`authorization_url`), not an inline modal. Two
things still block building it:

- Whether the plain (non-storefront) `customer-shipment/pending-payment-request` returns the
  same shape — the only saved example for that exact path in Bruno was a 404 against stale test
  data, not a real pass.
- What `POST /v1/customer-shipment/order/{rate_id}` actually returns: an `order_id` (what the
  payment endpoint's path param is named) or the `tracking_id` we use everywhere else in the app.
  Sending the wrong one would silently fail the redirect.

Until both are confirmed, orders are created unpaid and Order Confirmed has no payment CTA.

**2026-10-01 — found the likely return-page mechanism.** `GET /v1/payment/verify-paystack?reference=`
exists in the live spec, takes `reference` as a required query param, and has no auth annotation
(looks public). Its path matches the hardcoded return URL above exactly, minus `/v1` and the
`localhost:3000` host — reads like the return URL is meant to be a frontend route of ours at
`/payment/verify-paystack`, which would read `reference`/`trxref` off Paystack's redirect and call
this backend endpoint to show the customer a status. No response schema yet.

**Built 2026-10-01.** `/payment/verify-paystack` (`features/payment/`, client-rendered, outside
`/app` so a customer without a restored session still lands somewhere) reads `reference` or
`trxref`, calls the endpoint through `PaymentService.verifyPaystack`, and shows one of: paid,
still confirming (with Check again), failed (Book again), couldn't check, or no reference. With no
schema, it reads `data.status` then `data.data.status` (Paystack's own response passed through)
and treats anything it doesn't recognise as still confirming, never as paid. A failed check is
shown separately from a failed payment, so a network error never tells a customer they weren't
charged. Still needed from BE: point Paystack's callback at our domain, a saved response, and
confirmation that the endpoint works without a bearer token.

### 2.9 Customer cancel — needs confirming

No cancel action exists anywhere in the app; deliveries only ever display an already-`cancelled`
status, nothing lets a customer initiate one.

Confirmed live in the OpenAPI spec on 2026-09-25: `PATCH /v1/user/shipment/{shipment_id}` takes
`CustomerUpdateShipmentStatusDto`, `status` enum `["canceled", "received"]`. Bruno has a matching
(if stale — it points at a different, wrong path) test sending `{ "status": "canceled" }`, which
at least confirms the status values.

Still need:

- Is `shipment_id` the same tracking id used everywhere else (`GET /v1/shipment/{trackingId}`),
  or a different id the app would have to fetch and store separately?
- Up to which status is cancelling allowed?
- Does cancelling refund to the wallet, and if so, immediately or after some review?

### 2.10 Order creation appears broken, plus a data leak in the error ⚠️ **BLOCKING**

Found 2026-09-28 while testing the `recipient_username` question above, with a real sender
token against staging, `source: "Manual"`, `mode: "demo"`. Every `POST
/v1/customer-shipment/order/{rate_id}` attempt returned 400:

```
Argument `record_id` is missing.
```

thrown from an internal `this.prismaService.audit_Log.create()` call that runs after a shipment
is created. This looks like a generic step in the order flow, not something specific to our
payload, so it likely blocks every real order on this environment right now, not just this test.

**Separately, the same error response leaks unrelated data.** The 400 body echoed the full record
the failed insert was trying to write, which contained 12+ distinct phone numbers and 15+
distinct emails that have nothing to do with our request or account. Unclear whether that's real
customer data or dev fixtures, but returning other people's contact details in an error response
is a real exposure on its own. We deleted our local copy of that response and stopped testing
once we saw it, rather than keep retrying against a broken, leaking endpoint.

This blocks confirming the `sender_details` and `recipient_username` questions above (2.8, 2.9,
and the recipient-lookup security review) — we could not get an order to succeed at all.

---

## 3. Feature list → API mapping

Ownership note: items marked _(Joseph)_ in the original list are backend deliverables owed,
not frontend work assigned elsewhere.

### 3.1 Authentication — mostly ready

| Need                     | Endpoint                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register                 | `POST /v1/user/register` — `CreateCustomerDto { first_name*, last_name*, email*, password*, phone, location, invite_code, uploads, currency_id }` |
| Login                    | `POST /v1/auth/login` — `{ email*, password* }`                                                                                                   |
| Google                   | `POST /v1/auth/google-oauth` — `{ token }`                                                                                                        |
| Email verify             | `GET /v1/auth/verify/{token}` · `POST /v1/auth/resend-email-verification`                                                                         |
| Registration OTP         | `POST /v1/account/request-registration-otp` · `POST /v1/account/verify-registration-otp`                                                          |
| Generic OTP              | `POST /v1/auth/validate-otp`                                                                                                                      |
| Forgot / change password | `POST /v1/auth/forgot-password` · `PATCH /v1/auth/change-password`                                                                                |
| Refresh                  | `PATCH /v1/auth/refresh`                                                                                                                          |
| Logout                   | `GET /v1/auth/logout`                                                                                                                             |
| Live availability checks | `GET /v1/user/email-available/{email}` · `/phone-available/{num}` · `/username-available/{username}`                                              |
| Blocked account          | `GET /v1/auth/unblock-account/{token}` · `POST /v1/auth/resend-unblock-email`                                                                     |

The availability endpoints are worth using for inline "email already taken" feedback on the
signup form rather than waiting for a 400 on submit.

**In scope:** email + password signup and login, Google, email verification, forgot/change
password, refresh, logout.

**Not built:** Apple button (2.1), phone-number and OTP screens (2.2), phone login (2.3).
`phone` is still collected on signup as an optional field — just never verified.

We already have `/email-verified` in the marketing app — the verify link flow can keep landing
there.

### 3.2 User profile — ready

| Need                   | Endpoint                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Read / update / delete | `GET, PATCH, DELETE /v1/user/me`                                                                                                       |
| Avatar                 | `POST /v1/upload/avatar`                                                                                                               |
| Password               | `PATCH /v1/user/update-password`                                                                                                       |
| Username               | `PATCH /v1/user/username`                                                                                                              |
| Email change           | `POST /v1/account/email-change/request` → `/confirm`                                                                                   |
| KYC documents          | `GET /v1/verification-document/customer-documents` · `POST /v1/verification-document/upload/{account_type}` · `PATCH /update-document` |

Saved addresses: `GET /v1/user/properties` and `POST /v1/user/property` exist, but a "property"
here is a **storefront/business**, not an address book — see 3.9. If we want saved pickup/dropoff
addresses, confirm whether that's a separate concept or doesn't exist yet.

### 3.3 Public send-item with average price _(Joseph)_ — ready

`POST /v1/public/get-shipment-rates`

```
GetShipmentRatesDto {
  shipment_size_id: number      (required)
  origin_locality:  DynamicLocalityDto  (required)
  dest_locality:    DynamicLocalityDto  (required)
}
DynamicLocalityDto { country*, state*, city }
```

Public — no auth. Feeds both the marketing-side price estimator and the courier-selection step
of Send Delivery (3.5).

Supporting lookups: `GET /v1/category/shipment-sizes`, `GET /v1/locality/countries`,
`POST /v1/dynamic-locality/search`.

**Open question:** the designs' courier list shows logo, star rating, review count, delivery
window and price per courier. Need to confirm the rates response actually carries courier
identity and rating, or that's a second call.

### 3.4 Deliveries & detail — ready

| Need            | Endpoint                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| List            | `GET /v1/customer-shipment/shipments` · `GET /v1/customer-shipment/orders`                                  |
| Detail          | `GET /v1/shipment/{trackingId}`                                                                             |
| Timeline        | `GET, POST /v1/shipment-tracking`                                                                           |
| Invoice PDF     | `GET /v1/shipment/download-invoice/{trackingId}` · `GET /v1/shipment-extras/shipment-invoice/{tracking_id}` |
| Shipping label  | `GET /v1/shipment/download-shipping-label/{trackingId}`                                                     |
| Delivery proof  | `GET/POST/PATCH/DELETE /v1/shipment-extras/delivery-proof/{tracking_id}`                                    |
| Rate a delivery | `POST/GET/PATCH/DELETE /v1/shipment-rating/{tracking_id}`                                                   |
| Pending payment | `GET /v1/customer-shipment/pending-payment-request/{medium}/{order_id}`                                     |

**Checked 2026-10-07 with a customer token (staging).** `GET /shipment/download-invoice/{trackingId}`
and `GET /shipment-extras/shipment-invoice/{tracking_id}` both answer 403 for a customer (401 with
no token), and they are the only invoice paths in the spec, so the Invoice link on the parcel page
cannot work yet and a fetch with the token would not fix it. Same 403 for `GET /shipment-tracking`
and `GET /shipment/download-shipping-label/{trackingId}` (courier-only; the app builds its timeline
from the list row's `tracking[]` and has no label button). `GET /shipment-rating/{tracking_id}`
answers a customer (404 "Record not found" when nothing is rated yet), so rating a delivery is open
to build. `GET /shipment-extras/delivery-proof/{tracking_id}` is in the spec but answers 404 "Cannot
GET" on staging, so it is not deployed.

We already understand the timeline shape from the public `/track` work — note the public
endpoint returns timeline entries in **non-contiguous order**, and `delivered` there means
_out for delivery_, not handed over. Confirm whether the authenticated detail endpoint has
the same quirks before reusing that logic.

### 3.5 Send delivery — ready

Four steps, matching the designs (Package Info → Pick Up → Drop Off → Select Courier).

`POST /v1/customer-shipment/order/{rate_id}`

```
CreateCustomerShipmentDto {
  sender_details:   SenderDetailsDto      (optional, defaults to the profile's saved address)
  receiver_details: ReceiverDetailsDto    (required)
  pickup_type:      office | user         (required)
  source:           API | Manual | Mobile (required — Mobile is the mobile app; web app uses Manual, unconfirmed)
  parcel:           CreateParcelDto       (required)
  mode:             live | demo           (required — live for a real order)
  payment_medium:   card | paystack | flutterwave | squad | usdc   (required)
}

SenderDetailsDto   { sender_fullname, sender_phone, sender_email,
                     sender_city_id, sender_state_id, sender_address }
ReceiverDetailsDto { recipient_username, receiver_fullname, receiver_phone,
                     receiver_email, receiver_location: CreateLocationDto }
CreateLocationDto  { address*, city_id, state_id, country_id, latitude, longitude, zip_code }
CreateParcelDto    { short_description*, type: perishable | non_perishable*, weight*, quantity*,
                     categoryId, long_description, worth, dimension, images (max 4, id or link) }
```

Response: the order endpoint's response is not an order id or tracking id, it's Paystack's
payment initialization data, `{ authorization_url, access_code, reference }` (confirmed
2026-09-28, same shape as 2.8's payment section). The app redirects straight to
`authorization_url` after a successful order; there is no local "your delivery is booked" screen
for a real payment anymore, that page is now only reached for the mock session or a payment
medium with no redirect URL.

Supporting lookups: `GET /v1/category/parcel-categories`, `/parcel-parent-categories`,
`/shipment-sizes`, `GET /v1/unit/weight-units`, `/length-units`,
`POST /v1/dynamic-locality/search`.

Package images: `POST /v1/upload/multiple-images/shipments`, max 4 per parcel (confirmed and
enforced client-side 2026-09-28).

**All four enums answered by BE on 2026-09-28** and fixed on the frontend the same day, along
with a new required Package Type field in step 1 for `parcel.type`. Still open: which of
`API`/`Manual` fits a browser-based web app, only `Mobile` was named; sending `Manual` until
confirmed.

`sender_details` is optional, and BE confirmed on 2026-09-28: when omitted, BE uses the
customer's profile details and saved profile location as the pickup address; `sender_details` is
the way to provide a different one. The app still always sends it, since it's the only field
that carries the pickup address typed in step 2. When sent, all six `SenderDetailsDto` fields are
required, so step 2 asks for a sender email and a city and holds until they are filled.

**Recipient lookup (`recipient_username`), a product decision, not a bug.** BE confirmed on
2026-09-28: `GET /v1/shipment/recipients/search?username=` is unauthenticated (global throttle,
500 requests/60s), and its response's `location` is a boolean only, no real address leaks there.
But when `recipient_username` is sent on an order, it takes precedence over anything typed:
BE silently overwrites `receiver_fullname`/`receiver_phone`/`receiver_location` with the
recipient's saved data. There is no recipient opt-out, discoverability setting, or approval step;
the only signal to the recipient is a shipment-created email sent after the order already exists.
So today, a sender who knows only a username can ship to that person's real address with nothing
else typed, and the recipient finds out after the fact. Holding off building the @username
auto-fill UI until there's at least a pre-dispatch notification the recipient can act on.

**Also found while testing this (2.10, blocking):** every order attempt on staging currently
fails with `Argument record_id is missing` from an internal audit-log write, and that same error
response leaked 12+ unrelated phone numbers and emails. Reported to BE 2026-09-28. This blocks
actually placing an order at all right now, real or otherwise.

### 3.6 Transaction history — ready

`GET /v1/user/transactions` is the customer's own history (`CustomerController_getTransactionHistory_v1`),
switched to on 2026-09-28. `GET /v1/wallet` and `GET /v1/wallet/transactions` also exist but are
the wallet ledger, not what the customer history is built on.

The spec types the response as a bare `object`, but the backend described it on 2026-09-28. Rows
are payments for shipments: `id`, `payment_method`, `amount`, `admin_fee`, `admin_interest`,
`status`, `mode`, `shipment_id`, `created_at`, `updated_at`, `transaction`. Paging is
`total_count`, `limit`, `current_count`, `page`, `total_pages`, `has_next_page`, `has_prev_page`,
and a `limit` of 1000 is accepted. The app follows `has_next_page` at 100 rows per page, up to 1,000
rows, and shows every row as money out (a positive `amount` here is a payment, not a credit).

Still open: `transaction` was `null` on the pending rows tested, so its fields (gateway reference,
credit or debit, payment type) are unknown and the receipt uses the row `id` as the Transaction ID.
Rows carry `shipment_id`, not the tracking code, so a receipt can't link to its delivery yet.

### 3.7 App download nudge — no API

`/download` already exists on the marketing site. This is a dismissible banner or interstitial
inside the app shell. Small; drop in whenever. Dismissal state is a per-viewer convenience —
`localStorage` is fine.

### 3.8 Saved cards — deferred

See 2.4. Nothing to build against yet. Checkout picks a `payment_medium` each time.

### 3.9 Storefront — deferred (but partly built)

Out of scope for now per 2.5. Notes below are kept so we don't re-derive them later.

A "property" in this API **is** a storefront: a customer-owned business with its own key and
its own shipment/payment flow.

| Need                  | Endpoint                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| List / create store   | `GET /v1/user/properties` · `POST /v1/user/property`                                    |
| Update / delete       | `PATCH, DELETE /v1/user/property/{property_id}`                                         |
| API key               | `GET /v1/user/generate-property-key/{property_id}` · `/view-property-key/{property_id}` |
| Store shipments       | `GET /v1/customer-property/shipments`                                                   |
| Order under a store   | `POST /v1/customer-property/order-shipment/{rate_id}`                                   |
| Store payment request | `GET /v1/customer-property/shipment-payment-request/{medium}/{orderId}`                 |
| Courier catalog       | `GET /v1/user/couriers` · `GET /v1/user/property/preferred-couriers`                    |

```
CreateCustomerPropertyDto { name*, email*, phone*, description, website, location: CreateLocationDto }
```

Enough exists to build against. What's undefined is the **customer-facing endpoint** the
original list refers to — i.e. the public page a store's own customers land on. Needs scoping
with Joseph.

**Courier picker, query params answered 2026-09-30.** Both courier endpoints take `country_id`
(required) and `verified` (optional, true/false), no page/limit documented. The picker
(`StorefrontService.preferredCouriers`) was missing the required `country_id` entirely, likely
always empty or erroring in production; fixed the same day by resolving Nigeria's id from
`GET /v1/locality/countries` through a new shared `LocalityService` (`@core/services`).

**Answered 2026-10-02:** BE named `GET /v1/user/couriers` the source of truth, with a Swagger
example schema: `data[]` of `id`, `company_name`, `status`, `logo`, `delivery_count`,
`average_delivery_rating`, `rating_count`, plus `total_count`, `current_count`, `limit`, `page`,
`total_pages`, `has_next_page`, `has_prev_page`. The picker now calls it and shows name, logo and
rating (a 0 rating is hidden). Price and delivery window aren't courier fields, they belong to a
rate, so they no longer show here. Still open: what `/user/property/preferred-couriers` is for, and
whether the picker should filter to `verified: true` only.

---

## 4. Phasing

Ordered so each phase de-risks the next.

**Phase 0 — plumbing.** No screens ship.
Token storage, HTTP interceptor (attach token, silent refresh on 401), auth guard,
`/app` route section with client render mode, app shell (bottom nav mobile / sidebar desktop),
marketing nav logged-in state.
⚠️ _Blocked on 2.6 (registration bug) and 2.7 (auth response shape)._

**Phase 1 — Authentication (3.1).** Signup, login, email verify, forgot password, Google.
Email-only — no Apple, no phone screens.

**Phase 2 — Deliveries list + detail (3.4).** Read-only. Cheapest way to prove auth and data
plumbing work end to end before building the hard write path.

**Phase 3 — Send delivery (3.5).** The big one. Multi-step form, image upload, locality search,
courier selection, payment handoff. Needs the 3.5 open questions answered.

**Phase 4 — Profile (3.2) + Transactions (3.6).**

**Anytime — App download nudge (3.7).**

**Out of scope this round:** Saved cards (3.8), Storefront (3.9), Apple sign-in (2.1),
phone verification (2.2).

---

## 5. Structure

Follows the existing convention — feature-first, `@core` / `@shared` / `@features` aliases
across buckets, relative imports within a feature.

```
src/app/
  core/
    auth/            token storage, interceptor, guard, auth service
    services/        logistics-api.config.ts (already exists — reuse)
  features/
    auth/            login, signup, verify, forgot password (email-only)
    app-shell/       authenticated layout, nav
    deliveries/      list + detail
    send-delivery/   multi-step form
    profile/
    transactions/
```

Marketing features stay exactly where they are. `storefront/` and saved cards get folders when
they come back into scope.

---

## 6. Open questions

Grouped by who can answer.

**Backend (Joseph)**

1. ⚠️ **Blocking Phase 0.** Login response body — tokens as JSON or httpOnly cookie?
   Token lifetimes? Refresh contract? (2.7) **Resolved in practice (2026-10-09):** login and refresh have
   worked on dev since the browser tests of 2026-10-06; not asked of BE, so lifetimes are undocumented.
2. ⚠️ **Blocking registration entirely.** Fix the `currency.connect` crash — skip it when
   `currency_id` is absent, or make the field required and validated. (2.6) **Resolved in practice
   (2026-10-09):** a real test account was registered on 2026-09-28.
3. ~~Allowed values for `pickup_type`, `source`, `mode` on `CreateCustomerShipmentDto`~~
   Answered 2026-09-28. **Closed 2026-10-06:** BE ignores `source` and stores every order as `Mobile`. (3.5)
4. Does the rates response include courier identity, logo, rating and review count? Courier
   identity and logo answered 2026-09-28 (`hub.courier_business`); rating/review count are not
   returned at all. (3.3)
5. ~~Does `GET /v1/user/transactions` paginate, and what are its fields?~~ Answered 2026-09-28.
   **Closed 2026-10-07:** rows carry `tracking_id` and `transaction.transaction_id`. (3.6)
6. ~~Is `sender_details` optional?~~ Yes. Answered 2026-09-28: BE uses the profile's saved
   address when it's omitted. (3.5)
7. Does the authenticated shipment detail have the same timeline quirks as the public one? (3.4)
   **Moot (2026-10-09):** customers get 403 on the authenticated detail (see 17); the app builds its timeline from the list row's `tracking[]`.
8. Is there a saved-addresses concept distinct from properties/storefronts? (3.2) **2026-10-03:** not built; on Joseph's missing-endpoints list.
9. ~~Does the plain `customer-shipment/pending-payment-request` return the same shape as the
   storefront variant, and does the order response return an `order_id` or a `tracking_id`?~~
   Answered 2026-09-28: the order response IS the payment init data, no separate id at all. Still
   open: a saved response for the plain (non-storefront) payment path, and the real Paystack
   return URL (currently hardcoded to localhost). (2.8)
10. ~~Does `shipment_id` on `PATCH /v1/user/shipment/{shipment_id}` mean the tracking id, up to
    which status can a customer cancel, and does cancelling refund to the wallet?~~ Answered
    2026-09-28: it's the shipment UUID (not the tracking id), pending only, no refund. (2.9)
11. ⚠️ **Blocking all order creation.** Fix `Argument record_id is missing` on the order
    endpoint's audit-log write. (2.10) **Fixed:** orders have succeeded on dev since 2026-10-06.
12. ⚠️ **Security.** Find and fix why that same error response contains unrelated phone
    numbers and emails. (2.10) **Fixed:** the leak stopped reproducing on 2026-10-03.
13. Does `recipient_username` on an order need a recipient-facing notification or approval step
    before it silently overwrites the typed receiver details with the saved ones? (3.5)
14. ⚠️ **Customers cannot download an invoice.** Both invoice endpoints answer 403 for a customer
    token. Open one to customers, or add a customer path. (3.4) **2026-10-09:** BE is opening one to the owner only; waiting to hear which and when.
15. Should a customer be able to download a shipping label? `download-shipping-label` answers 403.
    Open it, or confirm it is courier-only. (3.4) **2026-10-09:** BE is checking with the team.
16. `GET /shipment-extras/delivery-proof/{tracking_id}` is in the spec but not deployed (404 "Cannot
    GET" on staging). When does it ship, and may a customer read it? (3.4) **Answered 2026-10-09:** no GET endpoint exists and `delivery_proof`
    isn't in the shipment includes, so the 404 is expected. Unbuilt; ship date and who may read it are team decisions.
17. Low priority: `GET /shipment-tracking` answers 403 for a customer. The app works around it with
    the list row's `tracking[]`; say if that is the intended contract. (3.4) **Answered 2026-10-09:** courier-only by
    design; customers use the public `track-shipment/:tracking_id` route or the `tracking` array in shipment detail (what the app does).
18. Rating a delivery (`POST/PATCH /shipment-rating/{tracking_id}`, built 2026-10-07 but never sent
    to a live server): what is the required `id` in the body (we send the shipment UUID)? May
    `comment` be an empty string? What does `anonymous` change (we always send `false`)? From which
    shipment status is rating allowed (we show it at `received`/`completed` only)? (3.4) **Partly answered 2026-10-09:** `comment` may be
    empty; `anonymous` is stored only and changes nothing; there are no tags and no status gate. **Fixed and merged
    2026-10-09:** tracking code in the path, no `id` in the body; the app is updated but untested against dev (needs a `received` parcel).
19. The old send flow had a "Delivery instruction (optional)" box that was never sent: the order DTO has
    no field for it. The 2026-10-07 rebuild removed it. Can BE add a receiver note (or should it ride in
    `parcel.long_description`)? (3.5) **2026-10-09:** BE is confirming with the team; if added, it arrives as a receiver note on the order request.
20. Status meaning for the first step (2026-10-07): the app now reads `pending` as "Confirming" (waiting
    for a courier to accept) and `assigned` as "Confirmed" (accepted). Confirm that reading, whether a
    courier can decline or time out and what happens then, and which status writes the first
    `tracking[]` event (and an accepted-at time). (3.4) **Answered 2026-10-09:** `pending` means no dispatcher
    assigned, `assigned` means one was. There is no courier accept/decline step, no accept timeout, no accepted-at field, and
    assignment writes no tracking event. So the "waiting for a courier to accept" reading above is wrong. Still to
    decide on BE's side: a tracking event at assignment and an `assigned_at` field.
21. Cancel (`PATCH /user/shipment/{id}`) applies the change but answers 400; the order stays `pending`. (2.9)
22. Pay again (`pending-payment-request`) still returns a Paystack URL for a cancelled shipment's order. (2.9)
23. No refund exists for a paid, cancelled shipment, and the cancel dialog promises one (held). Which statuses
    allow cancelling, and what happens after pickup? (2.9)
24. An order with no photos is still accepted (201). Photos are required in the app only.
25. Seed rate durations (24/48, priority 12/24) are read as days, so the expected date is about 74 days out.
26. The box size the customer chose isn't on the shipment row; only the category's default size.
27. Emails: the invoice email fails on dev (swallowed 422 `invalid_attachment`). Who receives which email?
28. Is the Paystack webhook (`/v1/webhook/paystack`) set up on dev with signature checking? Orders only become
    paid through verify today.
29. Addresses are geocoded from the typed text alone, ignoring the chosen state and city.
30. With a matching sender phone, are `sender_name` and `sender_email` replaced by the account's own? Intended?
31. Only Abuja/Durumi has a rate; which other cities will be set up?
32. The `paymentHandler` null-courier TypeError: fixed yet?
33. Is the location filter on `GET /customer-shipment/shipments` case-sensitive? (date inclusivity is fixed)
34. KYC upload: the `account_type` values and the file rules (types, size).
35. Parcel photo upload (`/upload/multiple-images/shipments`): max file size and allowed types? The app resizes
    to 1600px JPEG and refuses over 10 MB (our estimate).
36. OpenAPI: add the `verify-paystack` success and abandoned responses, plus real sample rows for the shipments
    list, transactions and the order success.

**Product / design (Bami)**

1. Desktop layouts: mobile designs are reference only. Decide sidebar vs. top-tab shell before
   Phase 0 lands.
2. ~~Payment: is Paystack inline (in-page modal) or a redirect?~~ Answered by 2.8: redirect
   (`authorization_url`). Still blocked on backend confirming the plain order path.
3. The QR-scan-with-app sign-in idea (2.1) — worth designing now, or after this round ships?

---

## 7. Screens & journeys

### 7.1 Route map

**Auth — no app shell.** Own minimal chrome: logo, progress bar, back arrow.

| Route              | Screen                        | Notes                                            |
| ------------------ | ----------------------------- | ------------------------------------------------ |
| `/get-started`     | Choose how to continue        | Google + email. Apple cut (2.1)                  |
| `/signup`          | Name, email, password         | Inline availability check via `email-available`  |
| `/signup/verify`   | Check your email / enter code | Email OTP. Phone screens cut (2.2)               |
| `/login`           | Email + password              | Field says "Email Address", not "or phone" (2.3) |
| `/forgot-password` | Request reset link            |                                                  |
| `/reset-password`  | Set new password              | Token from email link                            |
| `/email-verified`  | Confirmation                  | **Already built** — reuse as-is                  |

**App — inside the shell.** All auth-gated, all client-rendered.

| Route                         | Screen                      | Primary endpoint                    |
| ----------------------------- | --------------------------- | ----------------------------------- |
| `/app`                        | Home                        | `customer-shipment/shipments`       |
| `/app/deliveries`             | My Parcels — list + filters | `customer-shipment/shipments`       |
| `/app/deliveries/:trackingId` | Delivery detail + timeline  | `shipment/{trackingId}`             |
| `/app/send`                   | Create a delivery — 4 steps | `customer-shipment/order/{rate_id}` |
| `/app/send/:orderId/success`  | Order confirmed             |                                     |
| `/app/transactions`           | Transaction history         | `user/transactions`                 |
| `/app/profile`                | Profile overview            | `user/me`                           |
| `/app/profile/edit`           | Edit details + avatar       | `user/me`, `upload/avatar`          |
| `/app/profile/security`       | Change password             | `user/update-password`              |
| `/app/profile/documents`      | KYC upload                  | `verification-document/*`           |

**Marketing routes that touch the app:** `/track` (public, exists), `/download`, and the
nav's logged-in state.

### 7.2 Shell

From the designs: **Home · My Parcels · Profile**.

- **Mobile** — bottom tab bar, three tabs. Floating "Create Delivery" enters `/app/send`.
- **Desktop** — left sidebar, same three destinations plus Transactions, which is buried under
  Profile on mobile for lack of tab room.
- `/app/send` and `/app/deliveries/:id` are **pushed screens**, not tabs — back arrow, no tab bar
  on mobile. They're tasks, not destinations.

_Senior-engineer framing:_ the distinction is **destinations vs. tasks**. Destinations live in
persistent nav and you can always get back to them; tasks are pushed onto a stack, have a clear
exit, and shouldn't be interruptible by a tab switch mid-flow.

### 7.3 Home composition

Top to bottom, per the design:

1. Greeting + avatar + location, notification bell
2. Search parcels
3. "Send a package" CTA card → `/app/send`
4. **Ongoing Delivery** — horizontally paged cards with a step-progress bar, tracking ID,
   status pill, ETA, drop-off. Tap → detail
5. **Recent Deliveries** — compact rows, status pill, "See All" → `/app/deliveries`
6. App-download nudge (3.7), dismissible

Home is a read-only summary. Every element is an entry point into a task.

### 7.4 Send a delivery — flow shape

Designs show an **accordion on one screen**: sections collapse as they complete, next opens.
Four steps, then a review.

1. **Package Info** — images (optional), size, category, description
2. **Pick Up Details** — prefilled from profile, with a _"This order is not from Me"_ escape hatch
3. **Drop Off Details** — receiver name, address, city, state, phone, instructions
4. **Select Courier** — search + list with logo, rating, delivery window, price
5. **Review Summary** → payment → success

**Recommendation: one route, internal step state, not a route per step.** The accordion needs
all sections co-present, and the completed-step summaries are part of the design. But persist a
**draft to `localStorage`** on every step change — this is a long form on mobile and losing it to
a refresh or a backgrounded tab is the worst thing that can happen here.

Rates fire between step 3 and 4: `get-shipment-rates` needs `shipment_size_id` (step 1) plus both
localities (steps 2–3). Courier list can't populate until drop-off is complete — the design's
disabled "Review Summary" button already reflects this.

### 7.5 Journeys

**A. New user sends their first parcel** — the critical path.

```
Landing → Get started → Sign up → Verify email → App home (empty state)
       → Create Delivery → Package → Pickup → Dropoff → Courier
       → Review → Pay → Success → Delivery detail
```

The empty-state home is doing real work here. It's the first thing a new account sees and its
only job is to get them into `/app/send`.

**B. Returning user checks a parcel**

```
Login → Home → Ongoing delivery card → Detail → Timeline
```

Two taps from launch to timeline. Worth protecting as a design constraint.

**C. Anonymous tracking → account** (already half-built)

```
/track → result → "Track all your parcels in one place" → Sign up
```

**D. Anonymous price check → account**

```
Public rate estimator → price → "Book this delivery" → Sign up → /app/send prefilled
```

`get-shipment-rates` is public and needs no auth, so the whole estimate happens before signup.
This is the strongest funnel we have — someone who's seen a real price is a warm lead. Carrying
their inputs through signup into a prefilled `/app/send` is worth the extra plumbing.

### 7.6 States to design

Easy to forget, and each one is a real screen:

- **Lists** — loading skeleton · empty · error + retry · populated · end-of-list
- **First-run** — home with zero deliveries, profile with no avatar or documents
- **Send flow** — validation per step, no couriers on the route, payment failed, payment pending
- **Detail** — each status (pending, accepted, picked up, in transit, delivered, cancelled),
  plus proof-of-delivery present vs. absent
- **Session** — token expired mid-action, offline

Note from the `/track` work: the public timeline returns entries **non-contiguously**, and
`delivered` there means _out for delivery_, not handed over. Open question 6 asks whether the
authenticated endpoint shares those quirks — it changes how the timeline component is built.

---

## 8. Changelog

- **2026-08-03** — First version. API mapped against live spec; four backend gaps identified;
  storefront found to be partly built (initially assumed missing); `/app` path chosen over subdomain.
- **2026-08-03** — Scope cut rather than blocking on BE: Apple sign-in, phone/OTP verification
  and phone login dropped; saved cards and storefront deferred. Auth is email + password +
  Google only. Two blockers remain — the registration currency bug (2.6) and the login
  response shape (2.7).
- **2026-08-03** — Added section 7: route map, shell structure, home composition, send-delivery
  flow shape, four user journeys, and the state inventory.
- **2026-08-03** — Phases 0–4 built. All 17 screens, auth plumbing, app shell, marketing nav
  logged-in state. Two things need a decision, both flagged in section 9.
- **2026-08-29** — Live-tested signup against staging. Confirmed a real backend bug (2.6):
  registration throws on every account because `currency.connect` runs with an undefined id
  when `currency_id` is omitted, which it always is. Blocking, not a frontend fix. Also added
  live password-requirement checklist, phone in E.164 with country-code picker, and
  blur-triggered confirm-password matching to the signup screen.
- **2026-09-25** — Cross-checked outstanding backend questions against the live OpenAPI spec and
  the `Fardelins/delivery-bruno-api` repo. Found the KYC document list (3.2) was our own bug, not
  a backend one: `verification-document/customer-documents` serves the ID-type catalog by design,
  the bare `verification-document` endpoint has always been the right one for the signed-in
  user's submissions — fixed client-side. Confirmed the customer cancel endpoint and status enum
  (2.9) and the Paystack payment response shape (2.8), both still short one confirmation each
  before they can be built. Also found the backend's own Bruno collection disagrees with the live
  spec in two places: storefront paths (`/customer/*` vs the deployed `/user/*`) and a
  `shipment/recipients/search` endpoint on two active feature branches that isn't deployed yet.
- **2026-09-28** — Backend sent a status list marking four items ready. Checked each against the
  live spec and Bruno. Live now: `GET /v1/shipment/recipients/search?username=` (letters and
  digits only, 2 to 25 chars), `GET /v1/user/transactions`, and parcel search filters on
  `GET /v1/customer-shipment/shipments` (`location[country|state|city]`, `min_price`,
  `max_price`, `date_from`, `date_to`). Rates and payment show no spec change. None of them has a
  documented response, so only the transactions endpoint switch and a courier-name and logo fix
  in the rate parser were made; recipient search and the filters need a saved response and a
  UI decision first. Also corrected 3.5: `sender_details` is optional in the spec, which we had
  wrong, but the app still sends it because it carries the pickup address, and now sends all six
  fields it requires. Phone OTP, public courier details, parcel location tracking and dispatcher
  location are deferred by the backend.
- **2026-09-28 (later)** — Backend answered on recipient search and transactions. Recipient search
  returns `data: { id, username, first_name, last_name, avatar, location }`, or `data: null` for no
  match, and deliberately no phone or address, so a lookup can confirm who someone is but cannot
  prefill an address. Transactions mapping and paging updated (3.6); this also fixed every payment
  row being shown as a credit.
- **2026-09-28 (evening)** — Backend confirmed the parcel filters work, price is in NGN, and the
  shipments response carries paging fields. The Parcels page got a Filters panel (date range,
  amount, state and city, applied on the server). Because the shipments list had been fetched with
  no `page` or `limit`, the app now requests 20 per page and follows the paging fields, up to 500
  parcels, instead of trusting the default first page. Still open: whether the date range includes
  both end days, and whether location names are case-sensitive.
- **2026-09-28 (night)** — Backend confirmed the recipient-lookup security question is real:
  `location` in the search response is a boolean only, but when `recipient_username` is sent on an
  order, the backend resolves the recipient's saved name, phone and address server-side, and
  `receiver_fullname`/`receiver_phone`/`receiver_location` become optional. Registered a real
  test account with a saved address to verify this end to end and hit a blocker first: every order
  attempt failed with `Argument record_id is missing` from an internal audit-log write, and that
  same error response leaked 12+ unrelated phone numbers and emails (2.10). Both reported as
  blocking; the recipient-lookup design stays unbuilt until they're fixed and the original
  questions can actually be tested.
- **2026-09-28 (later still)** — Backend answered the recipient-lookup security questions and the
  order-payload enums in full, without needing the record_id bug fixed first. Confirmed and worst
  case first: `recipient_username` takes precedence over anything typed, silently overwriting the
  receiver's name/phone/address with the saved ones, with no recipient opt-out or approval, only
  an after-the-fact email. The recipient-lookup UI stays unbuilt on that basis, a product call, not
  a bug. Everything else was safe to ship: `pickup_type: user`, `mode: live`, `source: Manual`
  (unconfirmed guess), a required Package Type field, the real rates courier path
  (`hub.courier_business`), a 4-image cap, and the order response's real shape confirmed to be
  Paystack's payment init data directly, no separate id. The app now redirects straight to
  `authorization_url` after a successful order; there is no page for the customer to land on
  after paying yet, since BE's return URL is still hardcoded to localhost.
- **2026-09-30** — Backend sent query params for two courier endpoints (3.9). Fixed a real bug
  this surfaced: the storefront courier picker was calling `/user/property/preferred-couriers`
  without the `country_id` it requires, likely always coming back empty. Added a shared
  `LocalityService` (`@core/services/locality.service.ts`) to resolve Nigeria's country id once,
  used here and available for anything else that needs it, rather than duplicating the lookup
  `send-delivery.service.ts` already had. Left open which of the two courier endpoints the
  picker should actually call, see 3.9.
- **2026-10-01** — Checked Bruno and the live spec for anything new. Found a `feat/preferred-couriers-response`
  branch in Bruno with real request examples for the courier endpoints (no saved responses, but
  confirms the params and, by only testing `/user/property/preferred-couriers`, leans toward that
  being the right one for the picker, not `/user/couriers`). Also confirms the `preferred_courier_ids`
  PATCH shape matches what we already send. Bigger find: the live spec has `GET
/v1/payment/verify-paystack?reference=`, path-matching the hardcoded Paystack return URL (2.8),
  which likely unblocks the payment-return page once we have a real domain for it. Nothing else
  moved: transactions, rates, KYC, and cancel schemas are all unchanged since 2026-09-28. Built
  the return page the same day (2.8).
- **2026-10-02** — BE named `GET /v1/user/couriers` the source of truth for the storefront courier
  picker and shared its response schema (3.9). The picker switched to it and now reads
  `average_delivery_rating` and `rating_count`.
- **2026-10-03** — BE said order/payment fixes are merged and live on dev. Retest on staging: the
  PII leak no longer reproduces (errors are generic, no names/emails/phones). But no order can
  complete: `POST /public/get-shipment-rates` returns 400 whenever a city is sent, and
  `POST /customer-shipment/order/{rateId}` returns a generic 400 for both username and typed-details
  bodies. Confirmed by BE from Railway logs: Prisma P2022, `Shipment_Rate.min_weight` doesn't exist
  in the dev database. The pricing migrations (feat/pricing: 4263a62, 6100492, 87d710b) aren't in
  `dev` yet, so rates and orders can't be retested until they're merged and applied.
- **2026-10-03 (BE answers)** — Not fixed yet: recipient safety (notification/opt-out/approval),
  `paymentHandler` null-courier TypeError, `source` value for web. Paystack callback stays on
  localhost until all gateways are implemented, then moves to the real app URL. `GET
  /user/property/preferred-couriers` returns the courier a user selected; `GET /user/couriers`
  lists all (the picker already uses the latter). Transactions `tracking_id`/`transaction` and the
  cancel shipment UUID are covered by the current BE PR; verify on retest. Missing endpoints (saved
  addresses, notifications, QR sign-in, app-download SMS) are Joseph's. We asked for schema examples
  on working endpoints, starting with shipments, shipment detail, transactions, rates and the order
  response. Unanswered: filter date inclusivity and location case sensitivity, KYC `account_type`
  and file rules. No code change needed.
- **2026-10-05** — BE tested the order on local: success returns `{message, code: 200, data:
  {authorization_url, access_code, reference}}`, which matches what the app reads (2.8). Their test
  body also carried `shipment_size_id`, `delivery_type: "user"` and `priority: false` and omitted
  `payment_medium`/`source`/parcel `type`, `weight`, `quantity`; we send the opposite set, so the
  accepted body needs confirming. `GET /payment/verify-paystack` needs no auth and answers an
  unverified reference with HTTP 400 `{statusCode: 400, message: "Payment verification failed"}`.
  The payment return page now maps that 400 to the failed state instead of the "couldn't check"
  state, and the failed copy no longer promises the customer wasn't charged (the 400 can't tell
  abandoned from unconfirmed). Dev rates still 400 (migration pending).
- **2026-10-05 (rates shape)** — BE shared the new `POST /public/get-shipment-rates` response: `rate_id`,
  `hub.courier_business`, `durations.{standard,priority}.{pickup,delivery}_duration` (look like
  hours), `extras.priority.cost`, and `sizes[]` each with `available`, `pickup_options`,
  `delivery_options` (`office`/`user` with cost), `starting_price` and `totals.{standard,priority}`.
  No flat `price` any more. The app now reads the chosen size's `totals.standard`, hides a rate whose
  size is unavailable, shows `durations.standard.delivery_duration` as hours/days, and sends
  `shipment_size_id` on the order. Not built: priority delivery (+extras.priority.cost) and
  office-vs-door delivery choice (`delivery_type`), pending product decision and BE answers. Dev
  still 400 on BE's own Abuja/Durumi example after BE said the migrations were done.
- **2026-10-06** — Dev fixed (`Shipment_Rate.min_weight` now exists). Retest on staging: rates for
  Abuja/Durumi return 201 with one rate (id 8, Fardelins, size 2 = 2100, durations 24/48); Lagos/Ikeja
  and state-only return 201 with an empty list (no rates configured there; a city is required).
  Place names are case-insensitive. Orders succeed with the app's body plus `shipment_size_id`, with
  BE's local-style body (`delivery_type`, `priority`, no `payment_medium`/`source`/parcel `type`),
  and with `recipient_username` only: all 201 `{authorization_url, access_code, reference}`, no
  personal data in responses. So `delivery_type`/`priority` are optional and the old fields are
  still accepted. Three unpaid demo-mode orders were created on the probe account. Still open:
  hours vs days, what `totals.standard` assumes, success verify response.
- **2026-10-06 (BE samples)** — Real `GET /customer-shipment/shipments` row: `id` (shipment UUID, so
  cancel can use it), `tracking_id`, `parcels[]` (with `media`), `order {amount, status}`,
  `hub.courier_business {company_name, currency, owner}`, `sender_location`/`receiver_location`,
  `tracking[]`, `total_weight`, `expected_date_from/to`. The app now reads title/amount/currency
  from those. `GET /shipment/{id}` returns 403 for customers (courier-only), so the delivery detail
  page is built from the customer's own list row instead. `GET /user/transactions` rows now carry
  `transaction.transaction_id` (used as the reference), no `tracking_id`, and `type: "CREDIT"` on
  payments out. **Findings for BE:** `verify-paystack` returns 400 even for references its own data
  shows as paid, so a 400 is not treated as a failed payment (reverted the earlier mapping); a
  failed transaction's `message` holds a raw Prisma error with server file paths and query
  internals; the courier `owner` email/phone is exposed in customer payloads; a payment-handler bug
  (`email` is not a `Courier_Business` field) marked a payment failed.
- **2026-10-06 (payment fallback)** — When `verify-paystack` errors, the payment return page now looks
  the reference up in the customer's own `/user/transactions` (matched on
  `transaction.transaction_id`) and shows that row's paid/failed/pending state. If the reference isn't
  there either (or the lookup fails), it still shows "We couldn't check this payment".
- **2026-10-06 (first real browser test on dev)** — Paid a Paystack test order end to end. Findings:
  (1) local phone numbers (`0815…`) were rejected by BE, so the app now converts to `+234…`;
  (2) BE rejects an image carrying both `id` and `link`, so the order sends only `id`;
  (3) Paystack redirected to BE's configured `https://localhost:3000/payment/verify-paystack`
  (known, parked until real URLs); (4) `verify-paystack` returned 400 for a fresh successful
  payment, and the transactions fallback showed "Payment received" correctly; (5) the card showed
  ₦2,100 but the order charged ₦2,600, because BE defaults to door delivery and `totals.standard`
  assumes office delivery: the card now shows pickup + door delivery (₦2,600) and the order sends
  `delivery_type: "user"`; (6) the receipt showed a clock for a paid payment (payment statuses were
  read as parcel statuses), now fixed; (7) **BE bug:** the customer's parcel list is matched on the
  sender's phone number, not the logged-in user. An order whose sender phone differs from the
  account's phone never appears in My parcels (reproduced on dev with the probe account: same
  email/different name still shows, different phone doesn't). The shipment rows carry `user_id`,
  so BE should filter on that. About ten unpaid test orders (mode live and demo) were created on the
  probe account while reproducing it.
- **2026-10-06 (second browser test)** — Parcel list worked once the sender phone matched the account.
  Card showed ₦2,600 and the order charged ₦2,600. Findings: (1) the recipient step allowed
  continuing without a city and without an email (BE requires the email); both are now required;
  (2) parcel images didn't show because the media items use `link` (the app read `url`); fixed;
  (3) the list's `tracking_id` filter expects a shipment UUID, so the detail page now scans the list
  directly instead of sending a filter that returned 400; (4) the detail map put an Abuja drop-off in
  Lagos by geocoding the address text, so it now uses BE's own latitude/longitude, and the distance
  shows the route length instead of "Calculating" forever; (5) **BE:** no emails arrived. The
  sender should get the invoice and the Paystack email, and the recipient the receipt/order details
  and later shipment updates; the payment page keeps promising "we've emailed you the details";
  (6) **BE:** sender name and email on the shipment came back as the account's own, not the ones typed,
  when the phone matched the account; the list matches on sender phone, so a different account can
  inject a parcel into someone's list by using their phone as `sender_phone`; (7) **BE:** the
  coordinates came from the typed address text alone, ignoring the chosen state/city: an address
  typed as "14 Admiralty Way, Lekki Phase 1" with Abuja/Durumi selected was stored with Lekki
  (Lagos) coordinates and city "durumi". The test was deliberately inconsistent, but a short real
  address ("5 Test Avenue") would resolve to a random place; BE should geocode with address +
  city + state + country, or reject an address outside the chosen city. BE is working on items 1 to 6
  of the 2026-10-06 list (verify-paystack, raw error message, owner contact exposure, customer
  shipment detail, transactions fields, expected dates).
- **2026-10-06 (BE answers to the long list)** — Confirmed: the charge is `order.amount` (₦2,600)
  and the 130 admin fee is BE's 5% commission inside it, not on top; transaction `type: CREDIT` is
  a schema default seen from the courier wallet's side, so never show it as money in; durations
  are hours; omitted `delivery_type`/`pickup_type` default to `user`; options are chosen by
  `pickup_type`/`delivery_type` (`office` or `user`), `priority: true` adds the priority cost
  (3000 on rate 8) and switches to priority durations; `mode` only labels the order and adds
  `[TEST]` to the email subject (one Paystack key, so it doesn't switch keys); `source` is
  ignored and every order is stored as `Mobile`; weight is optional (defaults to the size's
  average) and never affects price; `payment_medium` is effectively ignored (any value runs
  Paystack). The 74-day `expected_date_to` was a bug (hours treated as days), fixed in the PR.
  **Correction to my own earlier note:** the parcel list is filtered on `user_id`, so a foreign
  phone cannot inject a parcel into someone else's list (my injection claim was an inference, not
  a test, and was wrong); the real bug is an extra sender-phone OR that hides your own orders when
  neither phone matches the account, to be removed in the PR. **Serious, BE side:**
  `verify-paystack` marks the order paid on its first call whether or not Paystack saw a payment,
  and repeat calls return a generic 400 (so the 400 the app saw was the repeat-call case). The
  endpoint is public. Emails: the only email in the code is the invoice, sent after verify succeeds
  to the stored sender and receiver addresses in one message, and it fails on dev with a swallowed
  422 `invalid_attachment`; Paystack's own receipt and recipient/tracking emails aren't sent by
  BE's code. Recipient safety is still open: an `@username` order takes the receiver details from
  the recipient's account with no notification, opt-out or approval. Resume payment works for
  unpaid/failed orders but doesn't update `transaction_id` on retry. Callback URL is hardcoded to
  `https://localhost:3000/...`. Not fixed yet: the null-courier TypeError. The date filter
  `date_to` is exclusive (BE bug). Coming from BE: generic error message, owner contact stripped,
  `tracking_id` on transactions, the `tracking_id` filter fix. The detail page now looks a
  shipment up with `search=FDL-…` and falls back to scanning the list.
- **2026-10-06 (delivery options step)** — Rate durations are days, not hours (Joseph overrode the
  hours change; the seed values 24/48 will show as days until BE fixes them). Added a "Delivery"
  step before the courier step: door delivery (`user`) or courier office (`office`), and standard or
  priority. The rate cards price the chosen options (door pickup + delivery option, plus the
  priority extra), hide couriers that don't offer them, show the priority delivery time, and the
  order sends `delivery_type` and `priority`. Dev builds send `mode: "demo"` (BE uses it only as a
  `[TEST]` email label), production builds send `live`. Verified in a browser with a mock session
  on desktop and mobile; the real prices are covered by unit tests, not yet run against dev.
- **2026-10-06 (third browser test)** — Priority prices matched Paystack (office+priority ₦5,100,
  door+priority ₦5,600, door ₦2,600). Findings: (1) **BE:** an order paid on Paystack stayed
  "pending" because the customer went back to the dashboard instead of the return page. The order is
  only marked paid when `verify-paystack` is called, so the Paystack webhook is not updating orders
  on dev; the return page is load-bearing and a closed tab never gets marked paid; (2) abandoned
  unpaid orders showed as ordinary "Pending" parcels and counted under Shipping: a shipment with an
  unpaid order now reads "Awaiting payment" and is not counted as shipping; (3) the receipt said
  "Amount Paid" on a pending payment, now "Amount Due" (or "Payment Failed"); (4) the parcel page
  now shows all photos, the description, package facts (category, type, quantity, dimensions, declared
  value), sender/recipient phone and email, delivery type and the courier's contact (never the
  owner's). BE's row doesn't include the size the customer chose, only the category's default size,
  so the size name is not shown.
- **2026-10-06 (cancel and pay again)** — Built on the parcel page, only for a shipment that is
  "Awaiting payment": a "Complete payment" button (GET
  `/customer-shipment/pending-payment-request/paystack/{order_id}`, then a full navigation to the
  returned Paystack URL) and a "Cancel shipment" button with an inline confirm (PATCH
  `/user/shipment/{shipment_id}` with `{status: "canceled"}`, using the row's UUID `id`). Cancelling a
  paid shipment is not offered: BE has no refund behaviour. Tested on dev with my own unpaid
  shipments: the UUID works (the FDL- code returns 404). **BE bugs:** (1) the cancel applies the change
  but answers 400 "Something went wrong while processing your request" (a second cancel answers 409
  "status already updated"), so the app checks the list before reporting failure; (2) a cancelled
  shipment's order stays `pending`, and pay-again on it still returns a Paystack URL; (3) pay-again
  creates a new Paystack reference each call but the transaction row keeps the old `transaction_id`,
  so a payment made that way can't be matched or verified on return (BE already knows).
- **2026-10-07 (BE PR 205)** — The PR is in BE's private backend repo, which the shared GitHub login
  can't read, so the diff wasn't reviewed. Retest on dev: nothing from it is deployed yet (every
  issue below reproduced). Worth recording: `verify-paystack` on a fresh UNPAID order's reference
  answered 400 and the order was marked **paid** anyway (own probe order), so an order can be paid
  with no payment; a courier `owner` object is still in the customer's shipment rows; an order with a
  different sender phone still doesn't appear in the list; `date_from=date_to=today` still returns
  nothing; pay-again still doesn't save the new reference; cancel still answers 400 after applying and
  leaves the order pending; paying a cancelled shipment's order still returns a Paystack URL;
  transactions still have no `tracking_id`; rate seed durations are still 24/48 (days).
- **2026-10-07 (parcel page redesign)** — Page stays a two-column grid: the parcel card, status,
  timeline, package and delivery details on the left, the map (unchanged) on the right. The parcel
  card is now photos on the left (a square carousel with thumbnails and a lightbox, shared component
  `image-carousel`) and text on the right (title and weight, sender and recipient, addresses); on a
  phone the photos lead and the text follows. Status rules: **awaiting payment** has a grey pill, no
  status card, no timeline, no estimated delivery or courier contact; the header holds "Cancel
  shipment" and (desktop) "Complete payment", and phones get a "Payment needed" banner with only
  Complete payment while Cancel stays in the header. **Paid and waiting**: no timeline until
  tracking exists; Refresh stays. **Cancelled**: no Refresh, "Cancelled on <date>" replaces both
  "Last updated" and "Estimated delivery", no courier contact, and the stepper and timeline show
  only if tracking had started. Door delivery now reads "Your doorstep" (also in the wizard). Photos
  are now required in the send flow. Cancelling is offered while the shipment is pending, awaiting
  payment or assigned (not yet picked up), paid or not, through a dialog: paid shipments must tick a
  box acknowledging the refund within 1 to 2 business days. **BE does not refund yet**, so the
  refund copy must not ship before BE implements refunds on cancel.
  Follow-up the same day: the "1 / 3" counter was removed from the photo box (the thumbnails do
  that job; the lightbox keeps its counter); the photo column now grows to the height of the text
  beside it so the thumbnails end where the text ends, and stays square when stacked on a phone; the
  cancel dialog now names the parcel and tracking ID, says the paid amount will be refunded within 1
  to 2 business days with an "I agree to cancel this shipment and proceed with the refund" box, and
  for an unpaid shipment says nothing will be charged, with no box.
- **2026-10-07 (BE PR merged, retested on dev)** — **Fixed:** `verify-paystack` no longer marks an
  unpaid order paid (400 `{message: "Payment not completed", status: "abandoned"}`, order stays
  pending) and returns 200 `{data: {reference, status: "success", amount, order_id, tracking_id}}`
  for a paid reference; transactions rows carry `tracking_id` and no error `message`; the courier
  `owner` is gone from shipment rows; an order with a different sender phone now shows in the list;
  `date_from=date_to=today` includes today; the `tracking_id` filter accepts the FDL- code; pay-again
  saves the new reference on the transaction; a `/v1/webhook/paystack` endpoint exists. The return
  page now reads the "abandoned" 400 as a payment that wasn't completed. **Still open:** cancel
  still answers 400 after applying and leaves the order `pending`; paying a cancelled shipment's
  order still returns a Paystack URL; cancelling a paid shipment and the refund are untested (needs a
  genuinely paid order); an order with no images is still accepted; seed durations are still 24/48
  (expected delivery is still 74 days); the row still carries the category's size, not the chosen
  one; invoice and other emails, recipient safety, the null-courier error and the callback URL are
  not retestable from here.
- **2026-10-07 (phone required, track page)** — Phone number is now required to enter `/app` (see 2.2).
  The public `/track` page draws the first step as done once a parcel is assigned, like the parcel page.
  First-load size cut from 590 to 499 kB (a 2-icon import was pulling the whole icon set onto the home
  page); the flaky full-suite tests were fixed by capping test workers at 6.
- **2026-10-07 (send flow rebuilt)** — Five steps became three: Parcel, Route (sender and recipient on
  one screen joined by a route line), Courier (delivery options sit above the courier list and re-price
  it live; unique cheapest and fastest are tagged). A live summary sits beside the form on desktop and a
  sticky price bar on phones. Continue no longer disables: it marks what is missing. The payment
  dropdown is gone, since BE runs Paystack for every value; the button reads "Pay ₦X" and says payment
  finishes on Paystack. The unsent delivery-instruction box was removed (question 19). The payload,
  validation rules and saved-draft key are unchanged.
- **2026-10-07 (rating prompt, gold stars, stepper)** — A rating prompt opens once per sign-in session for
  the newest handed-over parcel that isn't rated; "Not now" retires that parcel's prompt for good and it
  stays rateable on its page. It never stacks with the app promo: if the promo has the screen it tries
  again next visit, and once it is up the promo waits. Stars use the new `--color-accent-gold`
  (`#b8860b`, not yet in Figma). Fixed: a completed parcel with no tracking events showed no step.
- **2026-10-07 (rating a delivery)** — Built a rating card on the parcel page for handed-over parcels:
  five stars, quick picks that switch between "What went well?" and "What could be better?", an
  optional note, a thank-you state with Edit. The DTO has no field for picks or tips, so picks are sent
  inside the one `comment` and there is no tip. Tested with mocked responses only; question 18.
- **2026-10-07 (toasts, invoice, signup phone)** — Built the toast system and wired it to storefront
  actions, every settings save, parcel refresh and cancel, receipt download and order failure; the
  courier service now throws on failure so the page can say so. Tested the invoice with a real
  customer token on staging: both invoice endpoints answer 403 for customers (3.4), so the Invoice link
  waits on BE (questions 14 to 17). Rating a delivery is open to customers and is next to build; it
  needs a delivered parcel to test, and the test account has none. Confirmed `/signup/phone` is the
  Google gap-fill step and found it is not enforced after sign-in (2.2). Fixed four full-suite test
  timeouts by raising the default to 15 seconds.
- **2026-10-09 (BE answers)** — Delivery proof is unbuilt on BE (no GET, not in the shipment includes), so the
  404 is expected. `/shipment-tracking` is courier-only by design; the app already uses the list row's `tracking[]`.
  Rating: `comment` may be empty, `anonymous` does nothing, no tags, no status gate. Status: `pending` = no
  dispatcher assigned, `assigned` = dispatcher assigned; there is no courier accept step, timeout or accepted-at
  field, and assignment writes no tracking event. The courier list has no default paid-only filter.
  `payment_medium` defaults to paystack, so the app can omit it. The stale "courier accepts" code comments
  were corrected; the "Confirming" label for `pending` is unchanged.
- **2026-10-09 (BE rating fix merged)** — Rating POST was broken for everyone (body stripped); fixed. The
  tracking code is the id in the path for POST, GET, PATCH and DELETE (the UUID now 404s). Body is
  `{score 1-5, comment?, anonymous?, images?}` with no `id`; `images` are upload ids (PATCH replaces the set).
  GET answers 404 when unrated and is readable only by the rater and that shipment's courier. No status gate
  and no tags field (picks stay inside `comment`). The app no longer sends `id` and no longer passes the
  shipment UUID to the rating card. `payment_medium` is no longer sent (BE defaults to paystack; the unused
  `PAYMENT_MEDIUMS` list was removed). Still on BE's side to decide: customer invoice (one endpoint will be
  opened to the owner), label, delivery proof GET, receiver note, assignment event and `assigned_at`. Unretested
  against dev: the rating POST/PATCH needs a handed-over parcel.
- **2026-10-09 (photo size, mock wording)** — Parcel photos are now resized in the browser before upload
  (`@shared/utils/compress-image.ts`: long edge 1600px, JPEG at 0.82; small images, gifs, svgs and anything the
  browser can't decode go up unchanged) and anything still over 10 MB is refused before the request. The 10 MB
  cap is our guess; BE's real limit is not known yet. Not yet tried with a real phone photo in a browser. The
  dev mock timeline now reads "Assigned" instead of "Order Accepted". The features-page screenshot still says
  "Order Accepted" because the text is part of the image; it needs a re-export from the design file.

---

## 9. Built — open items

Phases 0–4 are implemented and the build is clean. Two things need your call:

### 9.1 The nav's Log In / Sign Up now point at the customer app

They previously went to `courier.fardelins.com/auth/{login,register}` — the **courier** portal.
With a customer app on the same domain, a customer clicking "Sign Up" landing on courier
registration is incoherent, so they now go to `/login` and `/get-started`.

**This is a product change, not just a technical one.** If couriers are still meant to sign up
from the marketing nav, that link needs a home — footer, or a separate "For couriers" entry.

**Resolved:** couriers have a home. The site footer's call to action and the home "journey" section
link to `courier.fardelins.com/auth/register`, while the navbar's Log In and Sign Up go to the
customer app.

### 9.2 Order payload values — resolved

Superseded by the 2026-09-28 and 2026-10-06 answers in section 8 and by 3.5. The app now sends
`pickup_type`/`delivery_type` of `office` or `user`, `source: Manual` (BE ignores it and stores
`Mobile`), `mode: demo` on dev builds and `live` on production builds, and `priority` as chosen.

### 9.3 What was verified

- `ng build` clean; the 6 marketing routes still prerender, `/app/*` correctly excluded
- 64 tests pass, including 15 new ones covering the assumed auth contract and token storage
- Two pre-existing failures (`footer.spec`, `haptics.service.spec`) confirmed unrelated by
  re-running the suite with these changes stashed — identical failures either way
- Every new file passes `prettier --check`

**Latest run (2026-10-07):** the full suite passes with the toast tests included, and `ng build` is
clean apart from the initial-bundle size warning (about 93 kB over the 500 kB warning budget, not yet
investigated). Component stylesheet warnings were cleared by splitting `app-shell.css`,
`profile.css` and `storefront-settings.css` into a second file each, loaded right after the first so
the cascade is unchanged.

### 9.4 Response-shape tolerance

Every API response here is read through key-tolerant parsers rather than fixed interfaces,
because most response schemas aren't in the spec. `parseSession` accepts the token under any of
six common key names and returns `null` when no token is present — which is the signal that BE
is using httpOnly cookies instead. When the real shapes land, the parsers tighten to match.
