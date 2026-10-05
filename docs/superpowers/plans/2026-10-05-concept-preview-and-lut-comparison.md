# Concept Preview & LUT Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보정 전 샘플 7종과 동일 원본 LUT A/B 비교를 추가하고, 기존 촬영 기능을 유지하면서 필터·스튜디오의 선택 계층을 정돈한다.

**Architecture:** 샘플 목록/로더, 동결 소스, 비교 렌더러와 제한된 썸네일 캐시를 분리한다. 기존 `FilterPipeline`과 `renderFilteredCanvas`를 재사용하고 App은 소스·선택 상태를 연결하는 역할만 맡는다. Studio는 기존 세 탭과 제어 콜백을 유지한 채 미리보기 → 주요 선택 → 접을 수 있는 세부 설정 순서로 정리한다.

**Tech Stack:** React 19, TypeScript, Vite, Canvas 2D/WebGL2, Playwright, 기존 로컬 저장소와 PWA 캐시. 새 제품 런타임 의존성은 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-05-camera-quality-roadmap-design.md`

**Status:** 사용자는 2026-10-05 설계 방향을 승인하고 현 상태 커밋 및 깔끔한 UI/UX 개선을 요청했다. 이 문서는 구현 전 검토용이다. 아래 Studio 정리안은 그 추가 요청을 구체화한 안이며 계획 확인 후 실행한다. 이미지·코드는 아직 생성/수정하지 않았다.

## Global Constraints

- 기존 검은 카메라 화면, 보라색 선택 상태, 중앙 셔터와 촬영 우선의 구조는 유지한다.
- 영상 기능은 제외한다.
- 기존 필터, 레시피, 최근 촬영, 촬영 비율과 전면 카메라 복귀 동작을 보존한다.
- ‘현재 장면 비교’는 메모리 동결만 하므로 원본 보관 옵션을 강제로 켜지 않는다.
- 사진이나 커스텀 LUT를 서버에 업로드하지 않는다.
- 첫 자산 팩은 **인물 / 음식 / 풍경 / 카페 / 거리 / 야간 / 실내** 7종으로 한다.
- 샘플은 정사각형이며 제품용 버전은 512×512로 제공한다.
- 비교용 미리보기의 긴 변은 최대 1024로 제한한다.
- 썸네일 크기는 우선 기존 128×128을 유지한다.
- 캐시 결과는 최대 256개로 제한하고 최근 사용 순으로 정리한다.
- 첫 버전은 **LUT 색감 비교**다. 뷰티·날짜·렌즈·입자·빛샘·필름 패턴은 끈다.
- A/B 강도는 각각 0~100%로 조절하며 기본값은 100%다.
- 명시적 적용 때 선택 LUT와 해당 강도만 변경한다.
- 샘플 전환·비교 열기가 카메라 `getUserMedia`를 다시 호출하거나 촬영 프레임 중앙 정렬을 변경하지 않음.
- 프로덕션 push·배포·블로그 수정은 별도 요청 전 하지 않는다.

## Review Focus

1. 편집/재현상에서 이미 보정된 `editSrc`를 원본으로 오인해 LUT를 두 번 적용하지 않는다 — Task 2/5 원본 경로 테스트.
2. A→B→A 샘플 전환, 같은 ID의 커스텀 LUT 업데이트, 작업 실패 후 다음 작업에서 오래된 캐시가 보이지 않는다 — Task 3 취소·실패·버전 테스트.
3. Safari/PWA의 오래된 샘플 캐시와 오프라인 첫 실행에서 이전 이미지 또는 성공처럼 보이는 대체 사진을 보여주지 않는다 — Task 1/7 프로덕션 자산 테스트.
4. 설정이 켜진 상태에서 접힌 Studio 고급 영역을 발견하지 못하거나 설정이 초기화되지 않는다 — Task 6 활성 요약·잠금·펼침 테스트.
5. 작은 화면·가로 화면·확대 글자·키보드에서 비교 닫기/적용과 Studio 자동·수동 촬영이 접근 가능하다 — Task 5/6/7 뷰포트·포커스 테스트.

## UI/UX 정리안

### 필터

- 기존 촬영 화면의 스트립 위치·높이·확장 핸들을 유지한다. 소스 선택 때문에 촬영 영역이 위로 밀리지 않는다.
- 전체 필터 시트 헤더 아래 한 행에 `샘플: 인물 ▾`와 `색감 비교`만 둔다. 7개 콘셉트와 모든 필터 그룹 버튼을 한 화면에 동시에 늘어놓지 않는다.
- 소스 선택은 시트 안의 펼침 영역으로 제공한다. 별도 모달을 겹치지 않는다. 콘셉트는 작은 정사각형 사진과 짧은 이름으로 선택하며 현재 장면은 명확한 별도 항목이다.
- 필터 그룹·최근 사용·즐겨찾기는 그대로 유지한다. 샘플 변경은 선택 LUT를 바꾸지 않는다.
- 비교는 필터 시트를 닫고 단일 CameraDialog로 연다. 닫으면 이전 필터 시트와 스크롤 위치를 복원한다. 비교 취소로 현재 설정을 바꾸지 않는다.
- 모바일 기본은 큰 사진 한 장 + `원본 / A / B` 선택, 데스크톱 기본은 A/B 나란히 보기. 각각의 강도와 적용 대상이 혼동되지 않게 이름을 표시한다.
- 소스 선택·로딩·오류가 모두 명시적으로 보이며, 준비되지 않은 화면에서 적용 버튼은 비활성화한다.

### 스튜디오

- `템플릿 / 촬영 모드 / 효과` 탭 이름과 키보드 조작을 유지한다. 새 탭·새 내비게이션은 추가하지 않는다.
- 현재 프레임 미리보기는 유지하되 캡션을 한 줄 요약으로 정리하고, 작은/가로 화면에서는 선택 영역을 가리지 않도록 높이를 줄인다.
- 템플릿 탭: 즉석사진·네컷 선택을 먼저 보여주고 `프레임 꾸미기`를 접을 수 있게 한다. 현재 적용 중인 여백색·문구 유무를 닫힌 상태에도 표시한다.
- 네컷의 자동·수동 선택과 필요한 간격은 숨기지 않는다. 한 컷 비율과 촬영 잠금 상태도 계속 확인 가능하게 한다.
- 효과 탭: 기존 필름 선택과 색상만/전체 룩을 주요 항목으로 유지한다. `렌즈 효과`와 `빈티지 우연성`은 고급 펼침 영역으로 분리하고, 닫혀도 현재 효과·패턴 모드를 요약한다.
- 켜져 있는 고급 효과는 처음 열 때 해당 영역을 펼친다. 단순히 접고 펴는 동작으로 값·패턴을 변경하지 않는다.
- 빈티지 우연성의 꺼짐/매 컷/고정, 다른 패턴·고정·레시피 저장·오류 복구는 펼치면 모두 접근 가능하다.
- 기존 기능 설명의 핵심 경고(RAW 아님, 원본 용량, 촬영 후 잠금, 패턴 적용 범위)는 제거하지 않는다. 반복되는 소개 문장만 정리한다.
- 사용자가 이미 선택한 필터·프레임·촬영 방식은 화면을 열거나 접는 것만으로 바뀌지 않는다.

---

### Task 1: 7종 기준 샘플과 자산 로딩

**Files:**
- Create: `src/preview/samples.ts`, `docs/sample-provenance.md`
- Create: `public/samples/concepts/{portrait,food,landscape,cafe,street,night,interior}.webp`
- Create: `public/samples/masters/{portrait,food,landscape,cafe,street,night,interior}.png`
- Modify: `vite.config.ts` — 샘플 캐시만 확장, 기존 LUT/ML 캐시 유지
- Test: `tests/preview-samples.spec.ts`, `tests/preview-assets.spec.ts`

**Interfaces:**
- Produces: `SampleId = 'portrait' | 'food' | 'landscape' | 'cafe' | 'street' | 'night' | 'interior'`
- Produces: `SampleSpec { id: SampleId; label: string; thumbUrl: string; masterUrl: string; version: string }`
- Produces: `SAMPLES: readonly SampleSpec[]`, `DEFAULT_SAMPLE_ID: SampleId = 'portrait'`
- Produces: `loadSample(id: SampleId, variant: 'thumb' | 'master' = 'thumb'): Promise<HTMLImageElement>`
- Produces: `readSamplePreference(): SampleId`, `writeSamplePreference(id: SampleId): void` (`oc-preview-sample`; 저장소 차단 시 무시)

- [ ] **Step 1: 실패 테스트 작성.** 목록 ID/라벨이 정확히 7종이고 기본값은 portrait인지 검증한다. 404를 한 번 발생시킨 뒤 같은 ID 재시도가 성공하는지, 다른 샘플 Promise가 분리되는지, master 3종 로드 후 메모리 캐시가 2개인지, localStorage 차단/손상에서 기본값으로 돌아오는지 검사한다.
- [ ] **Step 2: 실패 확인.** `npx playwright test tests/preview-samples.spec.ts --reporter=line`; 새 모듈 부재 또는 지정 assertion 실패가 나와야 한다.
- [ ] **Step 3: 샘플 제작.** imagegen 스킬을 읽고 설계 문서 §5.2 프롬프트로 독립 이미지 7개를 생성한다. 실제 출력 해상도를 확인해 1024 이상 기준 원본을 PNG로 보존하고 제품용 512 WebP를 파생한다. 얼굴·텍스트·브랜드·사전 색보정 여부를 확인한다. 도구가 파일을 제공하지 않거나 기준 원본이 없으면 샘플 완성으로 표시하지 않는다.
- [ ] **Step 4: 목록·로더 구현.** 성공 Promise만 재사용하고 실패 엔트리는 제거한다. thumb는 7종, master 메모리 캐시는 최근 2개로 제한하며 퇴출 시 다른 소비자가 쓰는 이미지를 훼손하지 않고 참조만 제거한다. Vite가 각 샘플의 thumb+master 파일 바이트를 SHA-256으로 해싱해 `__SAMPLE_VERSIONS__: Record<SampleId, string>`을 define하고 samples 모듈에서 타입을 선언한다. 파일 URL은 `?v=<해시>`를 포함한다. source 선택은 이미지 내용과 독립적인 ID다. 생성·변환 작업은 실제 도구와 기존 사용 가능한 이미지 변환 기능으로 수행하고 프롬프트/원본/해시를 출처 문서에 기록한다.
- [ ] **Step 5: PWA 캐시 검증.** `samples/masters/**`와 concepts bare URL을 glob precache에서 제외한다. `additionalManifestEntries`에 로더와 **동일한 버전 URL**의 7종 512 자산을 등록한다. 버전 query를 무조건 무시해서 옛 샘플과 매칭하지 않는다. master는 필요할 때만 로드하고 런타임 캐시는 최대 2개다. URL 버전이 바뀌면 이전 파일을 사용하지 않아야 한다. 카메라 권한이 없어도 샘플은 열린다.
- [ ] **Step 6: 통과 확인.** `npx playwright test tests/preview-samples.spec.ts tests/preview-assets.spec.ts --reporter=line`; manifest/512 치수/1024 이상 원본/자산 버전/오프라인 자산 테스트가 통과해야 한다.
- [ ] **Step 7: 커밋.** Task 1의 생성 자산·모듈·테스트·출처·Vite 변경만 스테이징하고 `feat: add neutral concept sample assets`로 커밋한다. 기존 `sample1.png`는 유지한다.

### Task 2: 같은 장면의 동결과 원본 선택

**Files:**
- Create: `src/preview/source.ts`
- Test: `tests/preview-source.spec.ts`

**Interfaces:**
- Consumes: Task 1 `SampleId`, `loadSample`, 기존 `snapshotFrame`, `CaptureRecord`
- Produces: `PreviewSource { key: string; label: string; kind: 'sample' | 'scene' | 'import' | 'capture'; canvas: HTMLCanvasElement; release(): void }`
- Produces: `freezePreviewSource(input: { source: TexImageSource; label: string; kind: 'scene' | 'import'; ratio: { w: number; h: number } | null; mirror: boolean }): PreviewSource`
- Produces: `samplePreviewSource(id: SampleId): Promise<PreviewSource>`
- Produces: `capturePreviewSource(record: CaptureRecord, index: number): Promise<PreviewSource>`

- [ ] **Step 1: 실패 테스트 작성.** 원본 소스를 빨강→파랑으로 변경해도 동결 결과는 바뀌지 않고, 새 동결만 파란색인지 검사한다. 긴 변 ≤1024, 한 번만 크롭/미러, 동일 A/B 크기를 검사한다. 보관 원본 없음·범위 밖 컷 index는 오류이고 결과 blob으로 대체되지 않아야 한다. `release()` 두 번 호출이 안전해야 한다.
- [ ] **Step 2: 실패 확인.** `npx playwright test tests/preview-source.spec.ts --reporter=line`.
- [ ] **Step 3: 구현.** 동결마다 새 키를 만들고 원본의 2D 복사만 보관한다. `samplePreviewSource`는 master를 지연 로딩한다. `capturePreviewSource`는 `record.originals[index]`만 디코드하고 이미 반영된 크롭/미러를 다시 적용하지 않는다. ImageBitmap은 finally에서 닫는다. release는 소유 캔버스만 해제하고 입력 소스·영상 트랙에 접근하지 않는다.
- [ ] **Step 4: 통과 확인.** Task 2 테스트와 Task 1 로더 테스트가 모두 통과해야 한다. 개인 소스 키·픽셀·파일이 localStorage/네트워크/보관함에 저장되지 않아야 한다.
- [ ] **Step 5: 커밋.** `feat: freeze canonical sources for filter comparison`.

### Task 3: 샘플별 썸네일과 제한된 캐시

**Files:**
- Create: `src/preview/thumbnailCache.ts`
- Modify: `src/components/thumbs.ts`, `src/components/FilterStrip.tsx`, `src/components/FilterSheet.tsx`
- Test: `tests/preview-thumbnails.spec.ts`

**Interfaces:**
- Consumes: Task 1 샘플 로더, 기존 `ThumbItem` 및 `FilterPipeline`
- Produces: `ThumbnailCache` (`get(key: string): HTMLCanvasElement | undefined`, `set(key: string, canvas: HTMLCanvasElement): void`, `clear(): void`, `size: number`), 최대 256개 LRU
- Extends: `ThumbItem` with `version?: string; amount?: number` (기본 amount 1, ORIGINAL 0)
- Extends: `renderPresetThumbs` opts with `sampleId?: SampleId; source?: TexImageSource | null; sourceVersion?: string; onError?: (id: string, message: string) => void`
- Extends: `getSampleImage(sampleId?: SampleId): Promise<HTMLImageElement>`; 인자 없는 호출은 기존 `sample1.png` 호환 동작을 유지하고 명시적 ID는 새 로더를 사용한다. `applyThumb`, `renderPresetThumbs` 기존 호출도 호환한다.

- [ ] **Step 1: 실패 테스트 작성.** 257번째 set 후 크기 256, get한 항목 보존, 내보낸 오래된 캔버스 해제, 서로 다른 source/asset/LUT 버전/강도/FX 키 분리를 검증한다. A→B→A 전환에서 A 픽셀이 돌아오는지, 취소된 요청의 출력이 보이지 않는지, 실패한 작업 다음 정상 작업이 실행되는지 검사한다.
- [ ] **Step 2: 실패 확인.** `npx playwright test tests/preview-thumbnails.spec.ts --reporter=line`.
- [ ] **Step 3: 구현.** 캐시 키를 안정적인 tuple 직렬화로 만들고 콜론 split에 의존하지 않는다. 렌더 전·샘플/LUT await 후·각 항목 처리 사이에서 취소를 확인한다. 처리 큐는 reject 이후 복구한다. LUT 실패는 오류 상태로 표시하고 identity 결과를 성공 캐시에 넣지 않는다. 무효화 뒤 연결된 캔버스에 낡은 결과를 복사하지 않는다.
- [ ] **Step 4: 보이는 항목 우선 처리.** 스트립은 스크롤 영역 기준 IntersectionObserver로 현재 보이는 항목부터 요청한다. 시트도 현재 화면의 refs 먼저 처리하고 나머지는 스크롤 진입 시 생성한다. 필터 ID/정렬/즐겨찾기/선택 핸들러는 변경하지 않는다.
- [ ] **Step 5: 통과 확인.** Task 3 테스트와 기존 필터·스튜디오 샘플 테스트 통과. 최대 썸네일 출력은 128×128이고 비교 소스가 바뀌어도 스트림 재시작은 0회다.
- [ ] **Step 6: 커밋.** `feat: render concept thumbnails with bounded caching`.

### Task 4: 순차 처리하는 LUT 색감 비교 렌더러

**Files:**
- Create: `src/preview/compare.ts`
- Test: `tests/lut-comparison-render.spec.ts`

**Interfaces:**
- Consumes: Task 2 `PreviewSource`, 기존 LUT loaders, `DEFAULT_PARAMS`, `renderFilteredCanvas`
- Produces: `ComparisonChoice { id: string; label: string; custom: boolean; amount: number; version?: string }`
- Produces: `ComparisonImages { original: HTMLCanvasElement; a: HTMLCanvasElement; b: HTMLCanvasElement; release(): void }`
- Produces: `renderColorComparison(source: PreviewSource, a: ComparisonChoice, b: ComparisonChoice, signal: AbortSignal): Promise<ComparisonImages>`

- [ ] **Step 1: 실패 테스트 작성.** 단색·중성 그라데이션 fixture로 ORIGINAL, A 강도0, B 강도0의 픽셀이 동일한지 검사한다. mono와 warm은 결과가 달라야 한다. preset FX와 유저 뷰티·날짜·렌즈·패턴이 끼어들지 않고 source 픽셀이 유지되는지 검사한다. 누락 custom LUT, NaN/음수/1초과 강도와 abort는 실패해야 한다.
- [ ] **Step 2: 실패 확인.** `npx playwright test tests/lut-comparison-render.spec.ts --reporter=line`.
- [ ] **Step 3: 구현.** 기본 파라미터·null FX·날짜 off·미러 false·ratio null로 canonical canvas를 세 번 렌더한다. 현재 전역 export pipeline을 재사용하며 Promise.all로 병렬 렌더하지 않는다. 사용자 settings를 읽거나 변경하지 않는다. 각 await 뒤 abort를 확인하고 실패 시 이미 만든 출력도 해제한다. LUT가 없으면 명시적 오류를 낸다.
- [ ] **Step 4: 통과 확인.** Task 4 테스트 + 기존 export/variation 렌더 테스트. 반복 열기/닫기에 새 WebGL context가 매번 증가하지 않아야 한다.
- [ ] **Step 5: 커밋.** `feat: compare two LUTs on one unfiltered source`.

### Task 5: 콘셉트 선택·비교 UI와 기존 흐름 연결

**Files:**
- Create: `src/components/PreviewSourcePicker.tsx`, `src/components/LutComparison.tsx`, `src/preview/usePreviewSource.ts`
- Modify: `src/App.tsx`, `src/components/FilterSheet.tsx`, `src/components/FilterStrip.tsx`, `src/components/PhotoHistory.tsx`, `src/components/StudioFramePreview.tsx`, `src/styles.css`
- Test: `tests/concept-preview.spec.ts`, `tests/lut-comparison.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4 + 기존 CameraDialog/CustomEntry/CaptureRecord
- Produces: `LutComparison` props `{ source: PreviewSource; choices: readonly Omit<ComparisonChoice, 'amount'>[]; selectedId: string; locked: boolean; onApply(choice: ComparisonChoice): void; onClose(): void }`
- Produces: `PreviewSourcePicker` props `{ sampleId: SampleId; sourceKind: PreviewSource['kind']; sceneAvailable: boolean; importAvailable: boolean; captureFrames: number; captureIndex: number; busy: boolean; error: string | null; onSample(id: SampleId): void; onScene(): void; onImport(): void; onCaptureIndex(index: number): void; onRefresh(): void; onRetry(): void }`. 보관 원본은 `원본 컷 1` 등으로 표시하고 importAvailable은 재현상 중인 editSrc에 대해 false다.
- Produces: `usePreviewSource(context: PreviewContext): PreviewController` owns shared thumbnail selection and asynchronous source loading. `PreviewContext` supplies `getCameraSource(): TexImageSource | null`, `cameraRatio: { w: number; h: number }`, `cameraMirror: boolean`, `sceneAvailable: boolean`, `editSource: HTMLCanvasElement | null`, `editToken: number`, `reprocessRecord: CaptureRecord | null`.
- Produces: `PreviewController` exposes `sampleId: SampleId`, `sourceKind: PreviewSource['kind']`, `thumbnailSource: TexImageSource | null`, `sourceKey: string`, `activeCapture: CaptureRecord | null`, `captureIndex: number`, `busy: boolean`, `error: string | null`, `selectSample(id: SampleId): Promise<void>`, `selectScene(): Promise<void>`, `selectImport(): Promise<void>`, `selectCapture(record: CaptureRecord, index: number): Promise<void>`, `prepareComparison(): Promise<PreviewSource>`, `retry(): Promise<void>`, `release(): void`.
- 샘플 선택은 512 파일만 로드한다. `prepareComparison()`에서 master를 지연 로딩한다. 장면/import/capture는 canonical canvas를 썸네일과 비교에 공유한다. 새 선택 준비 전에는 기존 소스를 유지하되 로딩/오류 표식을 씌워 새 결과인 것처럼 보여주지 않는다.
- Extends: `PhotoHistory` with optional `onCompare(record: CaptureRecord): void`. 원본 없는 기록은 비교 버튼을 비활성화한다.
- Extends: `StudioFramePreview` with optional `sampleId?: SampleId`. source가 없을 때만 해당 샘플을 fallback으로 사용한다. 실제 장면·이미 찍은 컷은 샘플 선택으로 교체하지 않는다.

- [ ] **Step 1: 실패 테스트 작성.** 7종 선택이 시트와 스트립에 공유되고 필터·강도는 그대로인지 검사한다. 시트의 ‘색감 비교’로 단일 dialog만 열리고 취소 후 이전 그룹/스크롤이 복원돼야 한다. 현재 장면은 한 번 동결되고 새로고침 전까지 유지돼야 한다. 편집 사진은 기본 소스지만 샘플을 골라도 편집 입력을 바꾸지 않아야 한다.
- [ ] **Step 2: 추가 실패 테스트 작성.** A/B 기본강도100%, B ORIGINAL, 원본/A/B 전환, 양쪽 동일 확대, explicit apply와 cancel의 차이를 검사한다. 적용은 선택 LUT·강도만 바꾸고 현재 grainOff·뷰티·패턴·날짜·수동 파라미터가 그대로여야 한다. reprocessRecord 경로에서는 `editSrc` 대신 보관한 컷을 사용한다. history 원본 없는 기록은 오류 안내와 비활성 버튼, 여러 컷은 원본 컷 선택을 제공한다.
- [ ] **Step 3: 실패 확인.** `npx playwright test tests/concept-preview.spec.ts tests/lut-comparison.spec.ts --reporter=line`.
- [ ] **Step 4: UI 구현.** 위 UI/UX 정리안대로 배치한다. 원본/A/B는 접근 가능한 단일 선택 그룹, 확대는 공통 1×/2×와 중앙 기준으로 제공한다. 전체 룩을 비교한다고 표시하지 않는다. 미리보기 최대1024 한계를 도움말에 표시한다. preset/custom 선택 목록의 이름과 적용 슬롯을 명확하게 구분한다.
- [ ] **Step 5: App 연결.** `getSource()`가 재현상에서 보정된 합성 입력을 반환할 수 있으므로 record originals를 별도 읽는다. 최근 기록 비교는 컷1부터 시작하고 index 선택 시 해당 컷만 교체한다. 최근 촬영 화면은 비교 동안 보이지 않는 상태로 보존해 닫기 때 이전 기록·포커스를 복원한다. import/camera 소스는 메모리만 사용한다. 잠금·작업 중에는 적용을 막는다.
- [ ] **Step 6: 선택 적용의 부작용 차단.** 기존 LUT 변경 effect의 `setGrainOff(false)` 등 자동 리셋을 확인하고 비교 적용에 한해 `lutId`+`lutIntensity` 이외 변경을 억제하는 명시적 경로를 만든다. recipeApplying ref를 의미가 다른 작업에 무조건 재사용하지 않는다.
- [ ] **Step 7: 접근성/복구 검증.** Escape·Tab·Shift+Tab·소스 로드 실패 재시도·missing LUT·비교 중 삭제·빠른 닫기 테스트. 320×568/390×844/844×390/1280×800에서 닫기/적용 접근 가능, 가로 넘침 없음. 화면 위에 두 개의 활성 modal 또는 focus trap이 존재하지 않아야 한다.
- [ ] **Step 8: 통과 확인과 커밋.** Task 5와 Tasks 1–4 테스트 후 `feat: add clean concept preview and LUT comparison UI`로 해당 파일만 커밋한다.

### Task 6: 기존 기능을 보존하는 Studio 화면 정리

**Files:**
- Create: `src/components/StudioDisclosure.tsx`
- Modify: `src/components/CreativeSettings.tsx`, `src/components/StudioFramePreview.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `tests/studio-organization.spec.ts`
- Update if necessary: `tests/studio.spec.ts`, `tests/instant-film.spec.ts`, `tests/studio-customization.spec.ts`, `tests/film-variation-ui.spec.ts`

**Interfaces:**
- Consumes: 기존 CreativeSettings props, FrameDecoration, BoothControls, FilmVariationControls의 콜백과 값
- Produces: `StudioDisclosure` props `{ title: string; summary: string; initiallyOpen: boolean; children: ReactNode }`, native details/summary를 사용하며 펼침 상태는 제품 설정과 분리
- Extends: `CreativeSettings` props with `variationSummary?: { mode: 'off' | 'new' | 'fixed'; warning: string | null; writable: boolean }`. App의 기존 variation 상태를 읽기 전용으로 전달해 닫힌 영역에서도 활성 상태/오류를 알리고, 기존 `variationControls`의 변경 콜백은 유지한다.
- Preserves: CreativeSettings의 외부 제어 계약, 원본 설정 key, LUT ID, frame settings, CameraSettings 및 레시피 포맷

- [ ] **Step 1: 실패 테스트 작성.** 접힌 ‘프레임 꾸미기’에 적용된 크림/문구 유무가 보이고 펼쳐도 값이 유지돼야 한다. 켜진 렌즈/패턴은 첫 진입에서 열린 상태여야 한다. 닫아도 활성 요약이 남고 실제 params와 seed는 같아야 한다. 네컷 자동/수동·간격은 첫 화면에서 접근 가능하며 촬영 시작 후 기존 잠금 상태가 유지돼야 한다.
- [ ] **Step 2: 실패 확인.** `npx playwright test tests/studio-organization.spec.ts --reporter=line`.
- [ ] **Step 3: UI 정리 구현.** UI/UX 정리안의 Studio 순서를 따른다. 중첩 카드·새 색상·장식 아이콘을 추가하지 않고 제목, 간격, 한 줄 요약과 구분선으로 계층을 만든다. 조건부로 숨겼다가 켜는 것만으로 기존 제어가 unmount/reset되지 않도록 제어 상태는 부모에 유지한다. errors/notices가 접혀 있을 때도 발견될 수 있게 경고 표시를 남긴다.
- [ ] **Step 4: 기존 테스트 적응.** 접힌 꾸미기·렌즈·빈티지 영역에 들어가는 테스트만 필요한 summary를 열도록 업데이트한다. 원본 저장·재현상·자동/수동·네컷 retention·날짜·패턴 픽셀 assertion은 약화하지 않는다.
- [ ] **Step 5: 검증.** `npx playwright test tests/studio-organization.spec.ts tests/studio.spec.ts tests/instant-film.spec.ts tests/studio-customization.spec.ts tests/film-variation-ui.spec.ts --reporter=line`. 작은 화면·가로·키보드·200% 텍스트에서 주요 제어 접근성과 설명의 보존을 확인한다.
- [ ] **Step 6: 커밋.** `refactor: simplify studio controls without changing capture behavior`.

### Task 7: 회귀·시각 검증과 문서 마무리

**Files:**
- Create: `tests/preview-layout.spec.ts`, `docs/preview-comparison-verification.md`
- Modify: `docs/architecture.md`, `CHANGELOG.md`, `.impeccable/surfaces/src-app-tsx.md`

**Interfaces:**
- Consumes: Tasks 1–6의 통합된 동작
- Produces: 검증 명령 결과·뷰포트별 증거·실기기 확인 상태와 미완료 사항을 분리한 기록

- [ ] **Step 1: 레이아웃 회귀 테스트 작성.** 4개 크기에서 필터 시트·비교·Studio bounds와 가로 넘침, 고정 버튼 가시성, 포커스 복귀를 검사한다. 1:1/4:5/3:4 촬영 프레임 중앙을 기존 기준으로 검사하고 preview 조작에서 getUserMedia 추가 호출0회를 확인한다.
- [ ] **Step 2: 실패 확인 후 필요한 통합 수정.** `npx playwright test tests/preview-layout.spec.ts --reporter=line`; 기존 촬영 viewport 계산을 수정해서 새 UI 문제를 덮지 않는다.
- [ ] **Step 3: 전체 검증.** 순서대로 `npm run typecheck`, `npm run build`, `npm test -- --reporter=line`. 새 자산을 production preview에서 로드하고 service worker 업데이트/오프라인을 별도 확인한다. 실패는 원인을 기록하고 관련 테스트를 재실행한다.
- [ ] **Step 4: 시각 검증.** 구현 전에 craft-floor를 읽고, 구현 후 모바일·데스크톱·작은 화면·가로 화면을 한 번에 촬영한다. 모든 결함을 한 배치로 수정한 뒤 최대 한 번 더 확인한다. 정적인 예전 스크린샷으로 새 구현의 통과를 주장하지 않는다.
- [ ] **Step 5: 사진 기준 검증 분리.** AI 7종과 실제 사진이 서로 다른 검증 자료임을 기록한다. 21장 실제 사진이 제공되지 않았다면 ‘실제 사진 품질 검증 대기’로 표시하고 확보하지 않은 자료의 검증을 완료 체크하지 않는다. 새 LUT 선정은 후속 단계다.
- [ ] **Step 6: 실기기와 배포 경계.** 실제 iPhone Safari/PWA 복귀 확인은 자동 테스트 통과와 분리한다. 기존 임시 HTTPS를 사용할 수 있을 때만 안내하고 만료된 링크를 재사용하지 않는다. 요청 없는 공개 링크 생성·프로덕션 push는 하지 않는다.
- [ ] **Step 7: 최종 검토·문서.** 기존 구현 파일·테스트·자산 출처를 대조하고 `.impeccable` finish 절차와 실행 스킬이 요구하는 코드 검토를 수행한다. 선택한 실행 방식에 따라 검토 에이전트만 명시적으로 배정하고 확인되지 않은 승인을 주장하지 않는다. 새 기능·기존 기본값·원본 한계·알려진 미검증 항목을 문서에 남긴다.
- [ ] **Step 8: 커밋과 보고.** 검증을 통과한 파일만 커밋하고 단계1 완료 여부, 실제 기기/실제 사진 대기 여부, 배포하지 않았음을 구분해 보고한다.

## Plan Self-Review

### 테스트 이름과 고정 assertion 계약

각 Step 1의 테스트는 아래 이름을 사용한다. 테스트는 기존 프로젝트처럼 Playwright page.evaluate에서 Vite 모듈을 로드하거나 UI를 조작한다. `result`는 각 테스트가 실제 API/DOM에서 수집한 결과이며 mock 성공값을 하드코딩하지 않는다.

```ts
// tests/preview-samples.spec.ts
test('seven neutral concepts expose stable IDs and labels', async ({ page }) => {
  // /src/preview/samples.ts의 SAMPLES와 DEFAULT_SAMPLE_ID를 읽는다.
  expect(result.ids).toEqual(['portrait', 'food', 'landscape', 'cafe', 'street', 'night', 'interior']);
  expect(result.labels).toEqual(['인물', '음식', '풍경', '카페', '거리', '야간', '실내']);
  expect(result.defaultId).toBe('portrait');
});
// tests/preview-source.spec.ts
test('canonical source freezes once and never substitutes a processed history blob', async ({ page }) => {
  expect(result.frozenAfterMutation).toEqual(result.frozenBeforeMutation);
  expect(result.frozenBeforeMutation).not.toEqual(result.newSnapshot);
  expect(result.maxEdge).toBeLessThanOrEqual(1024);
  expect(result.missingOriginalRejected).toBe(true);
  expect(result.doubleReleaseSafe).toBe(true);
});
// tests/preview-thumbnails.spec.ts
test('thumbnail cache is LRU bounded and recovers after failures', async ({ page }) => {
  expect(result.cacheSizeAfter257).toBe(256);
  expect(result.recentEntryRetained).toBe(true);
  expect(result.distinctKeyCount).toBe(6); // 기본 키 + source/asset/LUT version/amount/FX를 각각 바꾼 5개 키
  expect(result.staleOutputDrawn).toBe(false);
  expect(result.nextRequestAfterFailureCompleted).toBe(true);
});
// tests/lut-comparison-render.spec.ts
test('zero-strength LUT comparison is identical and free of preset effects', async ({ page }) => {
  expect(result.originalPixels).toEqual(result.zeroAPixels);
  expect(result.originalPixels).toEqual(result.zeroBPixels);
  expect(result.monoPixels).not.toEqual(result.warmPixels);
  expect(result.sourceUnchanged).toBe(true);
  expect(result.missingCustomRejected).toBe(true);
});
// tests/lut-comparison.spec.ts
test('comparison cancel preserves settings and apply changes only LUT and intensity', async ({ page }) => {
  expect(result.afterCancel).toEqual(result.before);
  expect(result.afterApply.lutId).toBe(result.chosenId);
  expect(result.afterApply.intensity).toBe(0.5);
  expect(result.afterApplyOtherSettings).toEqual(result.beforeOtherSettings);
  expect(result.getUserMediaExtraCalls).toBe(0);
});
// tests/studio-organization.spec.ts
test('folded active studio settings remain discoverable and unchanged', async ({ page }) => {
  expect(result.activeLensInitiallyOpen).toBe(true);
  expect(result.fixedPatternInitiallyOpen).toBe(true);
  expect(result.summaryAfterClose).toContain('패턴 고정');
  expect(result.settingsAfterToggle).toEqual(result.settingsBeforeToggle);
  expect(result.autoAndManualVisible).toBe(true);
});
// tests/preview-layout.spec.ts — 320×568, 390×844, 844×390, 1280×800 각각 수행
test('preview dialogs preserve camera geometry and reachable actions', async ({ page }) => {
  expect(result.horizontalOverflow).toBe(false);
  expect(result.closeReachable).toBe(true);
  expect(result.applyReachable).toBe(true);
  expect(result.activeDialogCount).toBe(1);
  expect(result.frameRectAfter).toEqual(result.frameRectBefore);
});
```

- [x] 샘플/원본/비교/오류/캐시/기존 호환성을 각각 Task 1–5에 배정했다.
- [x] Studio 추가 요청은 UI/UX 정리안과 Task 6에 제한해 기존 값·자동/수동·원본 옵션을 보존했다.
- [x] 카메라 라이프사이클·뷰티 엔진·LUT 정밀도·보관함 마이그레이션·새 LUT 번들은 이번 작업에서 제외했다.
- [x] 공유 인터페이스의 필드명과 default 값을 Tasks 1–6에서 일치시켰다.
- [x] 원본 없는 기록, mixed-mode editSrc, rejected queue, 오래된 PWA cache, 접힌 활성 설정과 작은 화면을 테스트에 포함했다.
- [x] 실제 사진·실기기·이미지 생성 실패는 자동 테스트와 별개로 남겨 거짓 완료를 막는다.

## Execution Handoff

직접 구현(Native)을 추천한다. 소스 선택과 기존 App 연결이 긴밀하고 현재 수정본을 보존해야 하므로 한 구현자가 흐름을 유지하는 편이 적합하다. 작업별 하위 에이전트 구현은 더 많은 독립 검토가 가능하지만 컨텍스트/인터페이스 전달 비용이 높다.

이 문서의 범위와 UI/UX 정리안을 확인하고 실행 방식을 선택한 뒤 Task 1부터 진행한다. 현재 폴더 유지라는 기존 사용자 선택을 보존하고 임의의 별도 작업트리로 옮기지 않는다.
