# Storefront Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a connected-success handoff after storefront creation and rebuild Storefront Details as a guided setup workspace.

**Architecture:** Extend the existing signal-based `StorefrontSettings` state machine rather than adding another route or service. Keep storefront creation and API-key generation as separate recoverable operations, then render the success handoff and details workspace from the resulting signals.

**Tech Stack:** Angular standalone component, Angular signals, reactive forms, existing Fardelins design tokens, existing StorefrontService.

## Global Constraints

- Do not add backend fields or endpoints.
- Preserve mock-session behaviour and shared courier fixtures.
- Keep API keys masked by default and automatically hide revealed values after 30 seconds.
- Use existing platform button shapes, design tokens and theme support.
- Do not add Live labels or flashing indicators.
- Do not use em dashes in shipped copy or documentation.
- Do not commit or push changes.

---

### Task 1: Add The Connection Handoff State

**Files:**

- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-settings.ts`
- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-settings.spec.ts`

**Interfaces:**

- Consumes: `StorefrontService.create(input)`, `StorefrontService.generateKey(id)`
- Produces: connection-stage signals, `finishConnection()`, `retryConnectionKey()` and stable post-create state

- [ ] Add a component test that creates a storefront, verifies API-key generation and expects the connected-success state to remain open.
- [ ] Run the focused component test and confirm it fails before the new state exists.
- [ ] Add the connection-stage signals and split create handling from edit handling.
- [ ] Generate the API key after a successful create, preserving the created storefront if key generation fails.
- [ ] Run the focused component test and confirm it passes.

### Task 2: Build The Connected-Success Modal

**Files:**

- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-settings.html`
- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-dialog.css`

**Interfaces:**

- Consumes: connection-stage signals and credential actions from Task 1
- Produces: accessible success handoff with credential copying, key retry and setup actions

- [ ] Replace the post-save timeout dismissal with a success panel inside the existing modal.
- [ ] Show store identity, Property ID, masked API key, preferred courier summary and three setup steps.
- [ ] Add `Open Storefront` and `Finish Later` actions using existing platform button styling.
- [ ] Add responsive styling and reduced-motion support for the success panel.
- [ ] Run the focused component test.

### Task 3: Rebuild Storefront Details

**Files:**

- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-settings.html`
- Modify: `src/app/features/storefront/pages/storefront-settings/storefront-settings.css`

**Interfaces:**

- Consumes: selected storefront, preferred courier names, API key and integration snippet
- Produces: guided storefront workspace with checklist, credentials, integration and operational details

- [ ] Replace the current details hierarchy with a store summary and setup checklist.
- [ ] Group Property ID, API key and Base URL in a clear Credentials section.
- [ ] Keep the connection test snippet compact and preserve copy feedback.
- [ ] Move courier, dispatch and contact information into understandable operational sections.
- [ ] Keep edit and removal actions available without visually competing with setup.

### Task 4: Verify Behaviour And Presentation

**Files:**

- Test: `src/app/features/storefront/pages/storefront-settings/storefront-settings.spec.ts`

**Interfaces:**

- Consumes: completed component
- Produces: verified responsive, themed and accessible Storefront flow

- [ ] Run the focused Storefront tests.
- [ ] Run the Angular development build.
- [ ] Inspect the changed files for accidental secrets and unrelated edits.
- [ ] Verify the creation, key-failure retry, copy, reveal, close and responsive states in the rendered UI when the local app is available.
