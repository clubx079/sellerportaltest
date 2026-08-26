# DeelMap BW-Retro UI Contract

The single source of truth for restyling this codebase. Derived from
`../deelmap-brand-guidelines.html` (Brand Guidelines v1.0) and the BW-retro
design handoff. **Strictly monochrome — no hues anywhere, ever.**

## Stack facts (SELLER PORTAL VARIANT)

- This repo uses **Tailwind v3** — tokens live in `tailwind.config.js` (NOT a
  CSS `@theme`). All token class names below work identically. Legacy names
  (`primary`, `brandRed`, `status.*`, `shadow-card`) are aliased to the
  monochrome system. The `1.5` borderWidth exists: use `border-1.5` OR
  `border-[1.5px]` — both compile.
- Seller-portal wordmark: `<Logo size="header" />` plus a mono
  `SELLER PORTAL` tag where the old logo image carried the subtitle.

## Stack facts (original)

- Tailwind CSS **v4** (CSS-first). All tokens below are registered in
  `app/globals.css` via `@theme` and are real utility classes.
- Fonts are loaded in `app/layout.js` via `next/font` and exposed as CSS vars:
  `--font-display` (Archivo), `--font-sans` (Instrument Sans),
  `--font-mono` (IBM Plex Mono), `--font-logo` (Space Grotesk).
  Tailwind: `font-display`, `font-sans`, `font-mono`, `font-logo`.
- The logo is a React component: `import { Logo } from '@/components/ui/Logo'`
  — `<Logo size="header" />`, `<Logo size="footer" />`, `<Logo onDark />`.
  **Never use `/assets/logo.svg` or any image logo.**

## Color tokens (Tailwind class suffixes)

| Token | Hex | Use |
|---|---|---|
| `ink` | #111111 | borders, buttons, pins, offset shadows, primary actions |
| `body` | #171717 | body text |
| `coal` / `coal-card` / `coal-line` / `coal-shadow` | #0a0a0a / #151515 / #3a3a3a / #2b2b2b | dark surfaces (dark is a *surface*, not a theme) |
| `smoke-2` / `smoke-3` / `smoke-4` | #444444 / #555555 / #666666 | secondary/muted text; #444 is also hover fill for ink buttons |
| `muted` | #757575 | mono labels, metadata, placeholders |
| `mist` | #a3a3a3 | muted text on dark |
| `shadowgrey` | #bdbdbd | offset shadow on black cards |
| `line` / `line-2` | #cccccc / #dddddd | inactive input borders, hairline pills |
| `hairline` / `hairline-2` / `hairline-3` | #e5e5e5 / #ececec / #ededed | dividers |
| `tint` / `tint-2` / `tint-3` | #f2f2f2 / #f7f7f7 / #fafafa | hover fills, tinted sections, app bg |
| `paper` | #ffffff | cards, headers |

Status is encoded by value, never hue: available = `bg-ink`, pending =
`bg-muted`, sold = `bg-mist` (see `.status-*` in globals.css).

## Shadows (utility classes)

`shadow-offset-2|3|4|5|6|7` (hard Npx Npx 0 #111 — **always pair with
`border-[1.5px] border-ink`**), `shadow-grey-4|5|7` (#bdbdbd, for black cards
on paper), `shadow-dark-4` (#2b2b2b, cards on dark sections), `shadow-soft-3`
(soft offset for primary ink buttons), `shadow-pin` (map pins).

Scale: buttons/inputs 3px · standard cards 4px (hover 6) · large cards 5px
(hover 7) · modals/hero 6px. Mobile: one step smaller; hover becomes
`active:translate-x-[2px] active:translate-y-[2px] active:shadow-offset-2`.

## Type recipes

- H1 hero: `font-display font-bold text-[38px] leading-[1.06] tracking-[-0.035em] md:text-[56px] lg:text-[64px] lg:leading-[1.04]`
- H2 section: `font-display font-bold text-[29px] md:text-[40px] tracking-[-0.025em]`
- Card H3: `font-display font-semibold text-[16.5px] tracking-[-0.01em]`
- Price: `font-display font-bold text-[21px]` (19px in dense grids)
- Eyebrow: `font-mono font-semibold text-[11px] uppercase tracking-[0.14em] text-ink mb-3`
- Mono meta/badges: `font-mono` 10–12.5px; spaced caps get `tracking-[0.05em]`+
- Outline-stroke phrase (ONE per hero/CTA): `text-stroke-ink` (2.2px),
  `text-stroke-ink-sm` (1.8px, mobile), `text-stroke-paper` (on dark)
- **Never** prose in mono; **never** data/labels in the sans; headings never
  positively letterspaced.

## Component recipes

- **Primary button**: `bg-ink text-white border-[1.5px] border-ink rounded-[10px] font-semibold shadow-soft-3 hover:bg-smoke-2 transition-all duration-120` — px-[22px] py-3 text-[14.5px] (hero: px-[26px] py-3.5 text-[15.5px])
- **Ghost button**: `bg-white text-ink border-[1.5px] border-ink rounded-[10px] shadow-offset-3 hover:bg-tint`
- **On dark**: inverse `bg-white text-coal hover:bg-hairline`; outline `border-[1.5px] border-coal-line text-white hover:border-white`
- Or use `@/components/ui/Button` (variants: primary/secondary/outline/ghost/inverse).
- **Card**: `bg-white border-[1.5px] border-ink rounded-[14px] shadow-offset-4 hover:shadow-offset-6 transition-shadow duration-120` (large: `rounded-2xl shadow-offset-5 hover:shadow-offset-7`)
- **Card on dark section**: `bg-coal-card border-[1.5px] border-coal-line rounded-[14px] shadow-dark-4`
- **Black card on paper** (featured pricing, equity): `bg-coal text-white border-2 border-ink rounded-2xl shadow-grey-7`
- **Input**: `border-[1.5px] border-line rounded-[9px] px-3.5 py-3 text-[14px] focus:border-ink focus:shadow-offset-3` (or `@/components/ui/Input`)
- **Toggle pill** (filters/tabs): `font-mono text-[11px] font-semibold tracking-[0.06em] border-[1.5px] border-ink rounded-pill px-3.5 py-2` — active `bg-ink text-white`, inactive `bg-white text-ink hover:bg-tint`
- **Photo badge**: `font-mono text-[10.5px] font-semibold bg-body text-white px-2.5 py-1 rounded-pill` top-left; NEW = white + ink border top-right
- **Metric chip** (ARV/CAP): `font-mono text-[11px] font-bold text-ink bg-tint px-2 py-0.5 rounded-pill`
- **Verified row**: `font-mono text-[10.5px] font-semibold text-ink` → `✓ VERIFIED SELLER`
- **Photo placeholders**: `bg-stripes` (never plain grey, never colored)
- **Eyebrow pill**: eyebrow classes + `bg-tint border-[1.5px] border-ink rounded-pill px-3 py-1.5 inline-flex items-center gap-2` with 7px ink dot

## Sections & layout

- Marketing sections: `px-5 py-14 md:px-8 lg:px-12 lg:py-[88px]`; alternate
  `bg-white` / `bg-tint-2` / dark `bg-coal` (or `bg-body`); separate major
  sections with `border-b-[1.5px] border-ink` on marketing pages.
- Dark CTA band: coal bg, white H2 (48px desktop) with one `text-stroke-paper`
  phrase, inverse + outline buttons, mono microcopy in `text-muted`.
- Header: white, `border-b-[1.5px] border-ink`, 68px (60px mobile).
- Footer: white, `border-t-[1.5px] border-ink`, mono column headers
  (`font-mono text-[11px] tracking-[0.12em] text-muted`).

## Motion rules

Only: hover lift (shadow grows), bg shifts (#fff→#f2f2f2, #111→#444),
`animate-pin-pulse`, `animate-pin-blink`, `animate-card-float`. Timing 120ms
ease. **No** entrance fades/slides, no scale bounces, no blurred shadows,
no color animation. Gate loops behind `motion-safe:`.

## Hard rules

1. No hue anywhere (no red/green/amber/blue) — including status, errors,
   charts. Errors: ink text + `font-semibold` + 1.5px ink border on the field.
2. Every elevated surface = 1.5px ink border + hard offset shadow. Never
   `shadow-lg`/blurred shadows.
3. Radii: controls 8–10px, cards 12–16px, pills 999px (`rounded-pill`).
   No `rounded-full` on rectangles-that-should-be-cards.
4. Data/labels/badges/prices-metadata = `font-mono`. Headings = `font-display`.
5. Keep ALL existing logic, props, handlers, data fetching, analytics and
   accessibility attributes intact — restyle JSX classes/markup only.
6. Preserve existing responsive breakpoints behavior (mobile-first, `md:`/`lg:`).
