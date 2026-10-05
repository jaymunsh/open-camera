# Studio effects / Film Collection — 2026-10-05

User-approved bounded extension; current checkout, existing camera/Studio identity.
No main merge, git push or production deployment. Panasonic/Lumix download files
are not included. This extension adds actual LUT data, not another sample set.

## Behavior

- Close/Escape/backdrop keep changes, as before.
- Cancel restores effects present at Studio entry: LUT/intensity/grain switch,
  base FX seed, strength mode/gentle/lens, variation settings/live pattern, and
  same-record per-frame reprocessing state. It closes Studio.
- Effect off remains in Studio and removes film, lens and additive variation.
  Original-film selection clears only the LUT.
- Templates, capture mode/ratio, beauty, manual adjustments, date, originals,
  saved photos and recipes are not globally reset. First-cut locks remain.
- Six new color-only HaldCLUTs join the existing shared filter/compare/export
  paths. Source and license are reachable in the collection; keyboard navigation
  includes the new credit link.

## Asset provenance

Author attribution and license: Pat David; CC BY-SA 4.0, as declared in
[the pinned upstream README](https://github.com/NatronGitHub/clut/blob/af7b50d4caf6244fb6895a647f5b6a84efe7931a/README.md).
Original file mappings and licensing links: `public/luts/film/CREDITS.md`.
These are approximations, not camera-manufacturer LUTs or measured color targets.

All six: 512×512, linear Hald layout (64³ samples). Source and packaged PNG IDAT
chunks were compared and are identical; only origin metadata was embedded, with
local filenames/display labels. None duplicates the prior 20 PNG file contents.

| Local file | Original SHA-256 | Packaged SHA-256 |
| --- | --- | --- |
| fuji160c.png | 0ee02d27116b61d37736c046c1270006d54e505777acf442350a886e7e164b38 | e486dd61ac209eb22a88554b6acb9b33bb6ef2f21c3235eb191b33293fbfb128 |
| superia400.png | cf3b9266d12fc79453babc33d05de399fd15e700f3ced3b532c0f86662b82bd4 | a4adae5f9af5168b357c900c7262f3685c138570a7cfe7ca9bedbdd710af0dcf |
| ultra100.png | e028bd17e9119bdb6eaf202b566a01b7456f0d7756a56187fa875b36f546a311 | 0a69f0678d2dd5697e0239161d682ac5ef0a74f9c6d3e0ca7da43a280e86ddf4 |
| elite200.png | 1c6d13de65c640c22ddf1c953899a7e43c63275c1a7a35bcb035205cb77afbfa | 009b0da985f1b018b1ae93899286f1731e8a6ae4e2583603db9d011e28d6f233 |
| instant690.png | dee45961789dfdbf5a97cb403e232f3c81eb93647834ed8d05b42c1f23c95a60 | 370189671d23675105a70205bae094aa2d345f3214e5fdaa5bbe5030e81afb79 |
| neopan1600.png | 2436f96f36e1108e6897aa34cc7074326fc9e69b0602918ec1fa4771ffc57a21 | 44f58726939031ff67ccfed4f5a7fc7b1f80a65a397c491dc15f053a0ac78f78 |

## Verification record

- Initial core cohort: 7 passed (1.4m). New film loaders produce six distinct
  non-identity results; NEOPAN renders grayscale; selection and comparison apply.
- Four viewport action/footer checks passed (24.3s). Initial collection captures
  occurred before smooth scrolling completed; capture setup was corrected to
  wait for the collection heading position and opaque thumbnail pixels.
- Same-LUT cancellation originally restored the seed ref without reapplying FX,
  leaving different light-leak pixels. Exported-byte regression reproduced RED;
  cancellation now triggers a new applied-FX revision even if the LUT ID matches.
- Adding a focusable source link revealed that the sheet focus trap excluded
  anchors. A real Tab-from-link regression reproduced RED; anchors now participate.
- The first RED cohort also exposed a malformed test range value (`.8`); the
  fixture was corrected to `0.8`, and missing cancel was reproduced separately.
- One attempted run stopped at a TypeScript nullable-record narrowing error;
  explicit non-null narrowing fixed it before the green cohort.
- Independent code review found that the explicit no-film action reset the grain
  mute setting through the normal filter-change hook. A whole-settings regression
  reproduced RED (`grainOff: true` became `false`); this action now preserves
  preset FX state, with a changed-ID guard so a no-op cannot leak into the next
  selection. The reviewer scored the fix resolved with no bounded regression.
- Final focused cohort: 13 passed (1.8m), including the no-film whole-settings
  regression. Fresh TypeScript check and diff whitespace check passed.
  Full sequential suite: 231 passed (14.8m), one worker, no failures. Final
  `npm run build` passed, with `/assets/index-okUT-stx.js` and 22 PWA precache
  entries. `git diff --check` passed after the final source changes.
- Public HTTPS preview checked in a fresh 390×844 Chromium context with synthetic
  camera input: exact latest bundle, FUJI 160C selection, cancel restoring that
  LUT, effect off, INSTANT 690 photo import/export to JPG, all six new PNGs served,
  secure context and no page errors. This is not physical iPhone evidence.
- One mechanical detector run on CreativeSettings returned `[]`.
- Provenance scan: all 6 newly sourced PNGs carry origin metadata; the 20 existing
  lookup PNGs lack it, predate this task and are intentionally unchanged.

## Review dispositions

- Independent code review: Ready subject to test gates; the sole Important
  finding (no-film grain-mute reset) was resolved. No Critical or Minor findings.
- Visual finish review: `disposition: ship`, all eight named viewport captures
  accepted; no material fixes. Generic fresh read-only roles substituted for the
  skill-specific roles unavailable in this harness.
- Declined code-review scope was ruled explicitly: pre-existing capture-mode
  discard confirmation remains outside these effect actions; per-frame snapshot
  restoration is retained because Studio only edits per-frame variation here,
  with no demonstrated unrelated rollback; unrelated dirty QA artifacts remain
  untouched; full-suite execution and deployment remain the parent agent's gates.
- Missing pre-existing PRODUCT.md/DESIGN.md is reported as documentation drift,
  not repaired as a side effect of this extension. No new world, comp or seed
  was required for the approved incumbent-system extension.
- Post-extension documenter: No changes; inspected the five new style rules,
  incumbent palette/type/layout tokens and both components. New actions inherit
  existing 44px controls, and the footer pins around the independent scroll body;
  no global system change was canonized.

## Runtime cleanup

Verified exact command lines and working directories, then sent SIGTERM to 12
old project-owned processes: 3 preview/diagnostic servers and the old preview
server at 5188, plus 8 associated tunnels. Ports 5188/5195/5196/5197 no longer
listened after shutdown. Unrelated Python docs and another project's Vite server
were preserved. Test-owned servers are temporary and terminate with Playwright.
After the full suite, ports 5185/5186/5188/5195/5196/5197 were all confirmed closed.
Only the final requested preview pair remains: Vite preview PID 83770 on 127.0.0.1
port 5188 and cloudflared PID 83803. Current temporary URL:
https://electricity-discrimination-millions-dave.trycloudflare.com/
Preview sessions: 48487 / 12243. Other old links no longer work.

## Boundaries

Chromium uses explicitly synthetic camera input. Physical iPhone Safari/PWA
memory, restored front-wide field of view, color aesthetics on real subjects and
an installed-old-service-worker upgrade still require device evidence. New LUTs
are not guaranteed to match Lumix or the original film stocks. No camera startup,
resumption or framing logic changed here.
