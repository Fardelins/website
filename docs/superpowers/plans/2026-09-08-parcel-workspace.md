# Parcel Workspace Implementation Plan

> **For agentic workers:** Execute inline and verify each page as a complete slice.

**Goal:** Build a scan-friendly parcel list and a map-led parcel tracking detail page.

**Architecture:** Keep `DeliveriesService` as the single data source. Compose the detail page from the shared route map, geocoding, routing, status pill, and tracking phases already used elsewhere in the application.

**Tech Stack:** Angular signals and native control flow, MapLibre through `RouteMap`, existing CSS design tokens.

## Global Constraints

- Preserve existing status colours and customer-facing status aggregation.
- Show no rider marker for pending, assigned, office, or at-office states.
- Respect reduced motion and responsive dashboard layouts.

### Task 1: Rebuild parcel list

- [ ] Add computed status counts and active-first ordering to `deliveries-list.ts`.
- [ ] Replace the list template with a full-width header, summary, toolbar, and semantic parcel rows.
- [ ] Rebuild list styling for desktop scanning and mobile cards.
- [ ] Verify loading, error, no-parcel, and no-result states.

### Task 2: Add live route state to parcel detail

- [ ] Resolve pickup and destination points after detail data loads.
- [ ] Request the road route and derive the rider marker only for moving statuses.
- [ ] Fall back to the user's country overview when coordinates are unavailable.

### Task 3: Rebuild parcel detail interface

- [ ] Add the map-led hero with status and route information.
- [ ] Add the four-stage progress strip from the shared tracking phases.
- [ ] Rework timeline, facts, and actions into a responsive operational layout.
- [ ] Verify loading, failure, not-found, and missing-map-data states.

### Task 4: Verify

- [ ] Format changed files.
- [ ] Run focused tests for route progress and map behaviour.
- [ ] Run the Angular production build and report existing warnings separately.
