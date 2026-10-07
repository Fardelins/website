# Dashboard Map and Status Implementation Plan

> **For agentic workers:** Implement inline, verifying each dashboard behavior with focused tests.

**Goal:** Improve the live-delivery map and simplify dashboard-only parcel status reporting.

**Architecture:** Keep detailed API statuses intact and aggregate only through the shared dashboard grouping helper. Let the active-delivery card decide whether its map receives a rider coordinate, while the route-map remains status-agnostic.

**Tech Stack:** Angular 22, signals, MapLibre GL, Vitest.

## Global Constraints

- Use the title “Live delivery”.
- Show only Shipped, Delivered, Pending, and Cancelled in dashboard summaries.
- Preserve detailed status labels on other pages.

### Task 1: Dashboard aggregation

- [ ] Update the shared grouping vocabulary and dashboard models to four groups.
- [ ] Update chart semantics and aggregation tests.
- [ ] Run focused status and dashboard service tests.

### Task 2: Live delivery map

- [ ] Add the title and edge-to-edge top blur.
- [ ] Raise map controls above the blur.
- [ ] Replace the rider artwork with a bike-rider icon.
- [ ] Suppress rider coordinates for Pending and Assigned statuses.
- [ ] Add focused component coverage.

### Task 3: Delivered-card hierarchy

- [ ] Render delivered value and total first, followed by period copy and the bars.
- [ ] Verify formatting, lint, and production build.
