# Storefront Onboarding And Details Design

## Goal

Make connecting a storefront feel complete, understandable and safe. After a store is created, the user should immediately understand that the connection succeeded, receive the credentials needed for integration and know the next steps.

## Creation Flow

The existing two-step storefront form remains the source of store details, dispatch address and preferred couriers. Submitting a new store keeps the modal open and transitions it through three explicit states:

1. Connecting the storefront.
2. Preparing an API key.
3. Showing a connected-success handoff.

The connected-success state includes the store identity, Property ID, masked API key, copy and reveal controls, preferred courier summary and a short setup checklist. The primary action opens the new storefront details view. A secondary action closes the modal so setup can be completed later.

If storefront creation succeeds but key generation fails, the store remains connected. The success modal explains that only the key preparation failed and provides a retry action.

## Storefront Details

The selected storefront view becomes a guided workspace with this hierarchy:

1. Store identity, website and connection status.
2. A setup checklist showing the connected store, API credential readiness, courier preference and test-connection step.
3. Credentials containing Property ID, API key and Base URL.
4. A compact test-connection example.
5. Preferred couriers, dispatch address and contact details.
6. Edit and remove actions.

Credentials use neutral surfaces, restrained brand accents and inline mutation feedback. The API key automatically hides after 30 seconds. Copy actions animate within their initiating control and retain accessible labels.

## Responsive Behaviour

Desktop keeps the store selector rail and a single readable details column. Smaller screens turn the selector into a horizontally scrollable strip and stack every details section. Modal content remains within the viewport, with actions kept easy to reach without using a full-screen sheet.

## Accessibility And Motion

Dialogs retain modal semantics, labelled headings, keyboard focus indicators and disabled loading states. State changes are announced through status text. Motion is limited to short opacity and translation transitions and is removed when reduced motion is requested.

## Data And Failure Handling

No new backend fields are assumed. The flow uses the existing create, generate-key, reveal-key and preferred-courier operations. Mock sessions use the same state transitions and shared courier fixtures. Store creation and key generation are treated as separate operations so a key failure cannot discard a successfully created store.
