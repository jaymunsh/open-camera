---
version: 1
slug: "src-components-capturepreview-tsx"
primary_target: "src/components/CapturePreview.tsx"
related_targets: ["src/App.tsx","src/styles.css"]
---

# Floating capture preview

Mode: Operate. Bounded refinement approved by the user on 2026-10-04.

## Direction contract

THESIS: The current shot owns the camera screen; a separate floating composition
shows progress without shrinking the photographer's framing view.

OWN-WORLD: Preserve incumbent black camera, dark panels, purple selection and
system Korean typography. Reuse numbered cells and real owned captured canvases.

STORY: Frame one shot, glance at the small composition, expand when useful, fold
it into a progress chip when it obstructs the scene, then review the finished photo.

FIRST VIEWPORT: Single-shot camera and grid stay centered at their original size.
Composition sits lower-right in a compact, nonmodal window. Its header contains
separate preview-size and fold buttons. Header, shutter and camera zoom stay usable.
On short landscape an opened floating preview may extend over the filter strip,
but stays between header and dock; folding restores that space.

FORM: Local extension, no concept seed or world replacement. Small/large/folded
are preview-only states, independent of camera zoom and automatic capture timers.
Keep a large countdown over the main camera even when the composition is folded.

FINISH: Verify centered framing, responsive bounds, keyboard focus, popup gesture
isolation, frozen cuts, auto/manual/retake and unchanged export geometry. One
batched visual pass, one confirmation if needed, detector once and fresh review.
Use the existing temporary HTTPS link; no push, merge or production deployment.

Normal and double-exposure flows, filter/LUT values, templates, recorded originals
and export composition stay unchanged. No new raster assets or global design files.

2026-10-04 approved refinement: let the main scene show through the miniature.
Use black background alpha .65 and only the photo canvas opacity .9; do not fade
labels or controls. Use light caption text and a darker local hover/focus backing
to preserve contrast against bright scenes. Saved composition pixels stay opaque.
Camera inspection lives in the existing menu as native progressive disclosure;
show only actual track values, without promising native-camera 0.5× equivalence.
