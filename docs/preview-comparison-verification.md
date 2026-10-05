# Concept preview / LUT comparison verification

Date: 2026-10-05. Branch: `feat/creative-capture`. Current-folder implementation; no production push, deployment or new public tunnel.

## Scope delivered for stage 1

Seven generated photographic references; shared concept thumbnail selection; frozen scene/import/retained-original sources; independent A/B color-only comparison; original switching; common center 1×/2× zoom; explicit LUT/strength application; and Studio disclosures without changing product settings.

Generated source PNGs retain native 1254×1254 pixels, with provenance text metadata. Product WebPs are 512×512; prompts and exact source paths are in `sample-provenance.md` and asset sidecars. These are illustrative synthetic photographs, not measured color references. No new third-party LUT has been added.

## Automated evidence

- Sample inventory/dimensions, failed-load retry, storage denial/corruption and bounded master references: passed.
- Immutable canonical copy, one crop/mirror, 1024 bound, missing originals and invalid cut rejection: passed.
- 256-entry LRU, sample A→B→A, independent strengths, failed LUT recovery and cancellation: passed.
- Original / zero-strength pixel equivalence, distinct mono/warm, unchanged input, missing LUT / invalid strength / abort: passed.
- Single active modal, explicit apply versus cancel, focus return, grain switch and fixed pattern preservation, original preference preservation, history source and same-photo return: passed.
- Studio reorganization retained capture/reprocess assertions. The new closed-details focus regression was reproduced and fixed by excluding closed descendants from the focus loop.
- Full suite / final screenshots / independent reviews: in progress; final counts and verdicts recorded below after completion.

## Intentional implementation decisions

- Import controller accepts the existing `TexImageSource` family (image/bitmap/canvas) and always creates an owned canonical copy.
- Development camera startup is measured before preview operations; preview must add zero camera calls. The existing React StrictMode startup behavior is not changed.
- Renderer tests are named `preview-comparison.spec.ts`; UI tests remain `lut-comparison.spec.ts`.
- Sheet/history stay mounted while hidden, with their focus listeners inactive, to retain scroll and selected records.
- PNG provenance metadata changes file bytes, not image pixels; versions are rebuilt from actual final bytes. WebP provenance uses JSON sidecars.

## Explicitly pending, not claimed as verified

- 21 real-world photographs for skin/food/highlights/night quality have not been supplied; actual photo quality validation is pending.
- Actual iPhone 15 Pro Max Safari / installed-PWA front-wide resume, native sharing and memory pressure need device confirmation. Chromium fake-camera results do not prove these.
- Comparing LUTs does not grant rights to distribute them. Panasonic/other new LUT pack selection, licensing and technical normalization belong to later stages.
- No original-retention default, stored recipe format, LUT IDs, camera framing or existing vintage FX parameters changed.
