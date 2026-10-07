# Sender Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, themed, sender-first dashboard that makes parcel creation and active delivery tracking the primary experience.

**Architecture:** Retain `/app` and replace its current narrow home content with a composed dashboard shell backed by a focused dashboard data adapter. Delivery data remains sourced from `DeliveriesService`; mock aggregation and backend-shape tolerance live in a dedicated service so cards consume stable view models. Add user interface preferences locally and use semantic CSS variables to drive light and dark themes.

**Tech Stack:** Angular 22 standalone components, Signals, Angular Router, existing `@ng-icons/solar-icons`, CSS custom properties, existing `motion` dependency, Vitest/Angular test runner. Evaluate `ngx-echarts` only if CSS/SVG chart implementation cannot meet the approved interaction specification without excessive custom code.

## Global Constraints

- Keep all existing routes functional, especially `/app/send`, `/app/deliveries`, `/app/transactions`, and profile routes.
- Use Solar bold-duotone icons and the established Fardelins typography and purple system.
- Add no live map, geocoding, or routing provider in this scope.
- The map is a static, branded, theme-aware route preview until backend coordinate data exists.
- Currency and date formatting must follow sender country/locale when available and use browser locale as fallback.
- Respect `prefers-reduced-motion` and an explicit stored animation preference.
- Do not expose spend data when the stored spend-visibility preference is false.
- Use `apply_patch` for edits and do not commit unless the user explicitly requests it.
- Do not use em dashes in code comments, UI copy, specifications, or documentation.

---

## File Structure

- Create `src/app/features/dashboard/dashboard.models.ts`: dashboard view-model types, metric periods, preferences, and chart series.
- Create `src/app/features/dashboard/dashboard-data.service.ts`: converts `DeliverySummary[]` into dashboard data and owns mock-safe aggregation.
- Create `src/app/features/dashboard/dashboard-data.service.spec.ts`: validates status grouping, period aggregation, active-delivery selection, spend parsing, and empty data.
- Create `src/app/core/services/dashboard-preferences.service.ts`: persisted theme, motion, and spend visibility preferences.
- Create `src/app/core/services/dashboard-preferences.service.spec.ts`: validates defaulting, persistence, and system preference fallback.
- Create `src/app/features/dashboard/components/send-parcel-card/*`: editorial send CTA and parcel illustration.
- Create `src/app/features/dashboard/components/parcel-snapshot-card/*`: unique metric-card presentation with period and privacy controls.
- Create `src/app/features/dashboard/components/delivery-activity-chart/*`: switchable weekly/monthly, parcels/spend chart.
- Create `src/app/features/dashboard/components/active-delivery-card/*`: desktop route preview, mobile timeline, carousel controls, View CTA.
- Create `src/app/features/dashboard/components/recent-parcels/*`: responsive table and mobile parcel-card presentation.
- Create `src/app/features/dashboard/components/notification-menu/*`: delivery-only notification dropdown.
- Create `src/app/features/help/pages/help/*`: simple support page.
- Modify `src/app/features/app-home/app-home.{ts,html,css}`: compose the dashboard and remove the old narrow home layout.
- Modify `src/app/features/app-shell/app-shell.{ts,html,css}`: responsive sidebar, header coordination, Help navigation, tablet icon rail, and theme preference entry.
- Modify `src/app/features/profile/pages/profile/*`: add saved-addresses section or entry point.
- Modify `src/app/app.routes.ts`: add `/app/help` route.
- Modify global theme styles where existing semantic variables are defined: add light/dark semantic dashboard tokens without hard-coded component colours.

### Task 1: Establish dashboard types and delivery aggregation

**Files:**
- Create: `src/app/features/dashboard/dashboard.models.ts`
- Create: `src/app/features/dashboard/dashboard-data.service.ts`
- Test: `src/app/features/dashboard/dashboard-data.service.spec.ts`

**Interfaces:**
- Consumes: `DeliverySummary` from `@features/deliveries/deliveries.model`.
- Produces: `DashboardDataService.build(deliveries: DeliverySummary[], period: DeliveredPeriod, locale: string): SenderDashboardData`.
- Produces: `SenderDashboardData` with `metrics`, `activity`, `activeDeliveries`, and `recentParcels`.

- [ ] **Step 1: Write failing aggregation tests**

```ts
it('builds counts, active delivery and spend from summaries', () => {
  const result = service.build(fixtures, 'all-time', 'en-NG');
  expect(result.metrics.inTransit.value).toBe(2);
  expect(result.metrics.totalParcels.value).toBe(3);
  expect(result.activeDeliveries[0].trackingId).toBe('FDL-002');
  expect(result.metrics.spend.value).toBe(12500);
});

it('returns an empty dashboard without synthetic deliveries', () => {
  const result = service.build([], 'this-week', 'en-NG');
  expect(result.isEmpty).toBe(true);
  expect(result.activeDeliveries).toEqual([]);
  expect(result.activity.parcels).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --no-watch --include src/app/features/dashboard/dashboard-data.service.spec.ts`

Expected: FAIL because the dashboard data service does not exist.

- [ ] **Step 3: Define stable dashboard view models and implement minimal aggregation**

```ts
export type DeliveredPeriod = 'this-week' | 'last-six-months' | 'this-year' | 'all-time';
export type ActivityMetric = 'parcels' | 'spend';
export type ActivityRange = 'weekly' | 'monthly';

export interface SenderDashboardData {
  isEmpty: boolean;
  metrics: DashboardMetrics;
  activity: DashboardActivity;
  activeDeliveries: ActiveDeliveryCardData[];
  recentParcels: DeliverySummary[];
}

build(deliveries: DeliverySummary[], period: DeliveredPeriod, locale: string): SenderDashboardData {
  // Parse only supplied money labels, then return normalized card data.
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --no-watch --include src/app/features/dashboard/dashboard-data.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Run formatting validation for the new files**

Run: `npx prettier --check "src/app/features/dashboard/**/*.{ts,html,css}"`

Expected: PASS.

### Task 2: Create persisted dashboard preferences and semantic theme contract

**Files:**
- Create: `src/app/core/services/dashboard-preferences.service.ts`
- Create: `src/app/core/services/dashboard-preferences.service.spec.ts`
- Modify: global theme stylesheet containing existing CSS custom properties

**Interfaces:**
- Produces: `DashboardPreferencesService.theme`, `motionEnabled`, and `spendVisible` as readonly signals.
- Produces: `setTheme(theme: 'light' | 'dark' | 'system'): void`, `setMotionEnabled(enabled: boolean): void`, and `setSpendVisible(visible: boolean): void`.
- Consumes: CSS attribute `data-theme` on the document root.

- [ ] **Step 1: Write failing preference tests**

```ts
it('uses System theme and enabled motion by default', () => {
  expect(service.theme()).toBe('system');
  expect(service.motionEnabled()).toBe(true);
});

it('persists a hidden spend preference', () => {
  service.setSpendVisible(false);
  expect(localStorage.getItem('fardelins.dashboard.preferences')).toContain('"spendVisible":false');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --no-watch --include src/app/core/services/dashboard-preferences.service.spec.ts`

Expected: FAIL because the preference service does not exist.

- [ ] **Step 3: Implement preference storage and theme application**

```ts
export interface DashboardPreferences {
  theme: 'light' | 'dark' | 'system';
  motionEnabled: boolean;
  spendVisible: boolean;
}

private readonly storageKey = 'fardelins.dashboard.preferences';

setTheme(theme: DashboardPreferences['theme']): void {
  this.preferences.update((current) => ({ ...current, theme }));
  this.applyTheme();
  this.persist();
}
```

- [ ] **Step 4: Add light/dark semantic variables for dashboard surfaces**

```css
:root[data-theme='light'] {
  --dashboard-surface: #ffffff;
  --dashboard-canvas: #f7f5ff;
  --dashboard-map-surface: #edf0f4;
}

:root[data-theme='dark'] {
  --dashboard-surface: #17151f;
  --dashboard-canvas: #0d0c12;
  --dashboard-map-surface: #1b2027;
}
```

- [ ] **Step 5: Run preference tests and formatting validation**

Run: `npm test -- --no-watch --include src/app/core/services/dashboard-preferences.service.spec.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

### Task 3: Build the editorial send-parcel card and four expressive snapshot cards

**Files:**
- Create: `src/app/features/dashboard/components/send-parcel-card/send-parcel-card.{ts,html,css}`
- Create: `src/app/features/dashboard/components/parcel-snapshot-card/parcel-snapshot-card.{ts,html,css}`
- Test: matching `*.spec.ts` files

**Interfaces:**
- Consumes: `DashboardMetric`, `DeliveredPeriod`, and `DashboardPreferencesService`.
- Produces: `SendParcelCard` with a RouterLink to `/app/send`.
- Produces: `ParcelSnapshotCard` inputs `metric`, `deliveredPeriod`, and `spendVisible`, outputs `deliveredPeriodChange` and `spendVisibleChange`.

- [ ] **Step 1: Write failing component tests**

```ts
it('links the lead action to parcel creation', () => {
  expect(fixture.nativeElement.querySelector('a[href="/app/send"]')).not.toBeNull();
});

it('does not render a hidden spend amount', () => {
  component.metric = spendMetric;
  component.spendVisible = false;
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).not.toContain('₦12,500');
});
```

- [ ] **Step 2: Run component tests and verify they fail**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the card interfaces and editorial visual treatment**

```ts
@Input({ required: true }) metric!: DashboardMetric;
@Input() deliveredPeriod: DeliveredPeriod = 'this-week';
@Input() spendVisible = true;
@Output() readonly deliveredPeriodChange = new EventEmitter<DeliveredPeriod>();
@Output() readonly spendVisibleChange = new EventEmitter<boolean>();
```

Use CSS and inline HTML elements for the neutral cardboard parcel, purple label, route line, and dimensional shadow. Do not introduce an image-generation dependency or a raster asset.

- [ ] **Step 4: Run component tests and check keyboard access**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components`

Expected: PASS.

Manual check: Delivered period and spend eye controls are native buttons with visible focus treatment and descriptive `aria-label` values.

- [ ] **Step 5: Run formatting validation**

Run: `npm run lint`

Expected: PASS.

### Task 4: Build the switchable delivery-activity chart

**Files:**
- Create: `src/app/features/dashboard/components/delivery-activity-chart/delivery-activity-chart.{ts,html,css}`
- Test: `src/app/features/dashboard/components/delivery-activity-chart/delivery-activity-chart.spec.ts`

**Interfaces:**
- Consumes: `DashboardActivity`, `ActivityMetric`, `ActivityRange`, and `motionEnabled`.
- Produces: `DeliveryActivityChart` inputs `activity` and `spendVisible`; local switches for metric and range.

- [ ] **Step 1: Write failing chart tests**

```ts
it('switches from parcels to spend when the metric control is clicked', () => {
  clickButton('Spend');
  expect(component.metric()).toBe('spend');
});

it('disables the spend view while spend data is private', () => {
  component.spendVisible = false;
  fixture.detectChanges();
  expect(button('Spend').disabled).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/delivery-activity-chart/delivery-activity-chart.spec.ts`

Expected: FAIL because the chart component does not exist.

- [ ] **Step 3: Implement a lightweight accessible SVG area chart first**

```ts
protected readonly metric = signal<ActivityMetric>('parcels');
protected readonly range = signal<ActivityRange>('weekly');
protected readonly chartPoints = computed(() =>
  this.activity[this.range()][this.metric()].map((point, index) => ({ ...point, index })),
);
```

Render chart points as SVG paths with text equivalents for screen readers. Apply draw-in CSS only when motion is enabled. Install no chart dependency unless a written follow-up accepts the added bundle size and configuration cost.

- [ ] **Step 4: Run focused chart tests and motion check**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/delivery-activity-chart/delivery-activity-chart.spec.ts`

Expected: PASS.

Manual check: with reduced motion or stored disabled motion, chart appears fully rendered with no delayed path animation.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 5: Build the nearest active-delivery card with theme-aware route preview

**Files:**
- Create: `src/app/features/dashboard/components/active-delivery-card/active-delivery-card.{ts,html,css}`
- Test: `src/app/features/dashboard/components/active-delivery-card/active-delivery-card.spec.ts`

**Interfaces:**
- Consumes: `ActiveDeliveryCardData[]`, `effectiveTheme`, and `motionEnabled`.
- Produces: `ActiveDeliveryCard` with `selectedIndex`, previous/next controls, RouterLink to `/app/deliveries/:trackingId`, desktop route preview, mobile phase timeline.

- [ ] **Step 1: Write failing active-delivery tests**

```ts
it('shows recipient, destination and ETA for the selected parcel', () => {
  expect(fixture.nativeElement.textContent).toContain('Maya Okafor');
  expect(fixture.nativeElement.textContent).toContain('Lekki, Lagos');
  expect(fixture.nativeElement.textContent).toContain('Tomorrow');
});

it('advances to the next active parcel without exceeding bounds', () => {
  component.next();
  component.next();
  expect(component.selectedIndex()).toBe(1);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/active-delivery-card/active-delivery-card.spec.ts`

Expected: FAIL because the active-delivery component does not exist.

- [ ] **Step 3: Implement card controls, static route preview, and mobile timeline**

```ts
protected readonly selectedIndex = signal(0);
protected readonly selected = computed(() => this.deliveries[this.selectedIndex()] ?? null);

protected next(): void {
  this.selectedIndex.update((index) => Math.min(index + 1, this.deliveries.length - 1));
}
```

Use inline SVG for themed roads, route, origin, destination, and package marker. Switch CSS variables with effective theme. Use `@media (max-width: 767px)` to hide the SVG and show the phase timeline.

- [ ] **Step 4: Run active-delivery tests and responsive visual check**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/active-delivery-card/active-delivery-card.spec.ts`

Expected: PASS.

Manual check: desktop exposes View and Expand; phone exposes timeline and View without a map.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 6: Build recent-parcel table and delivery-only notifications

**Files:**
- Create: `src/app/features/dashboard/components/recent-parcels/recent-parcels.{ts,html,css}`
- Create: `src/app/features/dashboard/components/notification-menu/notification-menu.{ts,html,css}`
- Test: matching `*.spec.ts` files

**Interfaces:**
- Consumes: `DeliverySummary[]` and `DeliveryNotification[]` derived from delivery events/statuses.
- Produces: responsive recent-parcels display and an accessible notification disclosure menu.

- [ ] **Step 1: Write failing responsive-content and notification tests**

```ts
it('renders parcel headers and the tracking ID in the desktop table', () => {
  expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  expect(fixture.nativeElement.textContent).toContain('FDL-001');
});

it('opens only delivery updates from the bell trigger', () => {
  clickBell();
  expect(fixture.nativeElement.textContent).toContain('Your parcel is en route');
  expect(fixture.nativeElement.textContent).not.toContain('Special offer');
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/recent-parcels src/app/features/dashboard/components/notification-menu`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement semantic table and mobile parcel cards**

```html
<table>
  <caption class="sr-only">Recent parcels</caption>
  <thead><tr><th>Parcel</th><th>Destination</th><th>Status</th><th>ETA</th></tr></thead>
  <tbody><!-- delivery rows --></tbody>
</table>
```

At phone widths replace the visual table with article cards but retain the same supplied values. Use an `aria-expanded` bell button and close the notification menu on Escape or focus leaving the menu.

- [ ] **Step 4: Run focused tests and keyboard check**

Run: `npm test -- --no-watch --include src/app/features/dashboard/components/recent-parcels src/app/features/dashboard/components/notification-menu`

Expected: PASS.

Manual check: Tab, Enter, Escape, and focus states operate correctly in the notification menu.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 7: Compose the new app home and preserve async states

**Files:**
- Modify: `src/app/features/app-home/app-home.ts`
- Modify: `src/app/features/app-home/app-home.html`
- Modify: `src/app/features/app-home/app-home.css`
- Test: `src/app/features/app-home/app-home.spec.ts`

**Interfaces:**
- Consumes: `DeliveriesService.list()`, `DashboardDataService`, `DashboardPreferencesService`, and dashboard components from Tasks 3 through 6.
- Produces: `/app` dashboard with loading, error, populated, privacy, and first-delivery empty states.

- [ ] **Step 1: Write failing home-state tests**

```ts
it('shows the first-parcel state when delivery list is empty', async () => {
  deliveries.list.mockResolvedValue([]);
  await component.load();
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Send your first parcel');
});

it('retains the send CTA when deliveries fail to load', async () => {
  deliveries.list.mockRejectedValue(new Error('offline'));
  await component.load();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('a[href="/app/send"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run home tests and verify they fail**

Run: `npm test -- --no-watch --include src/app/features/app-home/app-home.spec.ts`

Expected: FAIL until the composition exposes the approved states.

- [ ] **Step 3: Replace the narrow home composition with dashboard sections**

```ts
protected readonly deliveredPeriod = signal<DeliveredPeriod>('this-week');
protected readonly dashboard = computed(() =>
  this.dashboardData.build(this.all(), this.deliveredPeriod(), this.locale()),
);
```

Keep `load()` as the only delivery request. Feed all child cards derived data rather than allowing each card to fetch independently. Set appropriate noindex page metadata for `/app`.

- [ ] **Step 4: Run home tests and perform responsive checks**

Run: `npm test -- --no-watch --include src/app/features/app-home/app-home.spec.ts`

Expected: PASS.

Manual check at 375px, 768px, 1024px, and 1440px: send action stays first on phone; tablet uses the upcoming shell rail; desktop uses the expanded composition.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: PASS with no Angular template or SSR errors.

### Task 8: Upgrade the app shell and add Help plus saved-address access

**Files:**
- Modify: `src/app/features/app-shell/app-shell.{ts,html,css}`
- Create: `src/app/features/help/pages/help/help.{ts,html,css}`
- Modify: `src/app/features/profile/pages/profile/profile.{ts,html,css}`
- Modify: `src/app/app.routes.ts`
- Test: `src/app/features/app-shell/app-shell.spec.ts`
- Test: `src/app/features/help/pages/help/help.spec.ts`

**Interfaces:**
- Consumes: `DashboardPreferencesService` and existing `AuthService`.
- Produces: Help navigation at `/app/help`, desktop sidebar, tablet icon rail, mobile navigation/drawer, theme control, and profile saved-address entry.

- [ ] **Step 1: Write failing navigation and route tests**

```ts
it('includes Help in desktop navigation', () => {
  expect(component.navItems.some((item) => item.path === '/app/help')).toBe(true);
});

it('loads the Help route under the authenticated app shell', async () => {
  await router.navigateByUrl('/app/help');
  expect(location.path()).toBe('/app/help');
});
```

- [ ] **Step 2: Run shell and route tests to verify they fail**

Run: `npm test -- --no-watch --include src/app/features/app-shell/app-shell.spec.ts src/app/app.routes.spec.ts`

Expected: FAIL until Help and responsive navigation are implemented.

- [ ] **Step 3: Implement shell breakpoints, Help, and saved-address entry**

```ts
protected readonly navItems: NavItem[] = [
  { label: 'Home', path: '/app', icon: 'solarHome2BoldDuotone', tab: true },
  { label: 'My Parcels', path: '/app/deliveries', icon: 'solarBoxBoldDuotone', tab: true },
  { label: 'Transactions', path: '/app/transactions', icon: 'solarBillListBoldDuotone', tab: false },
  { label: 'Profile', path: '/app/profile', icon: 'solarUserRoundedBoldDuotone', tab: true },
  { label: 'Help', path: '/app/help', icon: 'solarQuestionCircleBoldDuotone', tab: false },
];
```

Add a profile section or navigable panel called `Saved addresses`. If no address API exists, render a clear empty state and a non-destructive `Add an address` entry that is only wired to the later profile-address flow after it exists.

- [ ] **Step 4: Run focused tests and breakpoint checks**

Run: `npm test -- --no-watch --include src/app/features/app-shell/app-shell.spec.ts src/app/features/help/pages/help/help.spec.ts src/app/app.routes.spec.ts`

Expected: PASS.

Manual check: sidebar is full at 1200px+, icon rail between 768px and 1199px, and phone navigation does not block page actions.

- [ ] **Step 5: Run full verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

### Task 9: Validate performance, accessibility, motion, and backend compatibility

**Files:**
- Modify: any files from Tasks 1 through 8 only for discovered defects.
- Test: existing and newly created dashboard-focused tests.

**Interfaces:**
- Consumes: fully integrated dashboard.
- Produces: verified release candidate with no new runtime errors.

- [ ] **Step 1: Test motion preference paths**

Set stored preferences to `{ "motionEnabled": false }` and emulate reduced motion. Confirm counters, chart paths, and parcel treatment render immediately without animation.

- [ ] **Step 2: Test sensitive-data paths**

Set `spendVisible` to false. Confirm no amount text, data points, `aria-label`, or DOM data attribute exposes a spend value. Toggle it on and confirm the value and chart option return.

- [ ] **Step 3: Test backend-shape tolerance**

Run `DashboardDataService.build()` fixtures covering missing `amountLabel`, missing `etaLabel`, empty drop-off, and unknown status. Confirm cards use labelled fallbacks and do not throw.

- [ ] **Step 4: Run automated verification**

Run: `npm test -- --no-watch`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Perform final visual and accessibility review**

Check 375px, 768px, 1024px, and 1440px in both themes. Verify 200% text zoom, keyboard-only card controls, visible focus states, no horizontal scroll, and correct light/dark map styling.

## Self-review

- **Spec coverage:** Tasks 1 through 9 cover the sender hero, four unique metrics, period controls, spend privacy, activity chart, desktop map and mobile timeline, carousel, table/cards, notification dropdown, themes, motion, Help, saved addresses, loading/error/empty states, and backend aggregation boundary.
- **Deliberate exclusions:** live routing/maps, backend API mutations, inferred insights, multi-user workspaces, promotional notifications, and a chart dependency are not included.
- **Placeholder scan:** all proposed interfaces, files, test commands, and state behaviors are named. The only deferred wiring is saved-address editing because no address API or route exists; its first version is explicitly an empty-state entry and cannot silently create data.
- **Type consistency:** `DeliveredPeriod`, `ActivityMetric`, `ActivityRange`, `SenderDashboardData`, and `DashboardPreferencesService` are defined in Tasks 1 and 2 before later tasks consume them.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-01-sender-dashboard.md`.

Two execution options:

1. Subagent-Driven, recommended. Dispatch a fresh subagent per task and review between tasks.
2. Inline Execution. Execute tasks in this session with checkpoints.

Choose one when you are ready to build. No code has been changed.
