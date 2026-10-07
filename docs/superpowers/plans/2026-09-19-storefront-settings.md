# Storefront Settings Implementation Plan

> **Status:** Proposed
> **Date:** 2026-09-19
> **Scope:** Customer dashboard storefront setup and API access

## Outcome

Add a sixth **Storefront** tab to Settings where a customer can create and manage one or more storefronts, choose preferred couriers, and securely obtain the credentials used by their own server to create and manage storefront deliveries.

Settings owns configuration only. Storefront orders and shipment activity continue to appear in the existing parcel and delivery experiences, where operational work already belongs.

## Recommended Product Shape

Use a phased hybrid approach:

1. Ship storefront onboarding and credential management in Settings now.
2. Surface storefront-created shipments in the existing Parcels area with a storefront source label or filter.
3. Add a dedicated top-level Storefront workspace later only if merchants need order queues, analytics, webhooks, or multiple-store operations that no longer fit Parcels.

This avoids inventing another dashboard before the underlying workflow has enough operational depth.

## API Findings

### Deployed staging contract

The staging OpenAPI document currently exposes these authenticated management endpoints:

| Purpose | Method | Deployed path |
| --- | --- | --- |
| Create storefront | `POST` | `/v1/user/property` |
| List storefronts | `GET` | `/v1/user/properties` |
| Update storefront | `PATCH` | `/v1/user/property/{property_id}` |
| Delete storefront | `DELETE` | `/v1/user/property/{property_id}` |
| Reveal API key | `GET` | `/v1/user/view-property-key/{property_id}` |
| Generate or rotate API key | `GET` | `/v1/user/generate-property-key/{property_id}` |
| List preferred couriers | `GET` | `/v1/user/property/preferred-couriers` |

Storefront integrations use these routes after authentication with the property credentials:

| Purpose | Method | Path |
| --- | --- | --- |
| Test credentials | `GET` | `/v1/customer-property/test` |
| List storefront shipments | `GET` | `/v1/customer-property/shipments` |
| Order a shipment | `POST` | `/v1/customer-property/order-shipment/{rate_id}` |
| Request shipment payment | `GET` | `/v1/customer-property/shipment-payment-request/{medium}/{orderId}` |

The storefront client credentials are sent as:

```http
x-customer-prop-Id: <property id>
x-customer-prop-key: <property api key>
```

### Storefront input contract

`CreateCustomerPropertyDto` requires:

- `name`
- `email`
- `phone`

It optionally accepts:

- `description`
- `website`
- `location`
- `preferred_courier_ids`

`location` accepts an address plus optional city, state, country, coordinates, and postal code. The update DTO exposes the same fields as optional values.

### Contract mismatch that must be resolved first

The latest Bruno collection points storefront management requests at `/customer/*`, for example `/customer/properties`. Those paths currently return `404` on staging. The deployed `/user/*` equivalents return `401` without a bearer token, confirming that those are the live protected routes.

The frontend must use the deployed `/v1/user/*` contract until the backend team deliberately deploys and documents a replacement. Bruno should be corrected so it does not advertise routes that do not exist.

## Backend and Bruno Release Gate

Before the UI is released, align the API source of truth:

- Update Bruno management requests to `/user/property`, `/user/properties`, and the corresponding `/user/*` key routes, or deploy the proposed `/customer/*` aliases.
- Add response schemas and examples to OpenAPI for property CRUD, courier options, key reveal, and key rotation.
- Confirm whether generating a key invalidates the previous key immediately. The current response wording suggests rotation.
- Change key generation from `GET` to `POST` if possible. Secret rotation changes server state and should not be cacheable or triggered by link prefetching.
- Change payment-request creation from `GET` to a state-changing method if it creates a new payment session.
- Return key metadata such as `created_at`, `last_used_at`, and a masked suffix without returning the raw secret in the storefront list.
- Confirm whether a user may create unlimited storefronts and whether duplicate names, emails, or websites are allowed.
- Remove real-looking property keys from committed Bruno examples and replace them with environment variables or obvious dummy values.

The frontend can begin against the current deployed paths, but key rotation should not ship until its invalidation semantics are confirmed.

## Information Architecture

Add this route and tab:

```text
/app/profile/storefront  ->  Storefront
```

The Settings tab order becomes:

```text
Profile | My Addresses | Storefront | Appearance | Security | Verification
```

Storefront sits beside My Addresses because both configure delivery defaults. It should not contain transaction history or shipment tables.

## Screen Design

### No storefront yet

Show a concise centered onboarding state with no oversized bordered empty card:

- Title: **Connect Your Store**
- Supporting copy: **Turn orders from your store into deliveries you can manage in Fardelins.**
- Primary CTA: **Add Storefront**
- A short three-step explanation: add store details, choose couriers, connect with the API.

Selecting the CTA opens the setup form in the page, not a full-screen wizard.

### Setup and edit form

Group the form into glanceable sections:

1. **Store Details**
   - Store name
   - Store email
   - Store phone
   - Website
   - Description
2. **Dispatch Address**
   - Reuse the saved-address and location patterns where practical
   - Keep this optional because the API currently permits it
3. **Preferred Couriers**
   - Searchable multi-select populated from `/user/property/preferred-couriers`

Use the existing platform input and CTA styles. Save is enabled only when valid data differs from the loaded state. Use the button itself for `Saving...` and `Saved` feedback.

### Existing storefronts

For multiple storefronts:

- Desktop: compact selectable storefront list on the left and selected storefront details on the right.
- Mobile: storefront list followed by a drill-in details view with a clear back action.
- Show name, website or email, and a restrained configuration status.
- Provide **Add Storefront** without using a floating live indicator or flashing dot.
- Keep delete inside an overflow menu and require explicit confirmation.

### API Access section

Each storefront has a separate API Access section:

- Property ID is visible and copyable.
- API key is masked by default.
- Fetch the raw key only after **Reveal Key** is selected.
- Provide **Copy Key** with brief copied feedback.
- Provide **Regenerate Key** only after the backend rotation contract is confirmed.
- Regeneration requires a confirmation explaining that the current integration may stop working immediately.
- Explain that the credentials belong on the merchant's server and must not be embedded in public browser code.
- Include the staging or production base URL and the two required header names.

Never place a key in query parameters, logs, analytics events, error monitoring, `localStorage`, `sessionStorage`, or a global application store.

## Frontend Architecture

Keep storefront domain logic out of the already large Profile page. The Profile component remains the Settings shell and renders a feature-scoped child for this tab.

Create:

- `src/app/features/storefront/storefront.models.ts`
- `src/app/features/storefront/storefront.service.ts`
- `src/app/features/storefront/storefront.service.spec.ts`
- `src/app/features/storefront/pages/storefront-settings/storefront-settings.ts`
- `src/app/features/storefront/pages/storefront-settings/storefront-settings.html`
- `src/app/features/storefront/pages/storefront-settings/storefront-settings.css`
- `src/app/features/storefront/pages/storefront-settings/storefront-settings.spec.ts`

Modify:

- `src/app/app.routes.ts`
- `src/app/features/profile/pages/profile/profile.ts`
- `src/app/features/profile/pages/profile/profile.html`
- Only the minimum shell styling needed in `profile.css`

Use signals for local UI state and `HttpClient` with `injectLogisticsApiUrl()` for API calls, matching the existing services. Do not duplicate bearer-token handling already owned by the HTTP interceptor.

## Normalized Frontend Models

Define strict UI-facing models instead of passing API objects into templates:

```ts
export interface Storefront {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string | null;
  website: string | null;
  location: StorefrontLocation | null;
  preferredCourierIds: readonly string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StorefrontCredentials {
  propertyId: string;
  apiKey: string;
}
```

The service should normalize both direct payloads and `{ data: ... }` envelopes temporarily because the available examples are inconsistent. Once the backend publishes response schemas, replace tolerant parsing with the confirmed response contract.

## Implementation Tasks

### Task 1: Lock the API contract with service tests

Files:

- Create `storefront.models.ts`
- Create `storefront.service.ts`
- Create `storefront.service.spec.ts`

Steps:

1. Write failing request tests for list, create, update, delete, preferred couriers, reveal key, and generate key.
2. Assert the deployed `/v1/user/*` paths and request bodies exactly.
3. Add normalization tests for direct responses and `data` envelopes.
4. Implement the smallest service that passes the tests.
5. Convert API errors through the project's existing `parseApiError` utility.

Verification:

```powershell
npm run test:ci -- --include src/app/features/storefront/storefront.service.spec.ts
```

### Task 2: Add the Settings route and tab shell

Files:

- Modify `src/app/app.routes.ts`
- Modify `src/app/features/profile/pages/profile/profile.ts`
- Modify `src/app/features/profile/pages/profile/profile.html`
- Create the storefront settings component files

Steps:

1. Add `storefront` to `SettingsTab`.
2. Add the Storefront tab after My Addresses.
3. Resolve `/app/profile/storefront` in `activeTab`.
4. Add the lazy dashboard route using the existing Profile settings shell.
5. Render `<app-storefront-settings>` only for the storefront tab.
6. Keep all storefront-specific styling inside the child component.

### Task 3: Build loading, error, and onboarding states

Files:

- Modify storefront settings component and spec files

Steps:

1. Load storefronts when the component initializes.
2. Show a compact skeleton that matches the eventual layout.
3. Show a retryable inline error without clearing already loaded data.
4. Show the centered Connect Your Store state for an empty result.
5. Open and close the add form without route changes.
6. Preserve unsaved work unless the user confirms leaving the form.

### Task 4: Implement create and edit flows

Files:

- Modify storefront settings component and service specs

Steps:

1. Build required validation for name, email, and phone.
2. Normalize the website and validate it only when supplied.
3. Add optional description and dispatch address.
4. Load and select preferred couriers.
5. Disable Save until the form is valid and dirty.
6. On success, merge the returned storefront into local state and show `Saved` in the CTA.
7. On error, keep the user's form values and show the server message near the action.

### Task 5: Implement multiple-store management

Files:

- Modify storefront settings component files and specs

Steps:

1. Render all storefronts and retain the selected storefront by ID.
2. Make selection keyboard accessible.
3. Implement responsive desktop and mobile presentations.
4. Add delete confirmation containing the storefront name.
5. Remove the deleted item locally only after a successful response.
6. Select the next available storefront or return to the onboarding state.

### Task 6: Implement secure credential reveal and copy

Files:

- Modify storefront settings component files and specs

Steps:

1. Show the property ID without requesting the secret.
2. Request the API key only after explicit reveal.
3. Hold the key in a component signal only.
4. Mask it again after a short inactivity period and clear it when the component is destroyed or the selected storefront changes.
5. Copy through `navigator.clipboard` with an accessible fallback and temporary `Copied` feedback.
6. Add integration guidance containing the two header names.
7. Add regeneration only after the backend gate is satisfied, with destructive confirmation and immediate replacement of the in-memory key.

### Task 7: Connect storefront shipments to Parcels

Files:

- Update parcel models and mapping only after the shipment response contract is documented

Steps:

1. Add an optional storefront source to the normalized parcel model.
2. Show the storefront name as secondary metadata, not a new status.
3. Add a Storefront source filter if the API can filter or reliably identifies storefront shipments.
4. Keep status aggregation and delivery tracking behavior unchanged.

This task must not block the Settings tab if the existing parcel API does not yet expose storefront identity.

### Task 8: Accessibility and regression verification

Verify:

- Full keyboard access for tabs, store selection, menus, dialogs, reveal, and copy.
- Visible focus styles in light and dark themes.
- Secret values are not announced until revealed.
- Loading and save feedback uses polite live regions, not flashing visual indicators.
- Mobile layouts at 320, 375, 768, and desktop widths.
- No horizontal tab or form overflow.
- Reduced-motion behavior.
- Storefront secrets do not appear in browser storage or console output.

Run:

```powershell
npm run test:ci
npm run lint
npm run build
```

## Acceptance Criteria

- Settings contains a responsive Storefront tab at `/app/profile/storefront`.
- A customer can create, view, edit, and delete multiple storefronts.
- Required fields follow the deployed DTO contract.
- Preferred couriers come from the API rather than a hardcoded list.
- Storefront API credentials are clearly explained and copyable.
- The raw API key is loaded only on demand and never persisted in browser storage.
- Key regeneration cannot be triggered accidentally.
- The page has useful loading, empty, error, dirty, saving, and success states.
- Storefront configuration does not add transaction or shipment tables to Settings.
- Bruno and the deployed API no longer disagree about storefront management paths before release.

## Out of Scope for the First Release

- Storefront analytics
- Webhook management
- Plugin-specific Shopify or WooCommerce OAuth flows
- A public hosted storefront builder
- A separate storefront order dashboard
- Exposing API credentials in a client-side integration

