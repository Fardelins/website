# Fardelins landing page — conventions for agents

## Border radius: pill is not the default CTA shape

`--radius-100` (100px / `999px`) reads as a true pill and shows up across the codebase, but it
is **not** what primary CTA buttons use. Confirmed by checking the actual marketing-page and
form buttons (`.btn` in `src/app/shared/styles/forms.css`, `.navbar__btn` in
`src/app/layout/navbar/navbar.css`): both use `--radius-lg` (12px), a rounded rectangle.

Pill radius is legitimate — just for a different category of element, not buttons:

- **Toggles/segmented controls** — `.cookie__switch-track` (cookie-consent), `.appearance`
  (app-shell theme switch)
- **Badges/tags/counters** — `.cookie__badge`, blog category tags, the notification count
  bubble on the bell icon
- **Small accent shapes** — hamburger menu lines, the navbar's tiny avatar chip

When adding or reviewing a UI element, match radius to what it *is*, not just what looks nice:

| Element is a… | Use |
|---|---|
| Primary action / CTA button or button-styled link | `--radius-lg` (matches `.btn`, `.navbar__btn`) |
| Text input, textarea, `<select>` / dropdown | `--radius-md` (matches `.field input`/`textarea` in `forms.css`) |
| Toggle, segmented control, badge, tag, small counter chip | `--radius-100` / pill — this is correct, don't "fix" it to a rectangle |

Found and fixed during a 2026-09 sweep of the customer dashboard (`/app/*`): a `<select>`
dropdown was on pill radius in two places (`app-home.css` `.range select`,
`parcel-snapshot-card.css` `.snapshot__period select` — both moved to `--radius-md`), and a real
CTA link was on pill radius (`send-parcel-card.css` `.send-card__copy a` — moved to
`--radius-lg`). Toggles and the notification badge in `app-shell.css` were checked and left as
pill — they're the correct category for it.

## Color tokens: the Figma spec is the source of truth

Bami's actual design tokens (Primary ramp 50–900, Neutral, Styles, State, Accent — light AND
dark mode, both given explicitly) are the ground truth for every color in this app. If a token
in code doesn't match a spec value exactly, code is wrong, not the spec — don't invent an
approximate hex and move on. Ask for the Figma table again if it's not in context; don't guess.

**Dark-mode base surfaces are genuinely neutral by spec** — Off-White `#1A1A1A`, Stroke
`#2A2A2A`, Neutral-White `#0E0E0E` are true R=G=B grey, no hue. That was mistaken for an
unstyled/wireframe look once already (2026-09) and "fixed" by hand-tinting the neutrals toward
purple — wrong move, reverted. **Color belongs on interactive/active elements (Primary ramp),
not the base canvas/card/border planes.** If a dashboard surface still reads as flat or
wireframe-y after confirming the neutrals match spec, look for a missing accent on an
active/selected/hover state instead of re-tinting the neutrals — that's what it actually was
last time: `.rail__link--active` and `.shell__tab--active` had grey-on-grey with zero purple.

`src/styles.css` `--dashboard-*` tokens (dark block ~line 150, light block ~line 173) and
`src/app/features/app-shell/app-shell.css` `--color-primary-*`/`--rail-accent` (the dashboard's
local override of the sitewide Primary tokens, since the dashboard runs its own light/dark
toggle independent of the marketing site) now match the Figma ramp exactly, step for step.
`--dashboard-focus` uses Accent > Purple (`#7B61FF`) at reduced alpha — that Accent group is
fixed across both themes in the spec, unlike Primary. `--rail-accent-wash` (= Primary-50 for
the active theme) is the soft tint for an active row's background — reach for it before
grey when something needs to look "selected," not `--dashboard-selected`/`-control`, which are
for neutral hover/pressed states only.

Sitewide (non-dashboard) `--color-primary-*` in `src/styles.css` (~line 77) already matched the
light-mode ramp when checked — that one's fine, only the dashboard's local override drifted.
