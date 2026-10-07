# Parcel Workspace Design

## Goal

Rebuild the authenticated parcel list and parcel detail routes as one operational workspace using live delivery data and the public tracking page's clearest progress patterns.

## Parcel list

- Fill the dashboard content width with a concise introduction, primary send action, status summary, search, and filters.
- Prioritise active shipments before terminal shipments while preserving newest-first order inside each group.
- Present desktop rows with parcel, route, date, status, and amount columns. Collapse each row into a readable mobile card.
- Preserve the existing status pill colours and expose counts inside the filter controls.
- Keep loading, error, first-use, and filtered-empty states actionable.

## Parcel detail

- Make the live route map the main visual surface.
- Geocode the stored pickup and drop-off addresses, request the road route, and derive the rider position from the current phase.
- Hide the rider for pending, assigned, and office statuses while retaining pickup, destination, and route markers.
- Place a four-stage progress strip directly below the map using the same customer-facing hierarchy as the public tracker.
- Use a wide tracking timeline beside a compact delivery-information panel on desktop and a single column on mobile.
- Preserve invoice, public tracking, retry, missing-route, and missing-delivery flows.

## Quality

- Use existing dashboard tokens, typography, status components, map controls, services, and live API data.
- Support keyboard focus, reduced motion, dark and light themes, and narrow screens.
- Do not introduce a second tracking data model or mapping dependency.
