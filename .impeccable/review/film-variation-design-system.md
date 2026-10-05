# Film variation: incumbent design-system extension

Recorded 2026-10-05. Scope: the approved opt-in film-variation fieldset in Studio → Effects. This is a comparison and preservation record for an ordinary extension, not a new global design system. The [surface direction](../surfaces/src-app-tsx.md) remains the visual authority; source CSS remains the token authority. No root `DESIGN.md` or `.impeccable/design.json` is created or replaced by this documentation pass.

## Overview

The camera remains an Operate surface: the photograph occupies the black shell, the shutter stays centered, and creative controls live in the incumbent protected Studio dialog. Film variation follows the existing lens controls and adds one fieldset titled “빈티지 우연성”. Existing Templates / Shooting / Effects navigation, camera geometry, filter strip, header controls, and capture affordances remain intact.

The extension reuses the existing fieldset, choices, range, action, note, warning, and dialog treatments. It adds no font, icon family, decorative motion, raster asset, or replacement visual world. The green camera frames in the evidence are Chromium fake-camera output, not shipping imagery or a palette addition.

## Colors

All values below are established in [src/styles.css](../../src/styles.css). Film variation references the incumbent custom properties rather than defining a second palette.

| Existing value | Role retained by the extension |
| --- | --- |
| Black (`#000`) | Camera shell and photograph surround |
| `--camera-panel` (`#18181a`) | Studio dialog background |
| `--camera-control` (`#29292d`) | Choice and action button background |
| Main text (`#f2f2f2`) | Labels, legend, and unselected button text |
| `--camera-muted` (`#b8b8c1`) | Explanatory notes and added percentage outputs |
| `--camera-accent` (`#8a7cff`) | Selected choice text/outline, native range accent, and inherited focus treatment |
| Warning text (`#ffc2ab`) | Existing recovery/status warning treatment |
| Backdrop (`rgba(0,0,0,.7)`) | Existing Studio modal separation from the camera |

Muted percentage and note text against the panel measures approximately 9.00:1 from the source sRGB values. Selected choice text against the control measures approximately 4.42:1. The latter is the pinned incumbent treatment also used by existing lens choices; the finish reviewer recorded it as an incumbent non-blocker for this extension, not as a new accessibility pass or an authorization to restyle the camera system.

## Typography

The extension inherits the existing system stack: `-apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', sans-serif`. It adds no font asset.

| Existing role | Observed source values and use |
| --- | --- |
| Field legend | 14px inherited from the fieldset, weight 600; the new legend uses this unchanged |
| Range labels | 13px; the four additional controls retain the existing range typography |
| Notes | 12px, line-height 1.6; existing explanatory text treatment |
| Buttons | 14px inherited from the global button rule |
| Warnings | 13px, line-height 1.6; existing recovery treatment |
| Dialog title / tabs | 18px, weight 650 / 14px; existing Studio hierarchy |

Range numerals retain `font-variant-numeric: tabular-nums`. The added output reserves at least `4ch` and aligns to the trailing edge. Label and percentage share a baseline with line-height 1.5, preserving legibility as values change from 0% through 100% without moving the range name.

## Layout

The incumbent dialog has a maximum width of 540px. Studio retains a fixed title/close row and fixed tabs above an independently scrollable body (`min-height: 0`, `overflow-y: auto`, `overscroll-behavior: contain`). Body padding remains `6px 18px max(18px, env(safe-area-inset-bottom))`. At widths of at least 768px, the dialog centers within a 24px viewport inset and uses `max-height: calc(100dvh - 48px)`.

The new fieldset retains the existing `24px 0 12px` margin and borderless layout. Range rows keep a 16px top margin and an 8px label/input gap. Choice/action rows retain an 8px gap and wrapping, with actions 16px below the preceding content. Buttons keep a minimum height of 44px; native range inputs retain a minimum height of 32px. No new breakpoint is introduced.

The four scoped CSS additions are limited to: a baseline-aligned label/output row with a 16px gap; muted, trailing-aligned tabular percentage output; unbroken mode-button labels; and `text-wrap: pretty` on explanatory notes. Existing layout primitives carry the remaining surface.

Inspected captures show no horizontal overflow at 430×932, 844×390, and 1440×900. The mobile and desktop captures show all four ranges and the three actions. The short landscape sequence demonstrates scrolling from the mode choices through the lower ranges to the action row while the title, tabs, and Close stay visible. Content clipped at a scroll boundary is reachable within the body.

## Elevation & Depth

The extension uses the existing opaque panel and darker controls over the modal backdrop. It adds no shadow, blur, elevated card, or entrance animation. Studio's selected tab retains its incumbent inset accent underline; film-variation choices use the existing selection outline.

## Shapes

Controls retain the global gently rounded button corners (10px radius) and padding (8px 14px). Studio retains its existing sheet corners (18px top corners on the narrow layout) and centered dialog corners (16px at the existing desktop breakpoint). The fieldset remains borderless, and the ranges retain browser-native geometry with the incumbent accent color.

## Components

The implementation is [FilmVariationControls.tsx](../../src/components/FilmVariationControls.tsx), inserted after existing effect controls by [CreativeSettings.tsx](../../src/components/CreativeSettings.tsx). It uses semantic `fieldset`/`legend`, pressed buttons, labeled native ranges, and percentage `output` elements.

- Modes are “꺼짐”, “매 컷 새롭게”, and “패턴 고정”. Off is the default; ranges and pattern actions appear when enabled. The visible copy explains that 0% disables only the additional effect.
- The four additive controls are grain, light leak, dust, and color deviation. Each has a 0–1 native range, a .01 step, an explicit accessible label, and percentage `aria-valuetext`. The captured initial values are 20%, 15%, 10%, and 15%.
- “다른 패턴”, “이 패턴 고정”, and “레시피 저장” reuse the existing action-row treatment. Recipe saving transitions to the existing recipe dialog instead of stacking dialogs.
- Mode notes explain preview-to-capture timing and fixed-pattern reuse. Editing notices use the existing note treatment to explain all-cut changes and last-cut freeze. The fieldset's native disabled state locks controls during applicable capture work; buttons retain the incumbent disabled opacity (.45).
- Storage warnings reuse the existing warning color and expose `role="status"`. When storage is not writable, the reset action confirms that only saved vintage settings will be reset while photos, recipes, and user LUTs remain. Its warning/error rendering was checked in source and behavioral tests; dedicated warning/error screenshots were not supplied or visually verified.

Keyboard behavior remains with [CameraDialog.tsx](../../src/components/CameraDialog.tsx): focus enters the dialog, Tab is contained, Escape closes when permitted, and focus returns to the prior control. Studio retains arrow/Home/End tab navigation. The existing `:focus-visible` rule specifies an accent outline (2px, 3px offset); pressed choices also retain the incumbent selection outline (1px, inward offset). No film-variation-specific focus override is added. Captures include a focused mode choice; full keyboard interaction is supported by incumbent dialog code rather than established by a still image alone.

## Do's and Don'ts

- Do keep this surface inside the existing Effects tab and reuse the established camera properties and form primitives.
- Do keep percentage outputs tabular and aligned, explanatory text readable, and lower controls reachable through the Studio body scroll.
- Do preserve off-by-default behavior and copy that distinguishes additive effects from existing filter texture.
- Don't turn this scoped preservation record into a global palette, type scale, or new visual identity.
- Don't infer physical-device quality, Safari behavior, or warning-state visual coverage from fake-camera Chromium captures.

### Checked evidence and review boundary

The documentation pass read the surface direction, component implementations, full stylesheet, dialog behavior, UI/visual test source, and [the verification record](film-variation-20261005-verification.md). It directly inspected all eight required viewport captures:

| Viewport | Inspected captures |
| --- | --- |
| 430×932 | [Controls](variation-mobile.png), [camera shell](variation-mobile-camera.png) |
| 844×390 | [Choices/top range](variation-landscape.png), [lower ranges](variation-landscape-ranges.png), [actions](variation-landscape-actions.png), [camera shell](variation-landscape-camera.png) |
| 1440×900 | [Controls](variation-desktop.png), [camera shell](variation-desktop-camera.png) |

Incumbent [mobile](camera-mobile.png), [desktop](camera-desktop.png), and [landscape](camera-landscape.png) camera captures were also inspected for shell comparison. They depict a different capture mode/state, so they support preservation of shell structure rather than a pixel-identical before/after claim.

The supplied finish evidence reports 8/8 film-variation UI/visual tests passed, one manual detector run with `[]`, and a fresh UI finish verdict of **ship** for the added surface. The verification record reports typecheck and production build exit 0. The final full regression suite was still running at this documentation pass; its final result belongs in the linked verification record. This documenter did not run tests, a server, or a browser session.

Physical iPhone/Safari/PWA behavior, front-camera hardware field of view, iOS recovery, performance, and physical-device aesthetic assessment remain unverified. Dedicated storage warning/error-state screenshots remain unverified. These limits are separate from the inspected desktop/mobile Chromium renders. No new shipping raster assets require provenance; the screenshots are review evidence, and the existing sample photograph used by the visual tests is an incumbent asset.
