# Dashboard Map and Status Design

The active-delivery map is titled “Live delivery”. Its soft top-edge blur spans the full card, while the title, zoom controls, and recenter control remain visually above it.

Pickup and destination house markers always remain visible when coordinates are available. A motorcycle-rider marker appears only for moving statuses; Pending and Assigned routes show no rider marker.

Dashboard parcel activity and the Delivered card use four aggregate groups: Shipped (Picked up, Enroute, Out for delivery, and other moving states), Pending (Pending, Assigned, At office, and other stationary pre-delivery states), Delivered, and Cancelled. This aggregation does not alter detailed status names or their established colors on delivery, tracking, or status-pill UI.

The map clips its full-width blur to the card, keeps zoom and recenter controls above that blur, and loads attribution collapsed behind its information icon. A quiet divider and downward chevron between dashboard bands indicates more content below. The empty map message uses the same compact width as the live-delivery sheet.

The Delivered card reads in this order: delivered count with “out of N parcels”, “Delivered this week”, then the aggregate status bar.
