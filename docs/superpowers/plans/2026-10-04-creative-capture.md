# Creative Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved creative shooting features without changing default camera output.
**Architecture:** Optional rendering controls remain separate from preset definitions. A capture controller owns immutable frames, compositing, local capture bundles and reprocessing; App wires the existing camera and settings into it. New screens inherit the existing black camera interface.
**Tech Stack:** React 19, TypeScript, Canvas2D/WebGL2, IndexedDB, existing Playwright tests; no new dependencies.
**Spec:** `docs/superpowers/specs/2026-10-02-creative-capture-design.md`

## Global Constraints

- Default normal capture, existing LUTs, amber date, iOS header and centered preview remain unchanged.
- Recent history: 10 result bundles, all Blob bytes at most 50 MiB, separate `oc-captures` database.
- Original retention defaults off; originals are processed camera frames, not RAW.
- Composite output long edge at most 2048px, no upscaling; half-frame uses two 3:4 frames.
- Four-shot booth uses 3-second gaps, pauses when hidden, offers 2×2/strip and white/black margins.
- Double exposure uses average/lighten/multiply, default average at 50%.
- Recipes are local only, at most 20, validate all settings before applying; never mutate LUT storage.
- Red date is #C94F43 at 60% of existing size; old amber renderer remains the default.
- No skin protection, cloud, QR sharing, new fonts, app redesign, automatic deployment.

## Review Focus

- Quota failure must not delete existing photos or prevent sharing (Task 1).
- Mutable video/pipeline frames must not change an already captured layer (Task 2).
- Hidden/background timer must not take delayed burst photos on return (Task 3).
- Recipe load must never partially apply a missing LUT (Task 4).
- Reprocessing/date/preview must not mutate the original capture or clip red text (Tasks 2/5).

### Task 1: Capture persistence

**Files:** Create `src/capture/store.ts`, `src/capture/types.ts`; test `tests/creative.spec.ts`.
**Interfaces:** `CaptureRecord {id, createdAt, blob, name, width, height, mode, originals, settings, composition}`; `saveCapture(record): Promise<void>`, `listCaptures(): Promise<CaptureRecord[]>`, `deleteCapture(id): Promise<void>`.
- [x] Write browser tests of persistent ordering, bounded retention, deletion and failed transaction preservation; run `npm test -- tests/creative.spec.ts` and observe missing behavior.
- [x] Implement a separate version-1 IndexedDB, atomic add/eviction and byte counting including originals.
- [x] Run that test file; expected PASS. Commit the module and tests (integrated feature commit).

### Task 2: Frozen render frames and compositing

**Files:** Create `src/capture/composite.ts`; modify `src/engine/pipeline.ts`, `src/engine/datestamp.ts`; test `tests/creative.spec.ts`.
**Interfaces:** `snapshotFrame(source, ratio, mirror, maxEdge?): HTMLCanvasElement`; `composeFrames(frames, mode, options): HTMLCanvasElement`; `renderFilteredCanvas(...existing export arguments): Promise<HTMLCanvasElement>` returns an owned copy; existing `exportFiltered` continues to return JPEG. `drawDateStamp(canvas, options): Promise<void>` supports optional red style and fixed date time.
- [x] Write pixel tests of half left/right, literal blend endpoints, booth layout, source immutability and red text bounds; run to observe absent exports/behavior.
- [x] Implement bounded compositing and shared red-date placement. Keep existing export defaults unchanged.
- [x] Run creative and stability tests; expected PASS. Commit (integrated feature commit).

### Task 3: Shooting modes and recent review

**Files:** Create `src/capture/useCreativeCapture.ts`, `src/components/CaptureWorkspace.tsx`, `src/components/PhotoHistory.tsx`; modify `src/App.tsx`, `src/styles.css`; test `tests/creative.spec.ts`.
**Interfaces:** Hook consumes `captureFrame(): Promise<CapturedFrame>`, current settings and `cameraActive`; owns mode, frozen layers, pending review, history and reprocess source. Workspace consumes the hook and emits retake/cancel/save actions. History consumes `CaptureRecord[]` and delete/share/reprocess callbacks.
- [x] Write UI tests of normal history, half/double second shot, booth sequence/cancel/hidden pause, original retention and reprocessing; observe missing controls in RED run.
- [x] Implement optional modes, guide overlay only inside image rect, locks and cleanup. Stop camera/analysis during review. Add local history with session fallback and independent sharing/storage errors.
- [x] Run creative and existing framing/header tests; expected PASS. Commit (integrated feature commit).

### Task 4: Local recipes

**Files:** Create `src/capture/recipes.ts`, `src/components/RecipeSheet.tsx`; modify `src/App.tsx`; test `tests/creative.spec.ts`.
**Interfaces:** `CameraSettings` includes filter, strength, params, beauty, dates, general ratio, grain and new look/lens settings. `readRecipes(): Recipe[]`, `writeRecipes(recipes): void`, `validateSettings(value): CameraSettings`; App loads required LUT before committing settings.
- [x] Write save/reload/apply and missing LUT tests; observe missing recipe behavior. Corrupt-storage overwrite also has a RED→GREEN regression.
- [x] Implement versioned local JSON, max 20, atomic validation/application, mode/ratio lock preservation.
- [x] Run creative/stability tests; expected PASS. Commit (integrated feature commit).

### Task 5: Optional look, lenses and red date UI

**Files:** Create `src/engine/look.ts`, `src/components/CreativeSettings.tsx`; modify pipeline/shaders/types, App and styles; test `tests/creative.spec.ts`.
**Interfaces:** `RenderLook {lens, lensAmount, gentle}`; `deriveFx(fx, strength, strengthMode, gentle): FxSpec | null` never mutates input; render/export share these optional settings.
- [x] Write 0%-whole-look, unchanged defaults, gentle effect scaling, star highlight response, prism center preservation and red export tests; observe missing behavior.
- [x] Add opt-in shader uniforms with zero/default branches, no preset modifications; settings live in a separate menu sheet. Wire settings into recipes and frozen captures.
- [x] Run full `npm test`, `npm run typecheck`, `npm run build`; expected all PASS. Commit (integrated feature commit).

### Task 6: Integration review

**Files:** Tests above plus any files implicated by independently found bugs.
- [x] Capture real built mobile/desktop screens of settings, history and completed composite; inspect in one batch without redesigning the incumbent UI. One confirmation round corrected capture timing only.
- [ ] Run fresh whole-branch review, fix important findings with reproducing tests, and rerun full suite/build.
- [ ] Record what is verified versus requiring physical iOS testing. Hand off completed local implementation without claiming deployment.

## Verification record

- Baseline: existing 33/33 Playwright tests passed before source edits.
- RED: nine new tests failed for missing modules/controls; initial implementation made all nine pass.
- Expanded integration: 48/48 tests passed.
- Five additional RED→GREEN regressions cover preserving a paused booth, visible composition failures, pending-original deletion, canceled-share duplication and corrupt recipe protection.
- Full integration: 54/54 passed (2.7m); typecheck and production build passed.
- New UI follows the existing black camera surface and token colors; Impeccable detector returned no findings for new components/styles. No layout redesign or preset changes.
- Physical iPhone/iOS camera, Safari share behavior and real-device lens performance remain release checks. Browser tests use Chromium's fake camera / SwiftShader, not a physical device.
- Composite reprocessing deliberately does not apply beauty/face analysis; the editor labels this. Original retention is cropped camera JPEG data, not RAW.
- Implementation stayed in the existing checkout on `feat/creative-capture`; no extra worktree, push or deployment.
