# Film variation — 2026-10-05

Scope: approved feature 1 only, current checkout retained. No video/GIF/long-exposure/contact-sheet implementation and no production push/deploy. Existing Studio/date/vintage/camera work preserved.

## Functional evidence

- Engine settings/resolver: missing/off compatibility, additional bounds, grainOff priority, immutable base values, version/seed validation, fixed Mulberry32 fixture.
- GPU: deterministic independent renderers, time stability, seed changes, opt-out legacy tile retained, real context loss/restoration, single texture upload for repeated seed, concurrent JPEG export isolation. All 3 new renderer tests passed.
- Storage: legacy/new recipe validation, corruption/read denial/quota preservation and real React hook seed lifecycle. 2 new storage tests and 3 incumbent recipe regressions passed.
- Capture: fixed/new patterns on all five modes, booth auto/manual; failure does not consume, canceled sharing still advances successful new shots; retake affects one slot. A real retake history-order failure led to separating createdAt from shotAt, not weakening assertions.
- Reprocess: frame-index seeds/null slots/legacy/explicit override, bad metadata retains history, abort signal. Same-source repeat equality passed.
- Review corrections: three Important findings reproduced RED, then fixed: GPU allocation recovery without stopping the RAF loop; active per-frame strengths when the last slot is off; original-retention opt-out in redevelopment. All 7 review tests passed (37.3s), including actual mixed-history controls, Original-only comparison and half/booth new/fixed recipes under delayed bitmap work with exact latest composite-source pixel checks.
- UI: opt-in values, freeze/recipe/reload, one modal, corrupt reset cancel/accept, quota warning with successful capture, missing originals, booth lock, half-frame per-slot restoration/reroll/freeze and old-record preservation. 4 UI tests passed.
- 57 incumbent capture/booth/Studio/vintage regressions passed (4.6m). Final full suite after all review corrections: **187 passed (6.7m)**, exit 0; `npm test -- --workers=2`, log `.superpowers/sdd/2026-10-05-film-variation/final-post-review-suite.log`.
- Fresh typecheck: exit 0. Fresh production build: exit 0, assets index-tI_mTwYl.js / index-BAPUcX3F.css. Final diff whitespace check: exit 0.

## Rendered evidence

All images are actual renders, not reference comps. Camera screenshots use Chromium's fake camera; they do not establish iPhone hardware behavior.

- 430×932: variation-mobile.png, variation-mobile-camera.png.
- 844×390: variation-landscape.png, variation-landscape-ranges.png, variation-landscape-actions.png, variation-landscape-camera.png. Controls remain in the incumbent scrollable sheet; heading/tabs/close stay fixed.
- 1440×900: variation-desktop.png, variation-desktop-camera.png.
- Same bundled photo, additional strengths at 100% to expose differences: variation-sample-off.png / variation-sample-seed-025.png / variation-sample-seed-075.png. Repeated .25 export is exactly equal in the same renderer/browser. Viewed differences in grain, tint and light leak; initial 20/15/10/15% intentionally subtler.
- Computed label size ≥13px; existing tabular numeral ranges, inherited focus outline and muted/accent tokens retained; no horizontal overflow at the three widths.
- Manual detector ran once: [] (no findings). Fresh independent UI verdict: ship for the added surface. Code review: 0 Critical, 3 Important corrected via RED→GREEN; comparison availability and approved race coverage also addressed. No redundant code re-review. Dedicated impeccable reviewer/documenter roles unavailable; fresh-context default/worker substitutes supplied those two artifacts, not an author-only approval.

## Verified HTTPS preview

[Temporary preview](https://mortgage-chem-advances-priority.trycloudflare.com/) serves the exact final production asset hashes above. The standalone browser probe completed with exit 0: normal JPG, instant JPG, two-shot half-frame JPG, recent history with 3 records, half-frame redevelopment and a fourth saved record. All 4 retained matching fixed seeds, 60% added grain and their original counts; all output blobs were nonempty and no page errors occurred. The probe uses a fresh Chromium context with fake camera, not physical iPhone hardware. [Final HTTPS redevelopment screenshot](variation-https-camera.png) was inspected; it shows the existing edit shell and actual composite output.

The preview server and tunnel are left running. This is not a Vercel production deployment; the temporary origin has separate local settings and photo storage.

## Boundaries and rulings

- Initial baseline concurrency deleted trace artifacts: 140 passed/6 cleanup failures; all six rerun alone passed before product changes. Separate outputDir corrected it. Final suite runs alone as a test runner; no concurrent Playwright runner.
- Integration App/reprocess/useCreativeCapture and overlapping incumbent UI/style/docs changes remain uncommitted where attribution is unsafe; existing user work is not included in feature commits. A later push must include the preserved working integration, not just these partial module commits.
- Composite result creation time is separate from original shutter time to order regenerated results while retaining date stamps.
- Mixed records keep each active frame's variation strengths until an explicit global edit. Opting out of original retention makes the newly saved result non-redevelopable; the original record is untouched. Freezing when the last slot is off creates a new global pattern and explains this in the editor.
- Enabled settings without per-frame patterns follow the approved legacy/off boundary rather than inventing seeds for imported inconsistent records.
- UI review noted inherited accent text contrast approximately 4.42:1 on the control background. Deferred: a palette-wide accessibility correction is outside the pinned ordinary extension. The additional text labels/outputs retain the incumbent high-contrast treatment.
- Temporary HTTPS preview uses a distinct origin: its local photo/settings store is separate; existing-origin data is not erased.
- Not verified on a physical iPhone/Safari/PWA: front-camera hardware field of view, iOS recovery, performance, and physical-device aesthetic assessment. Existing camera implementation was not changed by this feature.
