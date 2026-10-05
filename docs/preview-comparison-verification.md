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
- Final sequential gate: `npm test -- --reporter=line` → **218 passed (12.9m)**, exit 0. All seven implementation tasks are complete. The original 187-test checkpoint now has 31 additional tests; existing assertions remain intact apart from explicit disclosure/cache setup adaptations.
- Final correction run: `npx playwright test tests/preview-recovery.spec.ts tests/preview-layout.spec.ts tests/lut-comparison.spec.ts tests/concept-preview.spec.ts --reporter=line` → **16 passed (1.3m)**. Fresh `npm run typecheck` and `npm run build` passed after the correction.
- Four viewport sizes captured at `.impeccable/review/concept-{small,mobile,landscape,desktop}-{picker,comparison,studio,effects}.png`; the parent inspected all initial captures and the relevant corrected recaptures. Green/chart camera content is the explicitly synthetic Chromium camera feed, not an actual photograph or device capture.
- DOM-only Chromium text enlargement probe at 390×844 doubled each element's measured font size. Studio Templates / Shooting / Effects each retained zero horizontal overflow and a reachable full primary choice after scrolling. This supplements the comparison's automated 200% test; it does not establish native iOS Dynamic Type behavior.
- The first complete run reported 213 passed / 5 failed (15.1m). All five failures came from legacy setup assuming offscreen LUTs were loaded eagerly: two production-cache activations, two tests opening an uninitialized IndexedDB schema, and one initial-request assertion. Tests now explicitly choose AMATORKA or initialize the existing store before testing caching/network failure. Pixel signatures, version checks, failed-fetch recovery, HTTP rejection and offline export assertions remain intact. The subsequent final sequential run passed all 218 tests.
- Adapted cache/stability suite: **21 passed (54.2s)**. A two-worker full run was attempted for shorter waiting, but two legacy camera-readiness tests timed out; it was stopped and is not counted as passing. The configured one-worker run is the final gate; no product changes or retries were added to disguise parallel-run failures.

## Final review findings and corrections

The independent whole-branch code review of `b286f14..8978964` found no Critical issues and three Important issues. Each was reproduced before fixing in `preview-recovery.spec.ts`: changing samples during the initial master load left comparison disabled; replacement master loading/failure allowed the previous result to remain applicable; dynamically adding a favorite left its new canvas unobserved. Source preparation now owns loading/error state through the complete master request, with persistent retry and blocked application. The sheet refreshes observation for section changes and removes detached canvas references.

The replacement/retry regressions also exposed a render-lifetime failure during the correction run: an old result could be remounted after its canvas had been released. Comparison output is now matched to an explicit source/choice/strength/retry key before displaying it, so a new source cannot display or remount the previous output.

The independent visual review requested two short-landscape corrections: show a meaningful comparison photo on entry and expose a Studio choice before scrolling. Both failed dedicated layout assertions before correction. Short landscape now puts the comparison photograph beside controls and the Studio preview beside initial choices. The reviewer scored these corrections from same-path recaptures, without a new design hunt: **`disposition: ship`**, covering the two scored fixes only. Both 180px photos and both complete instant choices are visible on entry; full regression remains a separate gate.

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

## Execution decisions and their risks

- Reused the immediately preceding 187-test checkpoint baseline because the next commit changed only plan/spec documents. Risk: environmental drift; mitigated by the final fresh full run.
- Preserved generated native 1254px masters and derived 512px WebP using existing Chromium. Risk: browser color conversion; originals and exact prompts remain preserved.
- Named renderer tests `preview-comparison.spec.ts`, not the proposed `lut-comparison-render.spec.ts`. Risk: a stale plan command; actual commands/results are listed here.
- Counted extra camera calls relative to established StrictMode startup, not an absolute one. Risk: a startup change outside preview could be missed; the existing camera tests remain in the full suite.
- Accepted imported `TexImageSource` types and froze an owned canvas instead of requiring an already-canvas input. Risk: unsupported dimensions; source/import tests validate the actual paths.
- Kept sheet/history mounted but inactive and cloned comparison inputs. Risk: focus/resource lifetime regressions; modal, return-focus, source replacement and release tests cover them.
- Used fresh generic read-only agents for unavailable dedicated design roles. Risk: less role specialization; supplied the same evidence/contracts and recorded actual verdicts.
- Deferred real-device, real-photo and installed-SW update judgments because their evidence was unavailable. Risks: device-only bugs, unattractive real-photo results or stale installed assets; these are pending release checks, not verified claims.
- Kept new LUT licensing/selection, video and deployment outside stage1. Risk: the app still does not include a new commercial-grade LUT collection; existing IDs/content are unchanged.
- Same-ID custom replacement remains unsupported; UUID imports are retained. Risk: a future replacement editor must invalidate both rendered cache and loader cache before shipping.
- Legacy network/PWA setup now explicitly initializes the existing schema or selects the offscreen LUT. Risk: hiding a real loader failure; retained HTTP/signature/version/recovery/offline-export assertions still exercise the actual load.
- Parallel full-suite execution was attempted and then abandoned after readiness timeouts. Risk: concurrency instability; the existing one-worker configuration remains unchanged and is the final verification command.
