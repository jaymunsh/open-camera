---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/CreativeSettings.tsx","src/components/CaptureWorkspace.tsx","src/styles.css"]
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
creating or rewriting missing global design files. No new shipping raster assets.

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
