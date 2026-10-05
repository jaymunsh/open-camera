# Signature Film Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 사진·필터 결과를 보존하면서 선택형 필름 입자·광원 번짐, 대표 룩 후보, 동일 원본 질감 비교를 촬영과 재현상에 연결한다.

**Architecture:** 기존 fragment shader와 기본 program은 유지하고 새 모델용 program을 지연 생성한다. 버전이 있는 수치 스냅샷과 하나의 resolver로 live/export/reprocess를 연결하며, 카메라 시작·복귀·프레이밍은 변경하지 않는다. Studio는 기존 접힘 영역을 확장한다.

**Tech Stack:** React 19, TypeScript, Vite, WebGL2, Canvas, IndexedDB/localStorage, Playwright. 제품 의존성 추가 없음.

**Spec:** `docs/superpowers/specs/2026-10-05-signature-film-quality-design.md`

**Status:** 2026-10-05 Native 방식으로 Task 1–7 구현·단계별 검증과 최종 수정 완료. 최종 전체 294개 및 추가 손상 테스트 1개, typecheck/build 통과. UI 수정 재검토 완료; 실제 사진·iPhone 실기기는 미확인이다. [구현/검증 기록](../../signature-film-quality-verification.md)과 [결정 기록](../../signature-film-quality-decisions.md)을 기준으로 확인한다. 아래 체크리스트는 원 계획의 실행 계약을 보존한 것이며 완료 근거는 검증 기록과 커밋에 남긴다. 기존 뷰티 유지 의견에 따라 1B 추가 보정은 보류하며 2/3A/3B는 후속 상세 설계 대상이다.

## Global Constraints

- 영상은 제외하며 기존 필터와 촬영 흐름을 유지한다.
- 선택하지 않으면 기존 LUT·렌더 모델·기본값이 그대로 유지된다.
- 원본이나 결과 파일을 덮어쓰지 않는다.
- 기존 패턴 version 1의 PRNG와 salt는 바꾸지 않는다.
- 새 프로필 ID가 있는데 필요한 처리 스냅샷이 빠진 기록은 손상된 새 데이터로 구분한다.
- 비교 미리보기 긴 변 최대 1024. 기존 최근 촬영은 10개/50 MiB이며 이를 장기 앨범으로 바꾸지 않는다.
- 320×568, 390×844, 844×390, 1280×800을 한 번에 확인하고 결함을 묶어 수정한 뒤 한 번 재확인한다.
- 현재 폴더 사용이라는 사용자 선호를 유지한다. 임시 진단·스크린샷은 삭제하거나 blanket stage하지 않는다.
- 명시적으로 열거한 제품 파일·테스트·문서만 커밋한다. push·Vercel 배포·추가 장기 서버/터널 생성 없음.
- 실제 사진과 실기기 증거가 없으면 품질 검증 완료로 표시하지 않는다. 신규 원본은 권한이 확인된 입력만 사용한다.

## Review Focus

1. 새 후보를 색감 A/B에서 적용해도 질감·날짜·뷰티까지 자동 변경되지 않아야 한다: Task 4 테스트.
2. legacy→새 모델→legacy 전환 후 GPU uniform·texture 상태가 남지 않아야 한다: Task 3 테스트.
3. 패턴 off 상태의 새 입자도 저장·재현상에 동일한 seed가 남아야 한다: Task 4 테스트.
4. 손상된 새 촬영 설정은 기존 원본 시작 fallback으로 조용히 바뀌거나 기록을 삭제하면 안 된다: Task 1/4 테스트.
5. 미리보기 준비 중 모델 변경·닫기·context loss가 일어나도 옛 결과와 GPU 자원이 남지 않아야 한다: Task 3/6 테스트.

---

## 전체 범위의 실행 순서

| 단계 | 결과 | 설계/계획 상태 |
| --- | --- | --- |
| 1A | 새 입자·광원 번짐·대표 룩·저장 호환 | 승인된 설계, 이 문서에서 실행 계획 정의 |
| 1B | 피부색 보호·자연스러운 뷰티 조합 | 1A 결과 위에서 사진 편집/재현상 마스크 계약을 별도 설계 |
| 2 | 내 카메라·설정 백업·사진 일괄 처리 | 별도 schema/작업 큐/취소·실패 복구 설계 |
| 3A | 기존 사진으로 네컷·스트립·엽서 만들기 | 별도 칸별 크롭/작업 저장 설계 |
| 3B | 필름롤·컨택트 시트·백업 | 별도 보관함 수명/용량/마이그레이션 설계 |

전체 기능 방향은 사용자 요청에 포함한다. 아직 없는 후속 상세 설계/계획을 이 문서가 대신 승인하는 것은 아니다. 앞 단계 완료 시 같은 세션에서 다음 단계의 설계로 이어가며, 하위 프로젝트별 검토 지점을 유지한다.

## 파일 구조와 공통 계약

신규 파일은 `src/engine/filmQuality.ts`(검증·해결), `filmGrain.ts`(새 난수 타일), `filmShader.ts`(새 GLSL 구성), `signatureFilms.ts`(데이터 카탈로그), `src/capture/filmQuality.ts`(로컬 저장), `useFilmQuality.ts`(상태), `src/components/FilmQualityControls.tsx`, `FilmTextureComparison.tsx`, `src/preview/filmTextureCompare.ts`로 분리한다. 기존 App은 연결·잠금만 소유한다.

### 설정 및 resolver

`FilmQualitySettings`는 `{ version: 1; model: 'legacy' | 'film-v2'; origin: 'manual' | 'profile'; profile?: { id: string; version: 1 }; grain: number; size: number; color: number; shadows: number; glow: number; glowRadius: number; seed: number }`다. 6개 조절 값은 0~1, seed는 0 이상 1 미만이다. origin=profile이면 profile이 필수다. 카탈로그 ID/version 불일치는 오류다.

`DEFAULT_FILM_QUALITY`: legacy/manual, grain=.18, size=.35, color=.08, shadows=.45, glow=.06, glowRadius=.35, seed=.5. 이 값은 조절판의 시작값이며 기본 앱에서 활성 효과가 아니다. 새 model을 명시적으로 켜거나 프로필을 선택할 때만 활성화한다.

공통 공개 API:

- `validateFilmQuality(input: unknown): FilmQualitySettings | undefined` — undefined는 그대로 반환; 유효 입력은 알려진 필드만 복제.
- `assertFilmQualityForPreset(id: string, input: unknown): FilmQualitySettings | undefined` — 새 signature ID의 필드 부재는 오류; 기존 ID의 필드 부재는 정상.
- `resolveFilmQuality(settings: FilmQualitySettings | undefined, context: { params: FilterParams; fx: FxSpec | null; intensity: number; strengthMode: 'color' | 'whole'; grainOff: boolean; pattern: FilmPattern | null }): ResolvedFilmQuality | null`.
- `ResolvedFilmQuality`: `{ model: 'film-v2'; grain: number; size: number; color: number; shadows: number; glow: number; glowRadius: number; seed: number }`.
- model=legacy/undefined는 null. 새 grain은 `clamp((settings.grain * k) + params.grain + (fx?.grain ?? 0))`, glow는 `settings.glow * k`, k는 whole이면 intensity, color이면 1이다. fx는 이미 deriveFx/variation을 통과한 값이며 두 번 강도를 곱하지 않는다. grainOff이면 새 grain 전체를 0으로 한다. seed는 pattern?.seed가 있으면 그 값, 아니면 settings.seed다.
- `RenderLook`에 `filmQuality?: ResolvedFilmQuality | null` 추가. 기존 look 객체는 계속 유효하다. `FilterPipeline.render`/`renderFilteredCanvas`의 외부 signature는 유지한다.

### 수치와 평가 fixture

- 기준 세로 1080px. 입자 단위는 `1.5 + 6.5 * size` 기준 픽셀, 고운=.08/보통=.38/거친=.85. 컬러 입자는 평균 0의 독립 채널 잡음과 공통 명도 잡음을 혼합한다. 밝기 가중치는 `(1 - shadows) + shadows * (.25 + .75 * (1 - luminance))`.
- 새 타일은 256×256 RGBA, seed 기반 별도 PRNG stream. legacy `patternNoise()`와 `makeGrainTile()`은 수정하지 않는다. 공간 평균 bias는 채널당 8-bit 1.5 코드 이내를 테스트한다.
- glowRadius는 기준 1080px에서 `2 + 22 * glowRadius` px. 광원 mask는 `smoothstep(.72, .97, luminance)`; 3×3 샘플 가중치 center4/cardinal2/diagonal1을 16으로 나눈다. halo는 `max(blur(mask)-mask,0)`이고 국소 additive gain=.18, warm RGB weight=(1,.65,.35)다. 원본 RGB 블러를 결과에 mix하지 않는다. 물리적 필름 측정 모델이라고 부르지 않는다.
- seed=.25/.75, 512/1024/2048 크기의 중성 회색·암부/중간/명부 3분할·밝은 점·큰 흰 면 Canvas를 코드로 만든다. 실제 카메라 품질 증거가 아닌 수치 fixture다.
- 512px로 정규화한 grain RMS 상대 오차 ≤25%, correlation ≥.85, glow half-width 차이 ≤2px를 초기 기준으로 고정한다. 맞추지 못하면 모델을 수정하고, 근거 없이 통과하려고 오차를 늘리지 않는다.
- 실제 사진 비교는 원본/기존/새 룩/질감 off를 저장하고 입력 출처를 기록한다. 자동 수치 통과만으로 미적 품질이나 피부 보호를 인증하지 않는다.

## Task 1: 설정·저장·과거 데이터 계약

**Files:** Create `src/engine/filmQuality.ts`, `src/capture/filmQuality.ts`; Modify `src/capture/types.ts`, `src/capture/recipes.ts`; Test `tests/film-quality-settings.spec.ts`, `tests/film-quality-storage.spec.ts`.

**Interfaces:** 위 validation/resolver API. `CameraSettings.filmQuality?: FilmQualitySettings`. 저장 API는 `readFilmQuality(): { settings: FilmQualitySettings | undefined; warning: string | null; writable: boolean }`, `writeFilmQuality(settings: FilmQualitySettings | undefined): void`이며 key=`oc-film-quality-v1`이다. undefined 쓰기는 정상 legacy 상태로 직렬화하되 손상/접근 거절 상태를 자동 초기화하지 않는다.

- [ ] **Step 1: 실패 테스트 작성.** 기존 전체 CameraSettings를 fixture로 사용하고 아래를 검증한다. browser evaluate 안에서 실제 모듈을 동적 import하는 기존 Playwright 패턴을 따른다.

```ts
expect(legacy.filmQuality).toBeUndefined();
expect(roundTrip.filmQuality).toEqual(fixed);
expect(rejected).toBe(7); // unknown version/model/profile, NaN, Infinity, amount>1, seed=1
expect(corrupt.writable).toBe(false);
expect(corruptRaw).toBe('{broken');
expect(unrelatedRecipesAndLuts).toEqual(before);
```

- [ ] **Step 2: RED 확인.** `npm test -- tests/film-quality-settings.spec.ts tests/film-quality-storage.spec.ts --workers=1`; 실제 모듈/API 부재로 FAIL, fixture import 오류가 아니어야 한다.
- [ ] **Step 3: 위 계약 구현.** 순수 resolver와 읽기/쓰기만 추가하고 App·GPU는 바꾸지 않는다. 모델별 오류는 `FilmQualityError extends Error`로 구분해 나중에 기존 missing-LUT fallback과 분리한다. whole/color, grainOff, pattern seed 우선순위, 크기/버전/seed 비례 축소 금지를 표 기반 테스트한다.
- [ ] **Step 4: GREEN 확인.** 같은 명령과 `npm run typecheck`; 추가로 기존 `tests/film-variation-storage.spec.ts` 실행. 기존 레시피의 optional 필드 부재가 자동 보정으로 숨겨지지 않아야 한다.
- [ ] **Step 5: 커밋.** 해당 4개 제품 파일과 2개 테스트만 stage; `feat: add versioned opt-in film quality settings`.

## Task 2: 대표 룩 후보와 버전 카탈로그

**Files:** Create `src/engine/signatureFilms.ts`; Modify `src/engine/lut.ts`; Test `tests/signature-films.spec.ts`.

**Interfaces:** `SignatureFilmDefinition { id: string; version: 1; label: string; sourcePresetId: string; quality: Omit<FilmQualitySettings,'origin'|'profile'|'seed'> }`, `SIGNATURE_FILMS: readonly SignatureFilmDefinition[]`, `signatureFilm(id: string): SignatureFilmDefinition | undefined`, `createSignatureQuality(id: string, seed: number): FilmQualitySettings`. 카탈로그는 순수 데이터이며 lut.ts를 runtime import하지 않는다. `Preset`에 `sourcePresetId?: string`을 추가하고 기존 `loadPresetLut(id)`의 캐시·실패 재시도 경로에서 해석한다.

후보 ID/source는 설계서 대응을 유지한다. 라벨은 `인물 · SOFT NEG` / `카페 · WARM PRINT` / `풍경 · CLEAR CHROME` / `거리 · DEEP SNAP` / `야간 · NIGHT GLOW` / `흑백 · SILVER ROUGH`.

초기 grain/size/color/shadows/glow/glowRadius: portrait=(.12,.12,.03,.35,.03,.20), cafe=(.16,.22,.06,.40,.08,.30), landscape=(.06,.08,.02,.20,0,.20), street=(.28,.45,.04,.55,.03,.25), night=(.32,.50,.18,.75,.28,.70), mono=(.40,.80,0,.55,.02,.20). 실제 사진 평가로 조정할 때는 최초 공개 전에 정의와 테스트를 함께 갱신한다. 공개 후 같은 ID의 수치와 source를 덮어쓰지 않는다.

- [ ] **Step 1: 실패 테스트 작성.** 6 ID 유일성, source와 동일한 색 데이터 해시, unknown ID/seed 거부, 품질 snapshot 불변, 강도 0과 ORIGINAL 색 일치를 확인한다. 기존 PRESETS는 추가 외에 순서·정의가 바뀌지 않아야 한다.
- [ ] **Step 2: RED 확인.** `npm test -- tests/signature-films.spec.ts --workers=1`; 새 카탈로그/API 부재로 FAIL.
- [ ] **Step 3: 구현.** source 순환 참조를 거부한다. 후보는 일반 카탈로그에 아직 공개하지 않는다. lut.ts에서 `SIGNATURE_CANDIDATE_PRESETS: readonly Preset[]`와 `loadSignatureCandidate(id: string): Promise<LutData>`를 별도로 export한다. 후자는 후보의 source를 기존 loader로 읽는다. 일반 loader의 unknown ID fallback을 바꾸지 않는다.
- [ ] **Step 4: GREEN 확인.** 위 테스트와 `tests/film-collection.spec.ts`, `tests/provided-films.spec.ts`, typecheck. 원본 색 데이터 byte를 변경하지 않고 재사용한 데이터를 새 LUT라고 설명하지 않는다.
- [ ] **Step 5: 커밋.** 이 제품 2개 파일과 테스트만 stage; `feat: define versioned signature film candidates`.

## Task 3: 별도 program의 입자·광원 번짐과 기존 픽셀 보존

**Files:** Create `src/engine/filmGrain.ts`, `src/engine/filmShader.ts`; Modify `src/engine/look.ts`, `src/engine/pipeline.ts`; Test `tests/film-quality-render.spec.ts`, `tests/film-quality-resolution.spec.ts`, `tests/film-quality-legacy.spec.ts`, `tests/fixtures/legacy-film-pixels.json`.

**Interfaces:** `filmGrainTile(seed: number, size?: number): Uint8Array`, `createFilmFragmentShader(legacySource: string): string`. 기존 shader 소스는 유지한다. 새 shader는 선언과 새 입자·halo를 명시적인 anchor에 삽입하고 anchor 부재/중복은 throw한다. 새 모델에서는 기존 grain uniform을 0으로 두어 중복 가산을 막는다. program과 uniform locations를 모델별로 보관하며 legacy 복귀 시 원래 locations를 사용한다.

- [ ] **Step 1: 변경 전 픽셀 기준과 실패 테스트 작성.** 아직 shader를 바꾸지 않은 pipeline에서 320×240 gradient·colorchecker·밝은 점을 그린다. `fx.pattern={version:1,seed:.25}`, time=0, none/film-fuji160c/vintage-disposable/studio-mono와 실제 params를 고정해 byte hash·입력·설정을 fixture에 기록한다. legacy random tile은 constructor 동안만 테스트 측 고정 PRNG로 만들고 finally에서 복원한다. 새 입자의 RGB 동등/차이, 같은 seed의 시간 독립, 다른 seed 차이, legacy 복귀, off/0 일치, context 복귀를 검사한다.

```ts
expect(actualLegacyHashes).toEqual(baselineLegacyHashes);
expect(first).toBe(repeatAtTime100);
expect(first).not.toBe(otherSeed);
expect(grayChannelMaxDelta).toBe(0);
expect(colorChannelDelta).toBeGreaterThan(0);
expect(glError).toBe(0);
expect(programCountAfterLegacyOnly).toBe(programCountAtStart);
```

- [ ] **Step 2: RED 확인.** `npm test -- tests/film-quality-render.spec.ts tests/film-quality-resolution.spec.ts tests/film-quality-legacy.spec.ts --workers=1`. legacy 기준은 PASS, 새 모델 미적용으로 관련 검사는 FAIL해야 한다.
- [ ] **Step 3: 구현.** 공통 계약의 입자·halo를 새 shader/program에서 처리한다. 입자 타일은 seed별 재사용·mipmap을 적용하고 표시 크기 footprint로 LOD를 선택한다. UV는 크롭 후 사진 좌표 기준이며 미러링을 포함해 live/export 일치를 검사한다. halo는 국소 mask만 사용한다. 기존 halo/bloom은 유지한다. 유효 grain/glow가 모두 0이면 새 program을 만들지 않고 필요한 grain 억제만 기존 program에 전달한다. context restore에서 새 program/texture 상태를 무효화·재생성한다.
- [ ] **Step 4: GREEN 확인.** 같은 cohort와 `tests/film-variation-render.spec.ts`, `tests/vintage-texture.spec.ts`. 중성 회색은 전체 변화가 없어야 하고 밝은 점 주변은 변화가 있어야 한다. 흰 면 중심 RGB 편차와 먼 영역 변화는 8-bit 1코드 이내로 제한한다. 공통 해상도 허용값을 지키고 소유한 shader/texture를 교체·해제 시 삭제한다.
- [ ] **Step 5: 커밋.** 이 제품 4개 파일과 테스트/fixture만 stage; `feat: render opt-in film grain and localized highlight glow`.

## Task 4: 실시간·촬영·재현상·레시피의 동일 스냅샷

**Files:** Create `src/capture/useFilmQuality.ts`; Modify `src/App.tsx`, `src/capture/reprocess.ts`; Test `tests/film-quality-capture.spec.ts`, `tests/film-quality-reprocess.spec.ts`, `tests/film-quality-actions.spec.ts`.

**Interfaces:** `useFilmQuality(): { settings: FilmQualitySettings | undefined; warning: string | null; writable: boolean; update(s: FilmQualitySettings | undefined): void; resetStored(): void }`. 수치 변경만으로 seed를 바꾸지 않는다. update는 검증·상태·허용된 로컬 저장을 담당한다. 카탈로그 선택 시에만 profile 기본값 snapshot을 만든다.

- [ ] **Step 1: 실패 테스트 작성.** 기존 실제 preset과 저장된 manual 품질 설정으로 앱을 시작한다. 정상 촬영·booth4·half·double·instant의 컷별 설정을 확인한다. 설정 변경은 기존 레시피 UI를 이용해 아직 없는 새 controls에 의존하지 않는다. 후보 선택의 실제 UI 연결은 Task 7에서 검사한다. variation=off, seed=.25를 보관하고 같은 lossless fixture 원본의 직접 render와 재현상 픽셀을 비교한다. 다운로드 JPEG hash로 GPU 결과 일치를 대신하지 않는다.

```ts
expect(record.settings.filmQuality.seed).toBe(.25);
expect(reprocessedPixels).toEqual(directPixels);
expect(afterCancelQuality).toEqual(entryQuality);
expect(afterCancelFrameSettings).toEqual(entryFrameSettings);
expect(colorComparisonAppliedQuality).toEqual(beforeColorComparison);
expect(savedHistoryAfterBadMetadata).toEqual(savedHistoryBefore);
```

- [ ] **Step 2: RED 확인.** `npm test -- tests/film-quality-capture.spec.ts tests/film-quality-reprocess.spec.ts tests/film-quality-actions.spec.ts --workers=1`; 스냅샷 부재/미연결 경로로 FAIL.
- [ ] **Step 3: 구현.** generalSettings, live refs, captureFrameRef, 일반·불러온 사진 저장, 재현상, applyCameraSettings, Studio 진입/취소/해제를 resolver로 연결한다. variation=off라도 저장 값에 effective seed를 남긴다. live look ref는 최신 resolved quality를 포함한다. 프로필 선택 시 LUT 준비와 quality snapshot을 함께 renderReady로 판단한다.
  - origin=profile은 해당 프로필 선택/복귀 때 기본값을 사용하고 manual quality는 필터 변경에도 유지한다. ‘원본’은 profile quality만 해제, manual quality는 유지한다. ‘효과 해제’는 둘 다 해제한다.
  - 색감 A/B 적용은 기존 질감을 유지한다. 새 signature ID를 color-only 적용하면서 기존 field가 없었다면 명시적 legacy/manual snapshot을 넣어 손상된 기록과 구분한다.
  - origin=profile의 저장 설정을 복원할 때만 해당 새 LUT도 초기 로드한다. 기존 필터의 startup default는 바꾸지 않는다. manual quality 복귀는 LUT를 바꾸지 않는다.
  - FilmQualityError는 기존 missing-custom-LUT fallback과 구분한다. 사진 기록·원본·현재 설정을 바꾸지 않고 재현상을 중단한다. 명시적으로 원본에서 편집 시작하는 기존 기능은 유지한다.
  - 합성 재현상에는 현재 선택한 새 quality를 모든 컷에 적용하되 seed는 컷별 framePattern 또는 보관 quality에서 해석한다. 종이·문구·날짜는 뒤에 합성한다. 기존 합성 재현상의 뷰티 미지원은 유지한다.
- [ ] **Step 4: GREEN 확인.** 위 테스트와 `tests/film-variation-capture.spec.ts`, `tests/film-variation-reprocess.spec.ts`, `tests/studio-effects-actions.spec.ts`, `tests/studio-effects-seed.spec.ts`, typecheck.
- [ ] **Step 5: 커밋.** 이 제품 3개 파일과 테스트 3개만 stage; `feat: preserve film quality across capture and reprocessing`.

## Task 5: 접히는 조절판·설정 검사·촬영 잠금

**Files:** Create `src/components/FilmQualityControls.tsx`; Modify `src/components/CreativeSettings.tsx`, `src/components/SettingsOverview.tsx`, `src/components/SettingsSummary.tsx`, `src/App.tsx`, `src/styles.css`; Test `tests/film-quality-ui.spec.ts`, `tests/film-quality-layout.spec.ts`.

**Interfaces:** `FilmQualityControls({settings,locked,warning,onChange,onCompare}: {settings: FilmQualitySettings | undefined; locked:boolean; warning:string|null; onChange(s:FilmQualitySettings|undefined):void; onCompare():void})`. 기존 CreativeSettings에 이 node와 model 요약을 전달한다. 설정 검사는 CameraSettings를 직접 읽는다.

- [ ] **Step 1: 실패 테스트 작성.** 효과의 ‘필름 질감’을 열면 ‘기존 처리’/‘새 필름 처리’, 크기 프리셋 3종, ‘입자 강도’, ‘광원 번짐’, 접히는 ‘세부 조정’이 있어야 한다. 세부 값은 ‘입자 크기’/‘컬러 입자’/‘암부 입자’/‘번짐 범위’다. 첫 컷 이후 모든 쓰기 경로와 레시피 적용이 거부돼야 한다. 저장된 비활성 값과 실제 적용 값 구분, 저장 거절 시 세션 사용을 검사한다.

```ts
await expect(qualityFieldset).toBeDisabled();
expect(afterAttemptedChange).toEqual(firstCutSettings);
await expect(page.getByRole('button', {name:'변경 취소', exact:true})).toBeInViewport();
expect(stripOverlap).toBe(false);
expect(photoBoundsAfterOpening).toEqual(photoBoundsBeforeOpening);
```

- [ ] **Step 2: RED 확인.** `npm test -- tests/film-quality-ui.spec.ts tests/film-quality-layout.spec.ts --workers=1`; controls 부재로 FAIL.
- [ ] **Step 3: 구현.** 실제 UI edit 직전 Impeccable craft-floor를 읽는다. 기존 StudioDisclosure/camera-field/camera-range 토큰을 사용한다. 기본 접힘, 44px 터치 영역, 고정 footer, Escape·포커스 복귀를 유지한다. 새 모델 중 ‘은은한 질감’은 비활성 이유를 표시하고 중복 약화하지 않는다. 읽기·저장 경고는 실제 상태를 보여준다. 카메라 소스·재시작 로직은 변경하지 않는다.
- [ ] **Step 4: GREEN 확인.** 위 테스트와 `tests/settings-overview.spec.ts`, `tests/settings-overview-layout.spec.ts`, `tests/studio-effects-layout.spec.ts`.
- [ ] **Step 5: 커밋.** 이 제품 6개 파일과 테스트 2개만 stage; `feat: expose film quality in restrained studio controls`.

## Task 6: 실제 룩 썸네일과 동일 원본의 질감 비교

**Files:** Create `src/preview/filmTextureCompare.ts`, `src/components/FilmTextureComparison.tsx`; Modify `src/components/thumbs.ts`, `src/components/FilterStrip.tsx`, `src/components/FilterSheet.tsx`, `src/components/StudioFramePreview.tsx`, `src/App.tsx`, `src/styles.css`; Test `tests/film-quality-preview.spec.ts`, `tests/film-texture-comparison.spec.ts`.

**Interfaces:** `renderFilmTextureComparison(source:PreviewSource, settings:CameraSettings, lut:LutData|null, signal:AbortSignal): Promise<{before:HTMLCanvasElement;after:HTMLCanvasElement;release():void}>`. 양쪽 params·LUT·강도는 같으며 FX·뷰티·렌즈·날짜·추가 우연성은 제외한다. after에만 새 quality를 적용한다. 호출 측에서 LUT를 로드하며 source는 긴 변≤1024인 owned clone이다.

`FilmTextureComparison({source,settings,lut,onClose})`는 CameraDialog를 사용한다. 표시 문구는 ‘질감 비교’, ‘질감 전’, ‘질감 적용’, ‘색감·보정에 필름 질감만 비교 · 뷰티·렌즈·날짜·추가 우연성은 제외해요.’다. 적용 버튼은 만들지 않는다. 동결 소스의 크롭·미러링을 두 번 적용하지 않는다.

- [ ] **Step 1: 실패 테스트 작성.** 동일 원본·seed, quality0 동등, 1024 제한, 닫기 시 상태 보존, 처리 중 변경·닫기의 자원 해제/옛 결과 거부, missingLUT 오류, 해제된 소스 재시도, 기존 색감 A/B 의미를 검사한다. 썸네일 key는 모델·수치·seed·프로필 버전을 포함하고 같은 ID라도 값이 바뀌면 픽셀이 바뀌어야 한다.

```ts
expect(beforeZeroPixels).toEqual(afterZeroPixels);
expect(afterRepeatedPixels).toEqual(afterPixels);
expect(cameraSettingsAfterClose).toEqual(cameraSettingsBefore);
expect(releasedCanvasSizes).toEqual([0,0]);
expect(oldResultVisible).toBe(false);
expect(qualityCacheHitsAfterParameterChange).toBe(0);
```

- [ ] **Step 2: RED 확인.** `npm test -- tests/film-quality-preview.spec.ts tests/film-texture-comparison.spec.ts --workers=1`.
- [ ] **Step 3: 구현.** 비교 작업은 모듈의 Promise chain으로 순차 처리하며 각 await 경계에서 AbortSignal을 확인한다. 기존 export는 출력 canvas를 소유한 뒤 날짜/열화를 비동기로 처리하므로 공유 pipeline 상태를 await 너머 보관하지 않는다. 썸네일에 optional quality·프로필 버전을 추가해 stable key에 포함한다. clone·output은 finally/cleanup에서 해제하고 Studio preview deps에 quality를 추가한다. 소스 실패를 다른 사진으로 숨기지 않는다. 기존 색감 비교의 ‘질감 제외’를 유지하며 새 비교는 질감 설정에서만 연다.
- [ ] **Step 4: GREEN 확인.** 위 테스트와 `tests/preview-thumbnails.spec.ts`, `tests/preview-comparison.spec.ts`, `tests/preview-recovery.spec.ts`, `tests/studio-customization.spec.ts`, typecheck.
- [ ] **Step 5: 커밋.** 이 제품 8개 파일과 테스트 2개만 stage; `feat: compare and preview film texture on a frozen photo`.

## Task 7: 후보 평가·일반 카탈로그 연결·품질 기록

**Files:** Modify `src/engine/lut.ts`, `src/components/FilterSheet.tsx`, `src/App.tsx`, `src/components/FilterStrip.tsx`, `CHANGELOG.md`, `docs/architecture.md`; Create `docs/signature-film-quality-verification.md`, `docs/signature-film-evaluation.md`; Test `tests/signature-film-selection.spec.ts`.

**Interfaces:** 평가 통과 후보만 PRESETS에 group=`대표 룩`으로 추가한다. 기존 순서·ID는 유지한다. 평가 상태는 `'unverified'|'accepted'|'rejected'`로 문서에 기록한다. 평가용 query=`film-quality-preview=1`에서만 ‘대표 룩 · 시험중’ 후보를 명시적으로 제시할 수 있다. 기본 진입에 미검증 후보를 추가하지 않는다. App·필터 UI·비교 선택 목록이 같은 preview 카탈로그를 쓰도록 lut.ts의 `availablePresets(previewCandidates: boolean): readonly Preset[]`로 통일한다. 임시 HTTPS 평가 경로이지 품질 검증을 대체하는 flag가 아니다.

이 단계에서 일반 `loadPresetLut`는 명시적으로 정의된 signature 후보도 source loader로 해결하도록 연결한다. 이 로드 허용과 UI 노출은 구분한다. preview에서 이미 선택·저장한 후보는 기본 URL에서 새 목록으로 추천하지 않더라도 유효 스냅샷으로 복원·재현상할 수 있어야 한다. 현재 필터 라벨은 `signatureFilm(id)` 메타데이터도 확인해 잘못된 사용자 LUT 이름으로 표시하지 않는다. 정의되지 않은 ID는 계속 오류다.

- [ ] **Step 1: 실패 테스트 작성.** 기본 진입에 미검증 후보 없음, preview query에 ‘시험중’ 표시, 통과 후보의 출처 안내를 확인한다. 후보 선택→설정 snapshot→JPG 저장→원본 재현상 경로를 실제 UI로 검사한다.
- [ ] **Step 2: RED 확인.** `npm test -- tests/signature-film-selection.spec.ts --workers=1`.
- [ ] **Step 3: 구현과 평가.** AI 샘플 7종의 데모와 허용된 실제 사진 평가를 분리한다. 실제 사진의 이용 권한이 확보되지 않으면 모델·controls를 검증하되 후보는 unverified 상태로 preview에만 두고 대표 룩 품질 완료를 주장하지 않는다. 차이가 미미하거나 피부·흰색·식재료 색을 망가뜨리는 후보는 이유를 남기고 제외한다. 재사용 색 데이터와 자체 질감을 구분하며 제조사 재현·새 LUT·실기기 품질을 근거 없이 주장하지 않는다.
- [ ] **Step 4: GREEN 확인.** 위 테스트와 Task 2, `tests/film-collection.spec.ts`, `tests/provided-films.spec.ts`. 실제 사진 부족·실기기 미확인은 검증 문서에 그대로 남긴다.
- [ ] **Step 5: 커밋.** 명시한 제품·문서·테스트만 stage; `feat: expose evaluated signature looks with provenance`. 미검증 상태라면 `feat: prepare signature look preview and record pending evaluation`로 명명한다.

## 전체 검증과 완료 전달

- [ ] fresh `npm run typecheck`, `npm test -- --workers=2`, `npm run build`, `git diff --check`를 실행하고 결과·종료 코드를 읽는다. 테스트 서버 종료를 확인하고 기존 HTTPS preview pair 외에 장기 서버를 남기지 않는다.
- [ ] 4개 화면 크기를 한 번에 확인한다. controls·질감 비교·설정 검사·저장 결과의 console error/overflow/focus/disabled 상태를 검사하고 묶어서 수정 후 최대 한 번 재확인한다.
- [ ] legacy-only 추가 shader compile/pass=0, 반복 렌더의 질감 타일 재업로드=0, context restore 정상, live/export/reprocess의 값 일치를 기록한다. 새 source 프레임 업로드와 질감 타일 업로드를 구분한다. 실기기 속도·발열을 Chromium으로 증명하지 않는다.
- [ ] 코드 리뷰와 UI finish는 선택한 실행 방식 및 해당 skill의 required review 계약에 따른다. 현재 계획 작성에는 subagent를 사용하지 않았다.
- [ ] iPhone 15 Pro Max의 Safari/PWA에서 촬영·복귀·연속 합성·큰 입력·저장을 확인한다. 실제 기기 접근이 없으면 미확인으로 기록하고 사용자 확인을 요청한다.
- [ ] verification/CHANGELOG에 구현 범위, 실패·미검증, 정확한 테스트 개수, 실제 preview URL, 미push·미정식배포를 기록하고 커밋한다.
- [ ] 1A 결과를 전달하고 1B의 피부색 보호 상세 설계로 이어간다. 2/3A/3B는 전체 범위에 유지한다.

## 자기 검토

- 설계서의 호환성·seed·legacy 보존은 Task 1/3/4, 후보와 색 데이터는 Task 2/7, UI는 Task 5, preview는 Task 6, 품질·실기기는 Task 7/전체 검증에 대응한다.
- signature ID의 설정 누락, color-only 적용, manual/profile origin, pattern off seed, 합성 컷별 seed, GPU 모델 왕복, 작업 취소를 테스트에 배정했다.
- Task 1의 profile 검증은 filmQuality.ts에 설계서의 고정된 6개 signature ID 목록을 두고 수행한다. Task 2는 이 목록을 소비해 source/라벨/기본값을 연결하므로 순환 runtime import나 구현 순서 역전이 없다.
- UI는 기존 검정·보라색 Operate 화면 확장이다. craft-floor는 실제 수정 직전에 읽는다. 이미 실행한 Impeccable context는 반복하지 않으며 없는 DESIGN.md/PRODUCT.md를 부수적으로 생성하지 않는다.
- 초기 계수는 검증 전 시작값이다. 실제 사진 부족 시 후보 공개 경계를 두어 모델 자체 구현과 미적 품질 평가를 구분했다.
- GLSL anchor 삽입을 안전하게 다루지 못하면 공유 slot 방식으로의 설계 변경을 먼저 보고한다. 기존 shader를 무단 교체하지 않는다.

## 실행 방식 확인

추천은 **Native — 같은 세션에서 주 agent가 순서대로 구현**이다. resolver·GPU·촬영·UI가 밀접하게 연결돼 기존 App을 동시 편집할 이점이 작다. 대안은 Subagent-driven으로, 작업마다 worker와 reviewer가 교대하는 방식이며 독립 검토가 강하지만 작업별 context 비용이 늘어난다.

사용자가 Native 실행을 승인해 같은 폴더에서 순서대로 진행했다. 기존 작업은 보존하며 각 단계는 실패 테스트·구현·통과 확인·로컬 커밋 뒤 완료 기록을 남긴다. 정식 배포·push는 별도 요청 대상이다.
