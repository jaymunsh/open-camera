# Reusable Film Variation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method remains the user's choice; do not dispatch agents during planning.

**Goal:** 선택적으로 켜는 빈티지 우연성에 컷별 패턴, 패턴 고정, 레시피 재사용과 원본 재현상을 제공한다.

**Architecture:** 기존 프리셋을 변경하지 않고 기본 룩 위에 순수 함수로 추가 효과를 계산한다. 사용자 설정과 실제 촬영 패턴을 분리하고, GPU·촬영·재현상이 같은 버전의 패턴을 사용한다. 설정이 없거나 꺼져 있으면 기존 경로를 그대로 사용한다.

**Tech Stack:** TypeScript, React 19, WebGL2, Canvas, localStorage, IndexedDB, Vite, Playwright. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-05-film-variation-design.md` — 사용자 2026-10-05 승인.

## Global Constraints

- 방식: `꺼짐 / 매 컷 새롭게 / 패턴 고정`. 초기값은 꺼짐.
- 네 조절값: `추가 입자 / 추가 빛샘 / 추가 먼지 / 색 편차`, 각각 0–100%.
- 처음 켤 때 제안값: 입자 20%, 빛샘 15%, 먼지 10%, 색 편차 15%.
- 추가량 상한: grain 0.35, leak 0.30, dust 0.12; 최종 효과 0–1.
- 색 편차: 노출 ±0.08 EV, 색온도 ±0.04, 틴트 ±0.02; 최종값은 `PARAM_DEFS` 범위.
- 스튜디오 → 효과. 새 필터나 촬영모드 없음. 영상/GIF/장노출/필름 시트는 이 계획에서 구현하지 않음.
- 레시피 버전 1/최대 20개/`oc-recipes` 유지. 새 설정 누락은 꺼짐. 새 로컬 설정 키는 `oc-film-variation`.
- 최근 결과 10개/Blob 합계 50 MiB 유지. 기존 IndexedDB/사용자 LUT/레시피 데이터를 초기화하지 않음.
- 실제 seed는 유한한 0 이상 1 미만. 촬영 성공 후에만 다음 패턴 준비. 저장 재시도는 재추첨하지 않음.
- 기존 필터·날짜·미용·렌즈·카메라 복귀·비율 정렬과 이전 미커밋 변경을 보존. 운영 push/Vercel 배포 없음.
- 서로 다른 원본·크롭·미용·JPEG·브라우저에서 최초 촬영본의 픽셀 단위 복원을 약속하지 않음.

## Review Focus

- 손상된 새 설정/읽기 금지/쓰기 한도: 원래 데이터를 지우지 않고 새 옵션만 꺼진 상태로 사용 가능해야 함. Task 3 storage 테스트.
- 잘못된 프레임 패턴 배열/미지원 알고리즘 버전: 사진 보관함은 열리고 재현상만 설명과 함께 거절해야 함. Task 4 metadata 테스트.
- 고정 패턴→기존 처리→고정 패턴 전환 및 GPU 컨텍스트 복원: 기존 입자 타일을 잃거나 새 패턴으로 바뀌면 안 됨. Task 2 renderer 테스트.
- 촬영 성공 이후 공유 취소/인코딩 실패/동시 저장: seed 소비와 결과 저장을 구분하고 서로 다른 사진이 섞이지 않아야 함. Task 4 lifecycle 테스트.
- 빠른 재추첨 중 늦게 완료된 미리보기: 마지막 선택만 화면/저장에 반영되고 네 컷 잠금은 우회되지 않아야 함. Task 5 race/lock 테스트.

---

## Execution preparation and file boundaries

- 실행 시작에 `using-git-worktrees` 절차로 작업 환경을 확인한다. 기존 dirty 작업을 임의로 stash/reset/전체 커밋하거나 다른 작업트리에서 버리지 않는다.
- 현재 기준은 HEAD `68b4858`과 사용자 작업트리의 이전 변경이다. 실행 직전 `git status --short`, `git diff --stat`, 기존 diff를 증거로 기록하고 baseline 타입 검사/테스트를 실행한다.
- 단계별 커밋은 새 파일과 이 기능의 분리 가능한 hunk만 대상으로 한다. 기존 수정 파일 전체를 `git add`하지 않는다. 분리 검증이 어려우면 해당 커밋을 보류하고 이유를 기록한다. `git add .`, reset/checkout 복구 금지.
- 새 모듈은 아래 Interfaces를 따른다. App 전체 리팩터링이나 기존 옵션의 저장 방식 변경은 하지 않는다.
- 테스트는 기존 `tests/vintage-texture.spec.ts`처럼 `page.goto('/')` 후 Vite의 `/src/...ts`를 `page.evaluate()` 안에서 동적 import한다. 추가 유닛 테스트 러너를 설치하지 않는다. 아래 assertion 예시는 해당 브라우저 반환값에 적용한다.
- 테스트 명령은 cwd에서 실행한다. 기존 Playwright 설정은 dev 5185/preview 5186 및 fake camera/SwiftShader를 사용한다. 기존 임시 HTTPS 프로세스를 종료하지 않는다.

## Task 1: 순수 설정 검증과 추가 룩 계산

**Files:** Create `src/engine/variation.ts`, `tests/film-variation.spec.ts`; Modify `src/engine/types.ts`, `src/capture/types.ts`.

**Interfaces:**

- `src/engine/types.ts`: export `FilmPattern = { version: 1; seed: number }`; `FxSpec.pattern?: FilmPattern`은 숫자 강도가 아닌 렌더 메타데이터.
- `src/engine/variation.ts`: export `VariationSettings = { version: 1; mode: 'off' | 'new' | 'fixed'; grain: number; leak: number; dust: number; color: number; fixedSeed: number }` 및 `DEFAULT_VARIATION`(off, .20/.15/.10/.15, fixedSeed .5).
- `validateVariation(input: unknown): VariationSettings`: undefined이면 기본값 복사; 다른 잘못된 값은 throw. 모든 수치는 finite/range 검증.
- `validatePattern(input: unknown): FilmPattern`: 버전/seed 검증, 새 객체 반환.
- `nextPattern(previous?: FilmPattern | null): FilmPattern`: 이전 seed와 다른 seed. 무작위 함수가 같은 값을 계속 반환해도 무한 루프 금지; 한 번 시도 후 32-bit 단위 순환 fallback.
- `resolveVariation(params: FilterParams, fx: FxSpec | null, settings: VariationSettings, pattern: FilmPattern | null, grainOff = false): { params: FilterParams; fx: FxSpec | null }`: off이면 입력 참조 그대로; on이면 복사·가산·clamp. `fx.seed`/`fx.pattern`을 현재 pattern으로 설정. on인데 pattern 없음은 throw.
- `patternNoise(seed: number, size = 256): Uint8Array`: 버전 1 고정 PRNG로 RGBA 타일 생성. PRNG는 Mulberry32, 초기 정수는 `floor(seed * 2**32)`. R/B는 기존처럼 3×3 평균, G는 원래 잡음, A=255. 색 편차는 같은 seeded PRNG의 별도 스트림으로 입자 타일 크기에 영향받지 않게 함.
- `CameraSettings.variation?: VariationSettings`, `CapturedFrame.pattern?: FilmPattern | null`, `CaptureRecord.framePatterns?: (FilmPattern | null)[]`. type-only import를 사용한다.

- [ ] **Step 1 — 실패 테스트 작성:** `film variation data` describe에 아래 assertion을 갖는 테스트를 작성한다. 공통 params는 `DEFAULT_PARAMS`, seed는 .25/.75.

```ts
// missing/off retain the legacy objects; resolving never mutates inputs
expect(off.params === params && off.fx === fx).toBe(true);
expect(inputAfter).toEqual(inputBefore);
// maximum added effects and grain-off priority
expect(max.fx).toMatchObject({ grain: .35, leak: .30, dust: .12, seed: .25 });
expect(muted.fx.grain).toBe(0); expect(muted.params.grain).toBe(params.grain);
// deterministic color bounds, clipping, and proportional direction at half strength
expect(same).toEqual(first); expect(other).not.toEqual(first);
expect(Math.abs(first.params.exposure - params.exposure)).toBeLessThanOrEqual(.08);
expect(Math.abs(first.params.temperature - params.temperature)).toBeLessThanOrEqual(.04);
expect(Math.abs(first.params.tint - params.tint)).toBeLessThanOrEqual(.02);
expect(Array.from(noiseAgain)).toEqual(Array.from(noise));
expect(noise.byteLength).toBe(256 * 256 * 4);
expect(next.seed).not.toBe(previous.seed);
```

검증 케이스는 NaN/Infinity/음수/1인 seed, 강도 범위 밖, 버전 2, 잘못된 mode, missing 설정. 최대값 clamp/모든 추가값 0/원본 필터 fx=null도 포함한다. Mulberry32 구현의 seed .25 첫 값은 테스트 fixture로 고정해 알고리즘 버전이 조용히 바뀌지 않게 한다.
- [ ] **Step 2 — RED 확인:** `npm test -- tests/film-variation.spec.ts -g 'film variation data'`; 신규 모듈/export 부재로 FAIL인지 확인한다.
- [ ] **Step 3 — 구현:** 위 순수 API와 선택적 타입만 추가한다. 기본 params/프리셋/LUT는 변경하지 않는다. 색 offset은 독립된 seed 스트림의 [-1,1] 값×상한×강도. 기존 프리셋 입자에 더하되 grainOff면 FX grain=0; 수동 params.grain은 그대로.
- [ ] **Step 4 — GREEN/회귀 확인:** 같은 테스트와 `npm run typecheck`; 새 테스트 PASS/타입 exit 0. `npm test -- tests/creative.spec.ts -g 'whole-look strength'`로 `deriveFx`가 pattern 객체를 강도와 곱하지 않는지도 추가 assertion으로 확인한다.
- [ ] **Step 5 — 커밋:** 새 순수 모듈/테스트와 분리된 타입 hunk만 검토 후 `feat: add versioned film variation settings and resolver`.

## Task 2: 고정 패턴의 GPU 재현과 기존 타일 보존

**Files:** Modify `src/engine/pipeline.ts`; Create `tests/film-variation-render.spec.ts`. 셰이더는 기존 seed/time/texture 입력으로 충족되지 않을 때만 최소 수정.

**Interfaces:** Consumes Task 1 `FxSpec.pattern`, `patternNoise`. Existing `setFx(fx: FxSpec | null)`, `render(params, lutAmount, opts)`, `renderFilteredCanvas(...)` signatures remain. New metadata travels in FX, not a new positional argument.

- [ ] **Step 1 — 실패 테스트 작성:** `film variation renderer` describe. 같은 단색/하이라이트 입력 320×240을 두 개의 독립 `FilterPipeline`으로 렌더해 아래를 확인한다.

```ts
expect(fixedAtTime0).toEqual(fixedAtTime100);
expect(secondPipelinePixels).toEqual(firstPipelinePixels);
expect(otherSeedPixels).not.toEqual(firstPipelinePixels);
expect(legacyAfterFixed).toEqual(legacyBeforeFixed);
expect(restoredFixedPixels).toEqual(firstPipelinePixels);
expect(concurrentRedPixel[0]).toBeGreaterThan(200);
expect(concurrentBluePixel[2]).toBeGreaterThan(200);
```

legacy 비교는 동일 렌더러/time에서 수행하며 기존 랜덤 타일을 사용한다. `WEBGL_lose_context`의 lose/restore 이벤트를 기다려 복원 후 source/LUT 재설정. JPEG degrade가 켜진 동시 출력으로 현재 owned canvas 복사가 유지되는지도 확인한다.
- [ ] **Step 2 — RED 확인:** `npm test -- tests/film-variation-render.spec.ts`; 독립 렌더러/복원/시간 비교가 실제 FAIL인지 기록한다.
- [ ] **Step 3 — 구현:** 렌더러별 legacy grain texture를 그대로 두고, 현재 pattern 하나의 GPU texture를 추가한다. pattern 변경 때 이전 texture 삭제, 같은 seed/version이면 재업로드 없음. `pattern`이 있는 경우만 결정적 타일을 바인딩하고 `u_time`을 seed-derived 고정값으로 설정한다. context restore 시 캐시 핸들을 무효화해 같은 seed로 재생성한다. allocation 실패는 throw해 호출부가 사용자에게 추가 효과를 끄도록 안내할 수 있게 한다.
- [ ] **Step 4 — GREEN/회귀 확인:** 위 테스트와 `npm test -- tests/vintage-texture.spec.ts tests/creative.spec.ts -g 'degradation|whole-look|film variation renderer'`; 모두 PASS. opt-out 경로 texture/time 처리에 변화가 없는지 diff 검토.
- [ ] **Step 5 — 커밋:** 분리된 렌더 변경/새 테스트만 `feat: reproduce fixed film patterns across renderers`.

## Task 3: 저장 설정·레시피·패턴 수명 관리

**Files:** Create `src/capture/variation.ts`, `src/capture/useFilmVariation.ts`, `tests/film-variation-storage.spec.ts`, `tests/fixtures/FilmVariationHarness.tsx`; Modify `src/capture/recipes.ts`.

**Interfaces:**

- `readVariation(): { settings: VariationSettings; warning: string | null; writable: boolean }`, `writeVariation(settings: VariationSettings): void` in `src/capture/variation.ts`; storage key `oc-film-variation`.
- `FilmVariationController` from `useFilmVariation()`: `settings`, `pattern: FilmPattern | null`, `warning: string | null`, `writable: boolean`; methods `update(settings: VariationSettings): void`, `apply(settings: VariationSettings, pattern?: FilmPattern | null): void`, `reroll(): void`, `freeze(): void`, `commitShot(pattern: FilmPattern | null): void`, `resetStored(): void`.
- `update` preserves preview seed while tuning. `apply` is for recipe/record restore; fixed uses fixedSeed, new starts fresh unless an explicit valid pattern is supplied for record restore. `reroll` turns off into new when explicitly invoked and updates fixedSeed in fixed mode. `freeze` stores current seed and switches to fixed. `commitShot` advances only new mode and only if its argument matches current seed/version. No storage write on mount.
- Corrupt/unreadable storage sets off/warning/writable=false without writing. Explicit `resetStored` requires UI confirmation before use and writes defaults; write failure retains session values and warning. Settings updates while writable=false remain session-only.
- `validateSettings` validates optional variation and clones it. Legacy recipe application returns variation off. Existing outer recipe version remains 1.

- [ ] **Step 1 — 실패 테스트 작성:** `film variation storage` describe, browser import helpers and recipes. Test missing/valid/fixed/legacy recipes, version 2/invalid values, stored corrupt JSON, blocked getItem, QuotaExceededError on setItem. Assert preservation:

```ts
expect(legacy.variation.mode).toBe('off');
expect(restored.variation).toEqual(saved.variation);
expect(corrupt.settings.mode).toBe('off'); expect(corrupt.writable).toBe(false);
expect(localStorage.getItem('oc-film-variation')).toBe(originalCorruptText);
expect(localStorage.getItem('oc-custom')).toBe(customLutBaseline);
expect(localStorage.getItem('oc-recipes')).toBe(recipeBaselineAfterRejectedWrite);
```

Hook lifecycle tests use the test-only Vite-imported `tests/fixtures/FilmVariationHarness.tsx`. Export `mountVariationHarness(container: HTMLElement): () => void` to mount React controls and a JSON state output; return root.unmount cleanup. Drive update/apply/reroll/freeze/commitShot through harness buttons. Assert repeated render/tuning/visibility retains the seed, wrong/null commit doesn't consume it, matching commit advances new but not fixed, and a new recipe doesn't retain a previous temporary seed. Do not expose test-only globals from App. Task 4 separately verifies real capture integration.
- [ ] **Step 2 — RED 확인:** `npm test -- tests/film-variation-storage.spec.ts`; missing helper and missing legacy normalization assertions FAIL.
- [ ] **Step 3 — 구현:** helpers/hook and optional recipe validation. Store base settings only, never color-offset-applied params. In new mode the session seed is not serialized as fixedSeed. Invalid recipe validation must finish before any App field changes.
- [ ] **Step 4 — GREEN/회귀 확인:** 위 테스트와 `npm test -- tests/creative.spec.ts -g 'recipe'`, `npm run typecheck`; 모두 PASS.
- [ ] **Step 5 — 커밋:** 새 파일 및 레시피의 feature hunk만 `feat: persist reusable film variation recipes`.

## Task 4: 모든 촬영과 원본 재현상의 패턴 연결

**Files:** Modify `src/App.tsx`, `src/capture/useCreativeCapture.ts`, `src/capture/reprocess.ts`; Extend `src/capture/variation.ts`; Create `tests/film-variation-capture.spec.ts`, `tests/film-variation-reprocess.spec.ts`.

**Interfaces:**

- `validateFramePatterns(record: CaptureRecord): (FilmPattern | null)[] | undefined` in capture/variation: legacy missing returns undefined; expected count normal/instant=1, half/double=2, booth=4. Validate versions, entries and originals length when originals are present.
- `makeFramePatterns(settings: VariationSettings, count: number, previous?: readonly (FilmPattern | null)[]): (FilmPattern | null)[]`: off→nulls, fixed→fixedSeed repeated, new→fresh distinct sequential seeds avoiding corresponding previous seeds.
- `ReprocessVariationOptions = { patterns: readonly (FilmPattern | null)[] }` in reprocess; add optional final options argument to `renderReprocessed(record, settings, lut, fx, stamp = true, signal?, variation?)` and `exportReprocessed(record, settings, lut, fx, variation?)`. Existing callers remain valid.
- `App.applied.fx` remains the **base preset FX**. A separate resolved preview value uses Task 1 resolver; do not pass already-resolved FX into a resolver again. Shared capture/reprocess code always receives base params/FX and actual pattern.

- [ ] **Step 1 — 실패 테스트 작성:** seed localStorage before App mount (fixedSeed .25, nonzero strengths) to test integration before UI exists. `film variation capture` covers normal/instant/half/double/booth manual/auto, reload, ratio/filter/camera switches and a single-frame retake.

```ts
expect(fixed.framePatterns.map(p => p.seed)).toEqual(Array(frameCount).fill(.25));
expect(new Set(fresh.framePatterns.map(p => p.seed)).size).toBe(frameCount);
expect(fresh.frameSettings.map(s => s.variation.mode)).toEqual(Array(frameCount).fill('new'));
expect(afterRetake.filter((_, i) => i !== target)).toEqual(beforeRetake.filter((_, i) => i !== target));
expect(legacyRecord.framePatterns).toBeUndefined();
```

위 frameSettings assertion은 합성 촬영에만 적용한다. 일반 촬영에서는 settings를 확인한다. `film variation lifecycle` asserts two new-mode completed shots differ even if share is canceled; toBlob failure consumes no seed (capture/render probes with recorded metadata on successful retry); settings/visibility changes do not advance fixed/new preview. `film variation reprocess` uses synthetic canvas originals to test frame-index preservation and same-source rerender equality, null entries, wrong array lengths/versions, abort signal and concurrent output isolation.
- [ ] **Step 2 — RED 확인:** `npm test -- tests/film-variation-capture.spec.ts tests/film-variation-reprocess.spec.ts`; absent framePatterns/reproducibility assertions FAIL. Fake-camera images may change across time: verify seeds/metadata or unchanged already-captured canvases, not live-image equality.
- [ ] **Step 3 — 구현:** wire hook into generalSettings/recipe application and resolved live, edit, studio preview props. Capture snapshots input/settings/pattern before await. After frame generation, commitShot; normal commit follows successful exportFiltered and precedes share result. Copy base settings plus actual pattern into record/frame metadata. Booth settings still freeze, but do not reuse first frame's resolved FX in new mode. Retake replaces only its slot. Off-mode records omit new metadata unless needed for mixed-mode frame alignment.
- [ ] **Step 4 — 재현상 구현:** validate metadata before loading originals, restore exact frame seeds, resolve each frame from common edit settings/base FX, and preserve legacy behavior when field missing. A null pattern slot represents that frame's additional option off, not an invalid non-null seed; explicit reroll/recipe replaces the whole working array according to the new mode. Editor owns its working framePatterns independently of the saved record; save creates new ID/settings/patterns/shotAt/composition and retains old record. Maintain abort/generation guard and owned-canvas copy before JPEG await. Missing originals are not synthesized.
- [ ] **Step 5 — GREEN/회귀 확인:** 위 두 테스트와 `npm test -- tests/creative.spec.ts tests/booth-workflow.spec.ts tests/studio-customization.spec.ts tests/vintage-texture.spec.ts`, `npm run typecheck`; 모두 PASS. Record restore must not silently reroll or apply variation twice. Recipe application in edit mode explicitly updates the working pattern array according to off/new/fixed.
- [ ] **Step 6 — 커밋:** feature hunks/새 테스트만 `feat: capture and restore per-frame film patterns`.

## Task 5: 스튜디오 설정·다른 현상 UI와 최종 검증

**Files:** Create `src/components/FilmVariationControls.tsx`, `tests/film-variation-ui.spec.ts`; Modify `src/components/CreativeSettings.tsx`, `src/components/RecipeSheet.tsx`, `src/components/PhotoHistory.tsx`, `src/App.tsx`, `src/styles.css`, `CHANGELOG.md`, `docs/architecture.md`.

**Interfaces:** `FilmVariationControls({ settings, locked, warning, writable, onChange, onReroll, onFreeze, onSaveRecipe, onReset })` uses Task 1 settings, callbacks returning void. `locked` includes active encode/booth lock. No embedded storage or pattern generation in component. App delegates camera actions to Task 3 hook, record editing actions to Task 4 working array and helpers.

- [ ] **Step 1 — 실패 테스트 작성:** `film variation UI` describe. Studio/effects missing section is RED. Use accessible names `빈티지 우연성`, `꺼짐`, `매 컷 새롭게`, `패턴 고정`, four slider labels, `다른 패턴`, `이 패턴 고정`, `레시피 저장`. Test mode selection, percentages, all-zero added strengths, existing grain-off, recipe apply after reload, corrupt storage/reset cancel, original missing message and booth lock.

```ts
await expect(dialog.getByRole('button', { name: '꺼짐', exact: true })).toHaveAttribute('aria-pressed', 'true');
await dialog.getByRole('button', { name: '매 컷 새롭게', exact: true }).click();
await expect(dialog.getByLabel('추가 입자', { exact: true })).toHaveValue('0.2');
expect(restoredRecord.framePatterns).toEqual(originalRecord.framePatterns);
expect(rerolledRecord.framePatterns).not.toEqual(originalRecord.framePatterns);
expect(unchangedOriginal.id).toBe(originalRecord.id);
await expect(lockedDialog.getByRole('button', { name: '다른 패턴', exact: true })).toBeDisabled();
```

`film variation races` rapidly rerolls/tunes while delayed preview work completes; latest selected patterns must match saved metadata. Trigger both new and fixed recipes while editing a half/booth record and assert array remains aligned. Reset cancel keeps corrupt storage untouched; rejected localStorage writes show warning without disabling capture. A missing-original detail explains why another development is unavailable.
- [ ] **Step 2 — RED 확인:** `npm test -- tests/film-variation-ui.spec.ts`; absent controls fail at intended accessible locator.
- [ ] **Step 3 — UI 구현:** invoke applicable typography/frontend skill for existing token/spacing conventions before UI edits. Reuse camera field/range/note/button styles and keyboard semantics. Show tuning only when enabled. Exact guidance: `선택한 필터 위에 질감을 더해요. 0%는 추가 효과만 끕니다.` New-mode seed stays stable while tuning; freezing uses current preview seed. Studio→recipe closes Studio first to avoid stacked modal focus traps. Corrupt setting reset requires confirmation. Reprocess reroll/freeze operates on all frame slots and explains that freeze uses the last frame pattern. Original-less history shows explanation, not an enabled action.
- [ ] **Step 4 — GREEN/시각 확인:** run UI test plus Task 1–4 tests. Capture real rendered screenshots at 430×932, 844×390, 1440×900; inspect slider labels, wrap, focus, locked state/error and date boundary. Compare fixed .25/.75/off on the same bundled sample and save exported outputs. Confirm visually distinct leaks/dust/color and pattern stability across refresh; do not use only metadata to claim visual success. Preserve legacy capture layout.
- [ ] **Step 5 — 회귀/문서:** document actual default ranges, extra-vs-preset strength and seed replay limitations in CHANGELOG/architecture. Execute `npm run typecheck`, `npm test -- --workers=2`, `npm run build`, `git diff --check`; require exit 0 and report fresh counts. New/old tests failing must be investigated, not weakened. Run final code review under requesting-code-review skill after the user has chosen execution method.
- [ ] **Step 6 — preview/handoff:** serve verified dist via existing preview workflow; inspect running ports/processes first. If a fresh public HTTPS origin is needed, use available cloudflared and test its actual production assets/history/save without claiming physical iPhone testing. Do not push or deploy. Save scenario/visual/test evidence in `.impeccable/review/film-variation-20261005-verification.md` and report unverified iPhone conditions explicitly.
- [ ] **Step 7 — 커밋:** only feature hunks/새 테스트/docs `feat: expose reusable film variation controls` after fresh verification; preserve all prior changes. If separating App/style hunks is unsafe, leave them uncommitted with an accurate diff handoff rather than committing someone else's work.

## Self-review and execution handoff

- Spec coverage: settings/additive bounds/opt-out → Task 1; deterministic render/performance/context restore → Task 2; recipe/storage/lifetime → Task 3; all modes/original reprocess/metadata → Task 4; controls/locks/errors/visual/export/regression → Task 5.
- Cross-task types: `FilmPattern` is engine-owned; `VariationSettings` is resolver-owned; base FX and resolved FX are distinct. All tasks use `framePatterns` (not alternative spellings), version 1, seed in [0,1).
- Review Focus has owning tests for storage corruption, metadata corruption, GPU switching/restore, capture/share failures, async UI races.
- This plan does not authorize other three subsystem implementations or production deploy. It produces independently usable feature 1 without GIF/video encoders.
- User reviews this plan and chooses execution method before implementation. Recommended: Native, because the five steps share tightly coupled render/capture metadata interfaces and can be developed sequentially in this session; task-by-task delegation is optional, not started automatically.
