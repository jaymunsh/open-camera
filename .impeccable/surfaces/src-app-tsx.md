---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/CreativeSettings.tsx","src/components/CaptureWorkspace.tsx","src/components/LutComparison.tsx","src/components/PreviewSourcePicker.tsx","src/components/StudioDisclosure.tsx","src/styles.css"]
---

# Camera Studio extension

Mode: Operate. Approved by the user on 2026-10-04.

## Direction contract

THESIS: Photograph first, choose a truthful frame. Studio makes existing creative
capture findable from the camera dock; it does not replace the camera shell.

OWN-WORLD: Incumbent black camera, #18181a sheets, #29292d controls, #8a7cff
selection, system Korean UI font. Geometry illustrations show real frame layouts.

STORY: Open Studio, choose a frame, choose auto/manual and aspect, shoot four
photos, then change only the frame or retake a selected photo before saving.

FIRST VIEWPORT: Header recent thumbnail immediately left of ratio. Dock Filter,
Studio, centered 68px shutter, Beauty, Adjust. Studio sheet pins title and three
tabs over a scrollable six-template chooser; result sheet keeps Save fixed.

FORM: Local extension of existing camera/dialog system; no world roll or seed
applies. Code-native frame geometry. Signature interaction: four frozen cuts
survive a live frame change. Retain incumbent motion, no decorative new entrance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

For this ordinary extension, documentation checks the incumbent system without
creating or rewriting missing global design files. The original Studio extension
added no raster assets; the approved concept extension below adds seven photos
with recorded provenance.

Preserve the incumbent black camera shell, purple selected state, filter controls,
camera geometry and centered shutter. Move the saved-photo thumbnail to the
header, immediately before the ratio control. Its old dock slot becomes Studio.
Extend the existing protected settings dialog with Templates / Shooting / Effects
tabs, not a new navigation shell. Template thumbnails are truthful frame geometry.

Six original booth templates: basic 2×2, classic vertical strip, bottom-whitespace
2×2, bottom-whitespace strip, horizontal four shots, perforated film strip.
Live composition, frame thumbnails and exported images share layout calculations.
Changing templates after capture preserves all four photos. Existing ordinary,
half-frame and double-exposure behavior and legacy saved compositions stay intact.
Auto/manual booth selection is visible in Studio; retain the existing quick controls.
Effects retain existing vintage, star and prism settings. No third-party branding.

2026-10-05 approved film-variation extension: Effects adds an opt-in fieldset
after the existing effects, with off / new-per-shot / fixed-pattern choices,
four additive ranges and reroll / freeze / recipe actions. Preserve the existing
camera-field, camera-range, choices, note and warning tokens. Changing numbers
must not jump the current pattern. Off is the default. The editor explicitly
explains all-cut changes and last-cut freeze; storage failures explain recovery.
Signature interaction: preview and saved output share a reproducible pattern,
while a new-per-shot pattern advances only after successful frame generation.
No design-world seed applies: this is an incumbent extension, not a redesign.

2026-10-05 approved concept comparison extension: preserve the black/purple
camera shell and its geometry. Filter sheet gets one compact source/compare row
and an inline seven-photo chooser; no extra permanent camera toolbar. A single
protected comparison dialog presents the same frozen original with A/B controls,
independent strengths, shared center zoom, and explicit apply. Thumbnails use the
selected neutral photograph; original masters load only when comparing. Studio
uses restrained disclosure rows for decoration, lens and film variation, keeping
auto/manual controls visible. Generated rasters carry provenance in
docs/sample-provenance.md. Signature: change the comparison photograph without
changing camera settings; apply changes only the selected LUT and strength.

Verify small portrait and short landscape layouts, keyboard tab/focus behavior,
template geometry and pixels, shot retention, paused automatic capture, legacy
output compatibility, full regression suite and build. Use the existing temporary
HTTPS preview only; no production push or deployment for this task.

2026-10-05 approved effects-cancellation / LUT extension: keep the same dialog,
tabs, scrollable body and black/purple tokens. Effects gets a fixed two-button
footer (effect off / cancel changes) and one original-film row in the incumbent
flat film list. Close preserves choices; cancel restores only the effects present
at entry, including random-pattern seeds and frame-indexed reprocessing state.
Template, ratio, beauty, manual adjustments, date and original-retention choices
remain untouched. The filter sheet adds six distinct sourced HaldCLUT color
profiles under Film Collection, with visible attribution access. Numerical lookup
PNGs are not decorative photography; retain their unchanged pixel data and embed
their source/license rather than generating replacement images. Existing 20 LUT
PNGs predate this extension and are not modified for metadata-only cleanup.
Verify effect actions remain visible while the body scrolls at 320×568, 390×844,
844×390 and 1280×800. Shut down old project preview/diagnostic servers and tunnels;
after verification, leave only the current requested HTTPS preview running.

2026-10-05 approved Studio refinement / settings inspection: keep the incumbent
black/violet Operate system and all existing settings behavior. Replace Studio's
selected-tab underline with a shared rounded segment track and selected fill.
Reduce preview/paragraph bulk; a visible current-effect summary precedes film
choices, with application/cancel guidance in optional help. Preserve the fixed
effect actions, all mode/ratio/auto-manual controls and existing disclosures.
Settings inspection is opt-in: menu toggle off by default, a translucent compact
window over the camera, and a protected read-only sheet. All values come from live
app state, not duplicated preferences. Group camera/frame/film/texture/manual
adjustment/beauty/date-storage values; defaults are revealable and inactive stored
settings are identified. Navigate to existing editors by closing inspection first.
On tight viewports the summary folds, and composition placement reserves its
occupied area only while enabled. No camera crop, capture pixels, LUT values,
recipe scope or export behavior changes. Verify four viewport sets, storage denial,
focus return, no overlay collision and the full suite. No new visual world, seed,
comp or raster assets apply to this approved local extension.

2026-10-05 approved signature-film-quality extension: preserve this Operate
world and camera composition. Add one collapsed Film Texture section in Effects,
not a new camera toolbar. Existing/new processing is explicit; two primary
ranges and three size presets precede optional detailed controls. A frozen-photo
texture comparison uses the protected CameraDialog and makes its exclusions
clear, with no Apply action. Fixed effect off/cancel footer stays reachable.
Settings inspection reads versioned snapshots and distinguishes stored inactive
values from effective amounts. First-cut locks apply to every writer. Signature:
switch texture on/off on the same photo without changing LUT, date or beauty.
No visual-world seed, comp or new raster assets apply; four viewport verification
and fresh finish review/documentation remain required.

2026-10-05 signature-film-quality implementation evidence:

- `src/styles.css` retains black, panel `#18181a`, control `#29292d`, muted
  `#b8b8c1`, accent `#8a7cff` and the incumbent Korean system-font stack. Shared
  pressed dialog text now uses `--camera-selected-ink: #a69cff`; the accent still
  supplies outlines, range controls and primary fills. This is a legibility
  refinement within the incumbent violet palette.
- The new controls reuse 14px field legends, 13px range labels, 12px notes,
  tabular numeric outputs, wrapping 8px-gap choices and 44px interaction heights.
  Film Texture starts collapsed; existing/new processing, three size presets,
  grain/glow ranges and optional detailed ranges use the established field and
  disclosure components (`FilmQualityControls.tsx`, `CreativeSettings.tsx`).
- `FilmTextureComparison.tsx` reuses `CameraDialog`, its focus trap, Escape and
  focus return, plus the comparison scroll body. Texture canvases use contained
  image sizing with a block wrapper; before/after/paired and 1×/2× are view-only.
  The dialog states the 1024px limit and excluded effects and has no Apply action.
  The Studio effect off/cancel footer remains outside the scrollable body.
- `SettingsOverview.tsx` reads resolved grain/glow in its collapsed texture
  summary and labels legacy stored values as currently unused in the expanded
  rows. The supplied final finish review reports ship after the corrected four
  viewport sets (controls, overview, result and texture; 16 screenshots), with
  selected-text contrast 6.086:1 on the control surface and no visible fix
  regressions. This documentation pass inspected source, not a live browser.
- Verification limits remain explicit: at documentation review the suite was
  running; root subsequently verified 294 passed plus one additional metadata
  test, typecheck and build. Synthetic camera/sample images do not establish
  real photographic quality, and the six signature candidates remain unverified.
  Missing `PRODUCT.md` and `DESIGN.md` are incumbent documentation drift excluded
  from this ordinary extension; neither is created or canonized as a requirement
  to repair during this pass.
