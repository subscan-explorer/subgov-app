# SubGov design system

## Visual direction

SubGov started as a port of Subscan Explorer's styles and has since moved to its own dashboard language, first built on Overview and then applied site-wide: a blue-grey canvas with floating white cards, large light-weight figures, charts as the focal element of a card, and a single accent — the Subscan brand gradient `linear-gradient(340.88deg, rgba(254, 56, 118, 0.52) 8.41%, #D030DD 91.59%)`. Component owners below keep their Subscan origin for behaviour, sizing and accessibility; their presentation follows this section.

## Theme and typography

- Inter 4.1, self-hosted as an upright variable WOFF2 under the SIL Open Font License 1.1 (see `public/fonts/OFL.txt`). The variable font covers weights 100–900, including the existing 400, 500, 600 and 700 styles. Page titles 32px mobile / 40px desktop (Overview 44px), regular weight, -0.03em; section titles 20px regular; card/module titles 18px regular; body 14px; supporting 12–13px. Large figures are regular weight with a quieter tail (units, decimals, "/ total").
- Light: canvas `#eef0f5`, cards `#ffffff`, soft fills `#f5f6f9`, text `#1b1b20`, secondary `#666572`, hairlines 8% ink, links `#0070d6` (4.9:1 on white).
- Dark: canvas `#1d1c22`, cards `#28272e`, soft fills `#32313a`, text `#f4f4f7`, secondary `#b3b2bf`, hairlines 8% white, links `#3ca2ff`.
- Accent: the brand gradient only — deciding/pending status dots, highlighted chart marks, the brand mark, the Overview hero tint. It never carries body text; text on accent surfaces uses `#9a1fa4` (light) / `#f3b0f7` (dark) on a soft tint.
- Status is a dot + label: gradient = deciding/pending, ink = confirming, grey = preparing, green = passed/paid/executed, red = rejected. Aye/Nay keep `#6bc10e` / `#ff475d` for charts with darker reading colours for text.
- Radii: cards 24px, list rows and wallet rows 16px, inputs 14px, menu items 12px, popovers 20px, buttons/badges/chips full pills.
- Motion: tokens `--ease-out`, `--dur-fast/base/slow`; cards rise in once, chart marks grow once, overlays fade/scale; `prefers-reduced-motion` disables all of it.

## Component ports

| SubGov owner | Subscan source | Presentation |
| --- | --- | --- |
| Button / action links | `src/ui/Button/Button.tsx` | Shared capsule geometry, size scale, focus/disabled behavior, and filled, soft, plain, selected, Aye and Nay variants. `ButtonLink` keeps navigational actions visually aligned with buttons. |
| Text, icon, menu and choice actions | `src/ui/Button/Button.tsx`, `src/ui/Menu/Menu.tsx`, `src/ui/Popover/Popover.tsx` | Shared text/icon hit areas, menu selection state, grouped choices, and keyboard focus treatment. |
| Field / Input / Select / Textarea / Checkbox | `src/ui/Input/Input.tsx`, `src/ui/Select/Select.tsx`, `src/ui/Checkbox/Checkbox.tsx` | One owner for labels, help/error copy, 40px input/select sizing, focus and disabled states, textarea sizing, native select indicator, and checkbox accent. |
| Panel / card | `src/ui/Box/Boundary.tsx` | 20px radius, secondary-surface border, `0 2px 10px rgba(0,0,0,.05)` shadow. `Panel` exposes named `compact`, `content`, `spacious` and `inline` padding variants; list rows own their internal spacing. |
| Detail module headings | `src/components/ModuleHeader/ModuleHeader.tsx` | 16px regular title, 35px minimum mini header, 10px bottom spacing and divider. |
| Table / VoteTable | `src/ui/Table/Table.tsx` | 12px bold secondary header, 14px cells, 8px horizontal / 16px vertical inset, secondary-surface separators, 10px outer cell corners, local horizontal scrolling. |
| StatusBadge | `src/components/Governance/ReferendaV2Status` and `src/components/Status` | Text with source success/failure icons, static clock for active/pending states, neutral circle for unmapped states; lifecycle status is not a loading animation. |

The `subscan-*` CSS classes centralize source measurements in the components layer. Repeated controls and card padding use their shared owners instead of page-local styles; disabled and keyboard-focus states remain consistent. The XL breakpoint is 1200px as in Explorer.

Local owners in `src/components/ui.tsx`: `Button`, `ButtonLink`, `TextButton`, `IconButton`, `MenuItem`, `ChoiceButton`, `ChoiceGroup`, `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `Panel`, `Badge`, `TrackBadge`, `StatusBadge`, `ModuleHeader`, `Stat`, and `Empty`. Keep native controls inside those owners; compose panels with the named `padding` variants and add page-specific classes only for structure or state, not a second copy of the base control style.

## Composition and behavior

SubGov keeps its 232px desktop navigation and mobile modal drawer because those are existing product navigation structures. The main area remains capped at 1400px. Its sidebar-aware gutter is 15px mobile / 30px desktop; Explorer's 100px desktop page gutter belongs to its full-width shell and is not copied inside the sidebar layout.

Preserve governance values, precision, links, network query parameters, input validation and signing safeguards. Native dialogs retain focus containment, Escape handling and focus restoration. The drawer locks background scrolling, closes on navigation and restores keyboard focus. Check composed screens in both themes, especially long identifiers, narrow tables and local data/error states.

## Composed interface rules

- Every titled content panel uses `ModuleHeader`: one full-width separator below the title and optional trailing metadata. Article headings and page-level section labels are separate roles.
- Comment and data lists separate adjacent records only. No first/last decorative borders next to panel boundaries or header dividers.
- Address/identity links have no decorative prefix dot; names wrap at words, while identifiers remain contained.
- Referendum voting belongs within Tally, with one full-width action and an adjacent explanation. On narrow layouts, tally and key metadata precede the reading/discussion stream.
- Topbar network and theme controls follow `ChainSwitcher/CurrentChain` and `Footer/ThemeSwitcher`: locally copied chain assets, outlined network selector and dropdown; unboxed theme trigger with Light/Dark/System choices. Network routing semantics are unchanged.
- Narrow proposal creation uses a grouped selector plus unavailable-template reasons. Desktop retains the full template catalogue.
- Mobile touch actions are at least 44px high and text inputs use 16px text to avoid automatic zoom. Supporting and semantic text colors are darkened/lightened for readability; chart/brand hues retain source values.
- Settings remain explicitly preview-only; UI must not claim persistence that does not exist.

## Layout and motion owners (design-audit pass)

- `PageHeader`: optional `back` link (always top-left, above the kicker), kicker above the title, then description and actions.
- `SectionHeader`: page-level section title with optional count/meta and a trailing `ArrowLink`.
- `RecordRow`: the single anatomy for record lists (referenda, spends, bounties, Fellowship referenda) — identifier · status badges · title · supporting line · one primary value. Rows sit directly in a flush `Panel` with `divide-y` so hover reaches the panel edge.
- `StatStrip`: several figures in one module; remains a single compact row on phones.
- `DetailLayout`: `lead` (tally/status) → `main` (reading column) → `details` (`MetaList`) on narrow screens; from 1200px a 320px sidebar holding lead + details stays in view (sticky, scrolls internally when taller than the viewport).
- Motion tokens: `--ease-out`, `--ease-in`, `--dur-fast` 120ms, `--dur-base` 200ms, `--dur-slow` 280ms. Dialogs fade/scale in, the mobile drawer slides in, Base UI popovers use `data-starting-style`/`data-ending-style`, tally bars grow on mount. `prefers-reduced-motion` disables all of it.
- Network switching is a client navigation (`router.push` inside a transition); the main area dims while the new network loads.
