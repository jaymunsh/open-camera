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

## Final review findings and corrections

The independent whole-branch code review of `b286f14..8978964` found no Critical issues and three Important issues. Each was reproduced before fixing in `preview-recovery.spec.ts`: changing samples during the initial master load left comparison disabled; replacement master loading/failure allowed the previous result to remain applicable; dynamically adding a favorite left its new canvas unobserved. Source preparation now owns loading/error state through the complete master request, with persistent retry and blocked application. The sheet refreshes observation for section changes and removes detached canvas references.

The replacement/retry regressions also exposed a render-lifetime failure during the correction run: an old result could be remounted after its canvas had been released. Comparison output is now matched to an explicit source/choice/strength/retry key before displaying it, so a new source cannot display or remount the previous output.

The independent visual review requested two short-landscape corrections: show a meaningful comparison photo on entry and expose a Studio choice before scrolling. Both failed dedicated layout assertions before correction. Short landscape now puts the comparison photograph beside controls and the Studio preview beside initial choices. The reviewer scores these corrections from same-path recaptures, without a new design hunt.

The dedicated Impeccable agent roles were unavailable; fresh read-only agents received the finish-reviewer and documenter contracts instead. The documenter checked the actual shared tokens, components and all raster provenance; no system change was needed. Missing PRODUCT.md / DESIGN.md / design sidecar predate this extension and were not invented or repaired. The single mechanical detector pass returned `[]`.

Deferred Minor: current custom LUT imports create new UUIDs. Cache version partitioning is tested, but replacing a stored custom LUT under the same ID is not an existing supported UI workflow; a real same-ID replacement contract must also invalidate `loadCustomLut` before such a workflow is added.

## Intentional implementation decisions

- Import controller accepts the existing `TexImageSource` family (image/bitmap/canvas) and always creates an owned canonical copy.
- Development camera startup is measured before preview operations; preview must add zero camera calls. The existing React StrictMode startup behavior is not changed.
- Renderer tests are named `preview-comparison.spec.ts`; UI tests remain `lut-comparison.spec.ts`.
- Sheet/history stay mounted while hidden, with their focus listeners inactive, to retain scroll and selected records.
- PNG provenance metadata changes file bytes, not image pixels; versions are rebuilt from actual final bytes. WebP provenance uses JSON sidecars.

## Explicitly pending, not claimed as verified

- 21 real-world photographs for skin/food/highlights/night quality have not been supplied; actual photo quality validation is pending.
- Actual iPhone 15 Pro Max Safari / installed-PWA front-wide resume, native sharing and memory pressure need device confirmation. Chromium fake-camera results do not prove these.
- Production tests cover current-version precache, lazy masters and fresh-install offline access. A real previously installed service-worker update transition has not been exercised and remains pending before release.
- Comparing LUTs does not grant rights to distribute them. Panasonic/other new LUT pack selection, licensing and technical normalization belong to later stages.
- No original-retention default, stored recipe format, LUT IDs, camera framing or existing vintage FX parameters changed.
