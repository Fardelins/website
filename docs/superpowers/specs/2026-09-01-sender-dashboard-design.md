# Sender Dashboard Design

**Status:** Approved for planning

## Purpose

Replace the current narrow customer home with a full-width sender dashboard for an individual managing their own parcels. It must make sending a parcel effortless, make active deliveries immediately legible, and scale cleanly from phone to wide desktop without pretending the account is multi-user.

## Experience principles

- Personal, energetic, and dependable. The dashboard has richer colour, illustration, and motion, while retaining the refined Fardelins purple system.
- Soft rounded cards throughout. Every primary card has a distinct composition so the page never reads as a repeated KPI grid.
- Responsive information hierarchy. Sending is first on mobile, followed by parcel snapshots. Desktop gains a route preview and richer table because it has the room.
- Privacy is visible and controllable. Delivery spend remains represented when hidden, but no amount is exposed until the user reveals it.
- Motion adds feedback, never friction. Respect `prefers-reduced-motion` and a user-level disable setting.

## Desktop composition

The dashboard owns the full available content width inside the app shell. It is not centred as a narrow column.

1. **Header**: time-aware personal greeting, notification bell, theme preference control where appropriate.
2. **Lead send card**: editorial purple-led card, neutral cardboard parcel with restrained Fardelins-purple branding, an in-transit route treatment, and a single `Create delivery` CTA to `/app/send`.
3. **Parcel snapshot cards**: four unique cards for In transit, Delivered, Total parcels, and Delivery spend. Delivered has an in-card period menu: This week, Last 6 months, This year, All time. Spend has an eye control and a locked treatment when hidden.
4. **Activity card**: one chart with a Parcels/Spend toggle and Weekly/Monthly control. It becomes a static empty state if no deliveries exist.
5. **Nearest upcoming delivery**: a card showing recipient name, destination, and ETA first. It includes an active-delivery count, previous/next controls for other deliveries, a light or dark map-style route preview based on theme, and `View` plus an optional expand action.
6. **Recent parcels**: a rich desktop table, with delivery state, recipient/destination, created date, ETA, and amount where the server supplies it.

## Mobile and tablet composition

- **Wide desktop, 1200px and above**: full sidebar, multi-column editorial card layout, route preview visible.
- **Tablet, 768px to 1199px**: sidebar contracts to icon rail, cards reflow to two columns, map remains within the active-delivery card where space permits.
- **Phone, below 768px**: compact header and mobile navigation, send card then parcel snapshots, active delivery uses a timeline rather than a map, parcel records become stacked cards, and chart controls remain usable without horizontal clipping.
- The nearest active delivery stays one card at every breakpoint. On phone its route preview is replaced with the existing delivery phase timeline and the View CTA.

## Empty, loading, error, and privacy states

- **No parcels**: send card says `Send your first parcel`; summary values display zero; chart and recent list explain that delivery activity will appear after the first booking; no artificial map or shipment data is shown.
- **Loading**: card-shaped skeletons preserve the desktop and mobile layout.
- **Delivery fetch failure**: retain the send action and show an inline retry state for delivery-derived modules.
- **Spend hidden**: the card stays in the grid as a discreet locked card with an eye toggle. It never renders real values or chart points until unhidden.

## Theme and preferences

- Light and dark themes use semantic CSS variables, defaulting to the device setting.
- A stored preference supports Light, Dark, and System.
- Map styling follows the selected effective theme: light map for light mode and dark map for dark mode.
- The theme selector, spend visibility, and animation preference are local account preferences until matching backend fields exist.

## Navigation and adjacent surfaces

- Sidebar: Home, My Parcels, Transactions, Profile, Help, plus persistent Create delivery.
- Profile receives saved addresses. It remains a profile concern, not a sidebar destination.
- Help becomes a simple support page.
- The header bell opens a notification dropdown containing delivery-status updates only. It does not include account marketing or promotional messages.

## Data strategy

`DeliveriesService.list()` is the first live source. Existing delivery summaries provide tracking ID, title, status, created label, drop-off, ETA label, and optional amount label. The dashboard must centralize temporary aggregation in a dashboard data adapter, not spread mock calculations through templates.

Initial mock aggregation derives:

- `inTransitCount` from non-final shipment statuses.
- `deliveredCount` by the selected Delivered period when raw dates are available, with a labelled fallback for mock data.
- `totalParcels` from all available deliveries.
- `deliverySpend` from parseable amount fields only.
- weekly and monthly parcel/spend series from delivery dates and amounts.
- `nearestUpcoming` from active deliveries with ETA, falling back to the most recent active delivery.

When backend delivery records expose coordinates, recipient names, raw ISO dates, currency, and prices, the adapter expands without changing card interfaces. The initial map is a branded real-map-style route preview, not a third-party interactive map dependency.

Currency, number formatting, and date formatting follow the sender country and locale. The initial locale can use the authenticated profile country when available, otherwise browser locale, with a documented fallback.

## Visual and interaction language

- Use Solar bold-duotone icons.
- Use a neutral cardboard parcel with compact purple mark, dimensional shadow, route line, and small motion details instead of photography or cartoon art.
- Card entrances, number counters, line or area chart drawing, and parcel movement are premium and visibly fun. They start after content becomes available and never rerun on every signal update.
- No animation runs under reduced-motion or when the account preference disables it.
- Map preview uses theme-appropriate roads, route line, origin/destination pins, and avoids collecting location data in the client.

## Non-goals for the first implementation

- No live map provider, geocoding, routing API, or background location tracking.
- No inferred delivery insights or user-behaviour analytics card.
- No multi-user workspace, courier management, or promotional notifications.
- No backend contract changes without an explicit backend request.
