# Studio / settings inspection — 2026-10-05

Approved local extension of the existing black/violet camera UI, not a redesign.
No production deployment, push, new camera behavior, LUT import, or raster assets.
The two Downloads/CLASSIC to STD cube files are not bundled or renamed here.

## Scope

- Filled rounded Studio segments replace the selected underline. Existing tabs,
  keyboard navigation and editor semantics remain. Preview height is reduced;
  current film/lens/pattern is visible, and long guidance is optional help.
- Menu toggle is opt-in and defaults off. A translucent foldable summary reads
  current app settings. Storage refusal retains session usability.
- Read-only inspection groups camera, composition, film, texture, manual, beauty,
  date and originals. Defaults are revealable; unsupported/inactive values are
  distinguished. Existing editors remain the sole places to change these values.
- Editor navigation closes inspection first; first-cut filter/adjust/beauty locks
  and unsupported composite reprocessing beauty are enforced at both link and
  handler. Existing captures are not discarded by inspection.
- Actual web zoom readback is used rather than a capability minimum. The camera
  hook, camera initialization, resumption, zoom and crop behavior are unchanged.
- Summary and composition reserve occupied space when enabled. Tight viewports
  use a direct dialog launcher. Automatic folding and Escape retain usable focus.

## Verification history

- Initial focused cohort reproduced missing summary/navigation and old tab style.
- Fixtures were corrected for duplicate menu/HUD labels and closed disclosure
  descendants. A real focus-return failure was fixed by recording the trigger
  before hiding it and restoring focus after dialog cleanup.
- Independent code review found a first-cut lock bypass, unsupported composite
  beauty navigation, capability-as-actual zoom reporting and compact focus loss.
  Added regressions reproduced RED before the corresponding fixes.
- Focused cohort: 12 passed (1.1m), including four viewports, real first-cut and
  stored composite cases, storage refusal, defaults, navigation, zoom and focus.
- First Studio captures caught the selected-tab CSS transition before settling;
  the capture fixture now disables animations and asserts the selected tab.
- One mechanical detector run on all changed UI targets returned `[]`.
- Independent code-review verdict scored all three reviewed findings resolved;
  unrelated dirty base and visual certification were explicitly excluded.
- Finish reviewer found expanded summary overlaying filters at 844×390. A real
  geometry assertion reproduced RED (bottom 261.5px vs strip top 208px). The
  usable bottom now includes the actual strip wrapper and observes its resize.
  Fresh 12-test cohort passed (1.1m); same 12 captures were regenerated, with
  selected-tab transitions disabled. The reviewer scored the sole placement fix
  resolved, `disposition: ship`; this verdict covers that fix, not a new hunt.
- Read-only post-extension documenter: No changes, compared current components
  and styles against incumbent code. No global design rules were invented.
  Dedicated finish/documenter roles were unavailable; fresh generic read-only
  agents applied their full reference contracts instead.
- Fresh TypeScript and diff whitespace checks passed after the final source fix.
- Existing public HTTPS preview checked in fresh synthetic-camera Chromium:
  `/assets/index-poGnpOPl.js`, default off, stored preference after reload,
  inspector-to-Studio navigation without stacked dialogs, original restored on
  cancel, compact short-landscape summary clear of filters, JPG capture download,
  secure context and zero page errors. No new server/tunnel or production deploy.
- The first full-suite run was intentionally interrupted after 26 passes for the
  reviewer's placement correction (one interrupted test, 216 unrun). This was not
  a passing full-suite result. The new complete sequential run finished with
  **243 passed (16.3m)**, one worker, exit 0, no failures.
- Final `npm run build` passed: 86 modules, same `/assets/index-poGnpOPl.js`,
  22 PWA precache entries. Final diff whitespace check passed. Test-owned ports
  5185/5186 and old diagnostic ports 5195/5196/5197 are closed. Only existing
  preview PID 83770 on 127.0.0.1:5188 and tunnel PID 83803 remain for this project.

## Evidence and boundaries

Screenshots under `.impeccable/review/`, each at small (320×568), mobile (390×844),
landscape (844×390), desktop (1280×800): `studio-refined-*`, `settings-summary-*`,
`settings-overview-*`. Camera input is explicitly synthetic Chromium video;
fallback preview is labeled example imagery. This is not physical iPhone proof.

Preserve the existing worktree and unrelated QA artifacts. Existing preview URL
is reused, with no additional long-lived server/tunnel. Missing pre-existing
PRODUCT.md/DESIGN.md is documentation drift, not repaired in this extension.
Full-suite, build, public preview and independent finish gates are recorded above.
No physical iPhone test or production deployment is implied by this document.
