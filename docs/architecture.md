# open-camera 아키텍처

iOS 카메라 경험을 목표로 한 설치형 PWA. WebGL2 싱글 패스 셰이더로
실시간 필터/이펙트를 처리하고, MediaPipe로 얼굴 인식 보정을 한다.

## 전체 구조

### 스튜디오 효과 복원 / 추가 필름 컬렉션 (2026-10-05)

- `openStudio`는 필터 ID·강도·입자 꺼짐·기본 FX seed·렌즈/강도 적용 방식·추가 질감 설정/패턴과 재현상 컷별 상태를 소유한 스냅샷으로 보관합니다. 변경 취소는 이 효과 필드만 복원하고 닫습니다. 템플릿·촬영 모드·비율·수동 보정·뷰티·날짜·원본 보관은 취소 대상이 아닙니다.
- 효과 해제는 LUT `none`, 기본 렌즈 설정, 추가 패턴 `off`를 적용합니다. 숫자 보정값이나 저장된 레시피/사진은 지우지 않습니다. 필름 없음 선택은 LUT만 해제합니다. 기존 닫기/Escape/배경 누르기는 선택을 유지합니다.
- 기존 LUT 선택의 seed 재생성/입자 초기화를 복원 동작에서는 생략합니다. 같은 LUT를 다시 선택한 경우에도 복원 revision으로 적용 FX를 다시 계산해 원래 빛샘 위치를 복원합니다. 재현상에서는 기록 ID가 같을 때만 컷별 패턴과 설정을 복원합니다.
- `필름 컬렉션`의 추가 6종은 512×512 선형 HaldCLUT(64³)로 기존 `loadPresetLut`을 사용합니다. 입자·빛샘·렌즈는 baked-in하지 않습니다. 파일은 선택/노출 때 지연 로딩하고 기존 버전 URL·IndexedDB·PWA LUT 캐시 정책을 사용합니다. 출처는 `public/luts/film/CREDITS.md`와 PNG metadata에 보관합니다.

### 콘셉트 미리보기 / 색감 비교 (2026-10-05)

- `preview/samples.ts`는 7종 샘플, 선택 ID, 실패 재시도, thumb/master 로딩을 분리합니다. 512px WebP는 모두 캐시하고 고해상도 PNG는 비교 진입 때만 읽으며 최근 2개 참조만 유지합니다. 파일 쌍의 SHA-256 버전을 URL에 넣고 동일 URL을 PWA precache에 등록합니다.
- `preview/source.ts`는 긴 변 최대 1024의 owned 2D 캔버스로 동결합니다. 현재 장면은 한 번 크롭·미러하고, 이미 처리한 편집 사진/보관 원본에는 다시 적용하지 않습니다. 촬영 비교는 `record.originals[index]`만 사용하며 결과 `blob`을 원본으로 대체하지 않습니다. 개인 사진은 서버/설정 저장소에 보내지 않습니다.
- `usePreviewSource`는 선택·로딩·오류·최근 요청 토큰과 소유권을 관리합니다. 샘플 전환은 촬영 스트림이나 설정을 바꾸지 않습니다. 비교는 별도 원본 복사본을 사용하므로 썸네일 소스가 바뀌어도 진행 중인 렌더 입력은 유지됩니다.
- `preview/compare.ts`는 기존 export 파이프라인을 순차 재사용합니다. 기본 파라미터·FX 없음·날짜 없음·뷰티 없음·미러 false·ratio null로 원본/A/B를 렌더하고 실패/취소 때 출력 캔버스를 해제합니다. 색감만 비교하며 전체 질감을 재현한다고 표시하지 않습니다.
- 썸네일 키는 source/asset/LUT 버전·강도·FX tuple입니다. `ThumbnailCache`는 128px 출력을 최대 256개 LRU로 유지하고, IntersectionObserver로 보이는 항목부터 생성합니다. LUT 실패는 identity 결과로 성공 처리하지 않습니다.
- 비교 동안 기존 필터 시트/최근 촬영은 mounted·inactive 상태로 남겨 선택과 스크롤을 보존합니다. 활성 focus trap은 한 개이며 닫은 뒤 진입 제어로 복귀합니다. 명시적 적용은 LUT ID와 강도만 바꾸고 grainOff·패턴 seed·날짜·뷰티·수동 설정은 보존합니다.
- StudioDisclosure는 native details/summary의 화면 상태만 갖고 모든 제품 설정은 기존 부모 상태에 유지합니다. 활성 렌즈/패턴은 처음부터 펼치며 닫힌 요약에도 현재 상태와 저장 문제가 남습니다.
- 이미지 프롬프트·원본 경로·변환 방식은 `docs/sample-provenance.md`, 검증 경계는 `docs/preview-comparison-verification.md`에 기록합니다. 새 LUT 번들·새 저장 스키마·카메라 라이프사이클 변경은 없습니다.

```
┌─────────────────────────────────────────────────────┐
│ App.tsx — 모든 상태 소유 (mode, params, lutId, fx…) │
├─────────────────────────────────────────────────────┤
│ 카메라          │ useCamera (getUserMedia 래퍼)      │
│ 프리뷰/편집     │ FilterPipeline (WebGL2 싱글 패스)  │
│ 얼굴 인식       │ beauty/face.ts (MediaPipe lazy)    │
│ 필터/LUT        │ engine/lut.ts (PRESETS + 커스텀)   │
│ 썸네일          │ components/thumbs.ts (공유 파이프) │
│ 저장/공유       │ exportFiltered + utils/share.ts    │
│ PWA             │ vite-plugin-pwa + Workbox          │
└─────────────────────────────────────────────────────┘
```

## 모듈 맵

| 파일 | 역할 |
| --- | --- |
| `src/App.tsx` (~1330행) | 상태 관리 + 레이아웃 + 렌더 루프 + 저장/import |
| `src/engine/pipeline.ts` | WebGL2 파이프라인 — `FilterPipeline` 클래스, `exportFiltered` |
| `src/engine/shaders.ts` | 버텍스/프래그먼트 셰이더 (uber-shader, ~525행 GLSL) |
| `src/engine/lut.ts` | LUT 생성 함수(`buildLut`/`chain`), `.cube`/HaldCLUT 파서, PRESETS 레지스트리, 커스텀 LUT CRUD |
| `src/engine/types.ts` | `FilterParams`(16종 조절값), `FxSpec`(프리셋별 이펙트), `PARAM_DEFS` |
| `src/engine/datestamp.ts` | DSEG7 세그먼트 폰트 날짜 스탬프 (오프스크린 캔버스 렌더) |
| `src/beauty/face.ts` | FaceLandmarker lazy-load, 원유 평활/트래킹, 마스크·워프 필드 생성 |
| `src/camera/useCamera.ts` | getUserMedia, facing 전환, zoom/torch 캡처, 백그라운드 복귀 재시작 |
| `src/components/` | FilterStrip/FilterSheet/AdjustPanel/BeautyPanel/CustomLutsModal/InstallHint/ResetChip + thumbs.ts |
| `src/utils/` | `lutStore`(IndexedDB), `share`(Web Share→다운로드 폴백), `image`(EXIF 회전 디코딩) |

## 스튜디오 / 합성 촬영

- `useCreativeCapture`가 촬영 모드, 자동·수동, 완료 컷, 재촬영, 준비된 결과를 소유합니다. `changeMode`는 모드 변경 승인 여부를 반환해, 진행 중 촬영을 버리기를 거절하면 템플릿이나 편집 모드도 변경하지 않습니다.
- 기존 `CreativeSettings` 대화상자를 스튜디오의 템플릿·촬영 모드·효과 탭으로 확장합니다. 제목·탭은 고정하고 내용만 스크롤하며, 방향키/Home/End로 탭을 선택할 수 있습니다. 하단 스튜디오 버튼이 주 진입점이고 기존 메뉴 바로가기는 유지합니다.
- `capture/templates.ts`가 6종 프레임의 레이아웃·스타일을 정의합니다. `TemplateChooser`는 공유 `compositionLayout`으로 계산한 실제 비율의 도형을 표시합니다. 예시 도형은 촬영 완료 사진이 아닙니다.
- `compositionLayout`과 `drawCompositionPaper`를 실시간 `CapturePreview`와 결과 합성에 공유합니다. `layout: row`는 가로 네 컷, 선택적 `frame: memory`는 하단 여백, `frame: film`은 양쪽 필름 구멍을 추가합니다. `frame`이 없는 예전 저장 데이터는 기존 기본 여백 크기를 그대로 사용하며 IndexedDB 스키마 변경은 없습니다.
- 촬영 확인에서 `setOptions`로 프레임을 바꾸면 보유한 네 컷을 재합성합니다. 날짜는 완성본에 한 번만 더하며, `composition`을 함께 보관해 원본 재현상에도 같은 배치·여백을 유지합니다.
- 상단 최근 사진은 기존 `BlobPhoto`를 재사용합니다. 필터·일반 촬영 비율과 별개인 합성용 비율, 중앙 셔터와 기존 카메라 프레임 계산은 유지합니다.
- 하프프레임·네 컷의 메인 `frameRect`는 한 컷의 중앙 정렬 좌표를 사용합니다. `CapturePreview`는 별도 작은 고정 위치 창에서 GPU의 현재 컷과 보유 컷을 합성합니다. 크기 상태(`small/large/folded`)는 App이 세션 동안 보유하고, 원본·합성 옵션·촬영 타이머와 독립적입니다. 접으면 미리보기의 그리기 콜백을 해제하며 재확장 시 보유 컷을 다시 그립니다. 짧은 가로 화면에서도 헤더와 도크 사이에 창을 맞추고, 창의 포인터 입력은 카메라 핀치·길게 누르기로 전달하지 않습니다.
- 미리보기 배경의 alpha(.65)와 미리보기 canvas의 CSS opacity(.9)만 낮춥니다. 컨테이너·번호·버튼에는 opacity를 적용하지 않으며, 합성 canvas 픽셀·저장 파일은 불투명 상태를 유지합니다.
- `StudioFramePreview`는 스튜디오를 열 때 크롭 전 장면과 미용 마스크·워프·눈 좌표·미러 상태를 복사합니다. 실제 촬영과 같이 선택한 비율을 기존 필터 파이프라인에 전달해 렌즈 효과가 크롭 경계에 적용되고, 이후 `composeFrames`로 미리 봅니다. 같은 장면을 반복한 네 컷/예시 사진임을 명시하며, 렌즈 비교용 스냅샷과 별개로 보유합니다. 완료 컷이 있으면 그 컷은 그대로 사용합니다.
- `capture/paper.ts`의 4색 팔레트와 `FrameDecoration`을 스튜디오·촬영 확인에서 공유합니다. 선택적인 `caption`은 메모리 프레임의 하단 여백에만 그리며, 비어 있으면 이전 출력 픽셀이 그대로입니다. 캔버스 문자이므로 HTML 삽입이나 외부 사진 전송은 없습니다.
- `drawCompositionDate`는 문구 없는 예전 합성의 날짜 위치를 그대로 유지합니다. 문구가 있는 메모리 프레임에서는 한 번의 날짜 표시를 마지막 사진 안으로 옮겨 문구와 겹치지 않게 합니다. 스튜디오·촬영 결과·원본 재현상이 같은 함수와 설정을 사용합니다.
- `instant` 모드는 1장으로 완성합니다. `instantFormat: square/portrait`는 일반/네 컷 비율과 독립적이며, 7% 테두리·28% 하단 여백을 공유 레이아웃으로 계산합니다. 보관·재현상은 기존 레코드의 `mode`·`composition`으로 처리하며 IndexedDB 스키마는 변경하지 않습니다.
- `useCreativeCapture.boothInterval`은 세션 설정(기본 3, 선택 5/10초)입니다. 자동 촬영의 다음 컷 타이머에서만 사용하며, 방식과 함께 첫 컷 이후 변경을 막습니다. 스튜디오 열기/백그라운드에서 일시정지하는 기존 정책을 유지합니다.
- `STUDIO_FILMS`는 스튜디오의 선택 설명이고, 세 가지 새 프리셋은 자체 생성 LUT와 기존 질감 셰이더를 사용합니다. 새 프리셋은 기존 목록 끝에 추가하며 기존 필터 데이터는 변경하지 않습니다.

### 스튜디오 기능 리서치 (2026-10-05)

- [Dazz CAM 개발자 소개](https://apps.apple.com/us/app/dazz-cam-vintage-camera/id1422471180)는 다양한 필름/즉석사진 포맷, 원본 보관·재현상, 다중노출 등을 소개합니다. 이번 적용은 즉석사진 포맷과 기존 원본 재현상 연결입니다.
- [NOMO CAM 개발자 소개](https://apps.apple.com/us/app/nomo-cam-point-and-shoot/id1362548649)는 곡선·입자·먼지·빛샘·프레임의 조합과 다중노출, 즉석사진 현상 대기를 소개합니다. 품질 방향은 색감과 질감을 따로 다듬는 것으로 해석했으며, 강제 현상 대기나 무작위 효과는 이번에 추가하지 않습니다.
- [FUJIFILM instax mini Evo 공식 소개](https://www.instax.com/mini_evo/en/)는 렌즈 효과와 필름 효과를 독립적으로 조합하고 프레임이 포함된 사진을 저장하는 기능을 소개합니다. 이를 참고해 프레임과 필름 선택을 분리합니다.
- 위 자료는 기능 구성의 참고이며, 타사의 내부 렌더링·광학 특성을 검증한 자료는 아닙니다. 새 룩의 밝은 영역 압축·검정 들뜸·입자 강도는 이 프로젝트의 자체 설계입니다. 실제 iPhone 장면/피부톤의 미감은 임시 미리보기에서 별도 확인합니다.

## 렌더 파이프라인

### 선택형 빈티지 질감 (2026-10-05)

- `VINTAGE_PRESETS`의 구형 디지캠·일회용 필름·바랜 인화사진은 기존 필터 목록 끝의 ‘빈티지 질감’ 그룹에 추가합니다. 색감은 자체 생성 LUT, 실시간 화면과 썸네일의 질감은 기존 셰이더 조합입니다.
- 선택적인 `FxSpec.degrade`만 `renderFilteredCanvas`의 추가 사진 처리를 활성화합니다. 공유 GPU 캔버스를 먼저 소유한 2D 캔버스에 복사한 뒤, 긴 변을 강도별 최대 2400~800px로 축소하고 JPEG로 인코딩/디코딩하여 원래 출력 크기로 그립니다. 원본 소스·파일 가로세로는 바꾸지 않으며, 날짜와 프레임 문구는 뒤에 그려 디테일 저하가 글씨에 적용되지 않게 합니다.
- `deriveFx`의 기존 ‘전체 룩’ 처리가 숫자형 `degrade`도 함께 조절합니다. 0/미제공이면 추가 캔버스·압축을 수행하지 않으므로 기존 프리셋의 출력 경로는 그대로입니다. 일반·합성 촬영·스튜디오·원본 재현상은 같은 함수에서 처리하며, 디코딩 비트맵은 항상 닫습니다.
- 실시간 화면은 가벼운 근사이며 실제 저장의 압축 픽셀과 완전히 같지는 않습니다. 필터 선택 화면에 저장 시 축소·압축이 추가된다고 안내합니다. 상용 앱의 내부 알고리즘을 재현했다는 의미는 아닙니다.
- 날짜 렌더러는 DSEG7의 실제 글리프 경계로 공백 구분 그룹의 간격을 계산합니다. 숫자 `1`의 넓은 왼쪽 공백을 글자 칸과 혼동하지 않으며, 빨강·주황·세로 회전·저장이 같은 배치를 공유합니다. 기존 하이픈 날짜 포맷은 그대로입니다.

### FilterPipeline (`pipeline.ts`)

WebGL2 컨텍스트 위에 단일 풀스크린 삼각형 드로우로 모든 처리를 하는
**uber-shader** 구조다. 프리셋마다 셰이더를 바꾸지 않고 유니폼으로 제어한다.

텍스처 유닛:

| 유닛 | 내용 |
| --- | --- |
| `u_src` (0) | 소스 — 비디오 프레임 또는 편집 이미지 |
| `u_lut` (1) | 3D LUT (RGB8, `texImage3D`) |
| `u_grainTex` (2) | 생성된 그레인 타일 (`REPEAT`) |
| `u_beautyMask` (3) | 얼굴 영역 마스크 (2D 캔버스 → 텍스처) |
| `u_warp` (4) | 얼굴 워프 필드 (Float32 → FBO 렌더 또는 텍스처) |

### 프래그먼트 셰이더 처리 순서 (`shaders.ts`)

대략 이 순서로 진행한다 (모두 `u_x > 0.001` 가드로 생략 가능):

1. 소스 샘플 (`uv` 변환 — mirror/uvScale/렌즈 왜곡/픽셀화)
2. 얼굴 마스크 영역: 스무딩·톤·다크서클·잡티, face-wide(밝기/블러시/립/아이)
3. 디지캠 플래시 (`u_flash`)
4. 기본 조절 (노출/대비/채도/색온도/틴트/하이라이트/쉐도우/화이트/블랙/비브란스/명료함/페이드)
5. LUT 적용 (`u_lut` × `u_lutAmount`)
6. 공간 이펙트: soft/bloom/halation(`textureLod` 낮은 밉 사용) → vignette → dust → cnoise → band → dclip → jpeg 블록 → 레드아이(사실상 비활성)
7. 선명도, 그레인, 날짜 프레임 등

### 프리뷰 vs 익스포트

- **프리뷰**: `new FilterPipeline(canvas, { preserve: false })` — 픽셀
  리드백이 없어 `preserveDrawingBuffer`를 꺼서 프레임당 복사 비용 절약.
  `requestAnimationFrame` 루프에서 `setSource(video)` → `render()`.
- **익스포트**: 별도 지연 생성 파이프라인(`expPipe`) — `preserve: true`
  (toBlob 필요). 소스 원본 해상도로 렌더 → 필요 시 날짜 스탬프를 2D 캔버스로
  합성 → `toBlob('image/jpeg', 0.95)`.

### 핏/정렬

`render(opts)`의 `fit`:

- `cover` (기본): 캔버스를 꽉 채우고 소스를 크롭 — 썸네일용
- `contain`: 프레임을 뷰포트 안에 맞춤 — 프리뷰/익스포트.
  카메라 프리뷰는 모든 비율에서 `valign: 'center'`로 중앙 정렬하며,
  편집 모드/익스포트도 기본 중앙 정렬을 쓴다.

프레임 사각형은 `frameRect`(카메라) / `imgRect`(편집, 이미지 종횡비)가
계산하고, 격자/날짜/그레인 칩 오버레이가 같은 좌표를 쓴다.
**GL 렌더와 오버레이가 반드시 같은 정렬을 써야 한다** — 어긋나면 격자가
사진 가장자리를 벗어난다 (troubleshooting 참고).

## 카메라 (`useCamera.ts`)

- `facingMode: ideal` + `width/height ideal 4032×3024`, 4:3 우선
- `track.getCapabilities().zoom` → 줌 프리셋 버튼 노출 여부 결정
- 전면 프리셋은 해당 트랙의 범위 안에 있는 0.5·1로 제한합니다. 후면 렌즈 수·화면 폭 기반 3·5배 추정은 후면에만 적용하며, 전환 시 다시 계산합니다. 0.5 미지원/범위 미제공 시 가짜 0.5 버튼을 만들지 않고 선택지가 하나뿐이면 줌 버튼 영역을 숨깁니다. 핀치 줌과 실제 줌 값 재조회는 유지합니다.
- 줌 제약 적용 후 `getSettings().zoom`을 다시 읽어 실제 값만 표시합니다. 선택 제약이 무시되거나 값이 제공되지 않으면 요청값을 성공값으로 가정하지 않습니다. 전환 전 트랙의 늦은 응답은 현재 줌 상태를 바꾸지 않습니다.
- `inspectCamera`는 활성 트랙의 실제 방향·해상도·줌 범위와 값을 읽습니다. `CameraInfo`는 메뉴의 접을 수 있는 정보 영역이며 열기·카메라 준비·전환·줌 변경 시 재조회합니다. 미제공 범위와 고정 범위는 구분하고, 장치 ID·사진 데이터는 표시·저장·전송하지 않습니다. 웹 값이 기본 카메라의 배율과 같다는 가정은 하지 않습니다.
- `torch` capability → 햄버거 메뉴 토치 토글
- `enumerateDevices`로 후면 카메라 수 추정 (라벨 없으면 개수 기반)
- 전면 진입 시 웹 줌이 제공되면 트랙의 최소 줌을 요청합니다. 최소값은 0.5나 1로 가정하지 않으며, 실제 적용값을 다시 읽습니다.
- 전면은 `visibilitychange` 숨김/`pagehide`에서 스트림을 중지·분리하고 촬영을 비활성화합니다. 복귀/`pageshow`에는 새 스트림을 한 번만 연결하고 마지막으로 확인된 실제 줌을 새 트랙의 범위 안에서 복원합니다. 줌 API가 없어도 새 스트림을 연결하며, App의 비율·필터 상태는 유지합니다. 빠른 재숨김 시 재연결을 연기하고, 이전 요청의 늦은 응답은 중지·무시합니다.
- 후면은 기존처럼 `visibilitychange` 복귀 시 트랙 `ended`/비디오 `readyState<2`면 `nonce++`로 재시작합니다. 살아 있는 후면 스트림은 재사용합니다.
- `useCamera(enabled)`: 편집 모드는 disabled. 트랙을 stop하고 비디오 연결을
  해제한다. 촬영 모드로 복귀하면 새 스트림을 시작한다.

## 얼굴 인식 / 뷰티 (`beauty/face.ts`)

- `@mediapipe/tasks-vision`을 **dynamic import** — 뷰티/레드아이 필요 시에만
  로드 (메인 번들 468KB → 325KB로 분리된 이유)
- `FilesetResolver.forVisionTasks('/wasm')` + `/models/face_landmarker.task`
- `numFaces: 3`, `runningMode: 'VIDEO'`, blendshapes 출력(눈깜빡임 감지)
- 검출 간격 ~240ms, `smoothAndTrack`이 OneEuro류 평활 + 프레임 간 매칭
  (`MATCH_D`, `MAX_MISS`)으로 떨림 억제
- 마스크 채널: R=피부 스무딩 영역, G=윤곽 림, B=눈/입술 제외, A=코어/밴드
- 워프(눈 확대/턱/코/소두): 랜드마크 변위 필드를 2D 캔버스 또는 FBO로
  렌더해 `u_warp` 텍스처로 전달
- 셰이더는 `u_beautyMask`/`u_warp`가 실질 0이면 얼굴 블록 전체를 건너뜀

## LUT 시스템 (`lut.ts`)

- `buildLut(chain(f…))`: 33³(또는 지정 크기) 그리드에 함수 체인을 적용해
  `Uint8Array` LUT 생성 — 모든 프로시저럴 프리셋이 이 방식
- `parseCube`: `.cube` 텍스트 파서 — `#` 주석, `LUT_3D_SIZE`, 키워드 라인
  스킵, CR-only 라인은 `trim()`으로 제거. 데이터 라인 수 ≠ size³×3 이면 에러
- `parseHaldPng`: HaldCLUT/lookup PNG 디코딩 (`HALD_N` 레이아웃)
- `PRESETS`: `{ id, label, group, build?|file?, fx? }` — `file`은 `/luts/…` fetch
- 커스텀 LUT: `addCustomLut`가 IndexedDB(`oc-store/lut-files`)에 바이너리 저장,
  목록 메타는 `localStorage['oc-custom']`의 `CustomEntry[]`
- import는 파싱 후 IDB 트랜잭션 완료를 기다리고 목록을 등록한다. 목록 쓰기가
  실패하면 새 바이너리를 정리한다. 삭제도 IDB 완료 후 목록을 갱신하며, 목록
  갱신 실패 시 원래 바이너리를 복원한다. 두 저장소 사이 완전한 원자성은 없다.
- 실패한 로드 Promise는 메모리 캐시에서 제거한다. HTTP 상태와 파싱 성공을
  확인한 뒤 프리셋 바이너리 캐시를 쓴다. 손상된 프리셋 캐시는 다시 가져온다.
- "현재 설정을 LUT로 굽기": identity 그리드를 현재 파이프라인에 통과시켜
  새 HaldCLUT PNG로 저장. 점별 색상 조절과 LUT 강도만 포함하고 공간·뷰티·
  프리셋 이펙트는 제외한다. 성공하면 색상 조절을 초기화하고 강도를 1로 설정한다.
  생성 중 설정 변경 시 목록에만 저장한다. 생성용 GL 컨텍스트는 재사용한다.

## 썸네일 (`thumbs.ts`)

- 별도 오프스크린 `FilterPipeline`(128px) 하나를 공유
- `setSource`는 루프 밖에서 **한 번만** — 프리셋마다 텍스처 재업로드하던
  것을 고쳐 시트 오픈이 빨라짐
- `thumbCache: Map<srcKey:presetId, canvas>` — 소스 바뀌면 해당 키만 재생성,
  다른 편집 이미지의 캐시는 정리
- 직렬화: `cachePromise` 체인으로 동시 빌드 방지

## 상태/지속성

`App.tsx`가 거의 모든 상태를 소유. localStorage 키:

| 키 | 내용 |
| --- | --- |
| `oc-grid` | 격자 on/off |
| `oc-settings-summary` | 선택형 설정 요약 창 표시 (기본 꺼짐) |
| `oc-timer` | 셀프 타이머 (0/3/10) |
| `oc-datemode` | 날짜 스탬프 on/off |
| `oc-datefmt` / `oc-datesize` / `oc-dateorient` | 스탬프 포맷/크기/방향 |
| `oc-custom` | 커스텀 LUT 목록 메타 (바이너리는 IndexedDB) |
| `izi-install-dismissed` | 설치 힌트 닫음 |

조절값(`params`)은 **저장하지 않음** — 세션마다 `DEFAULT_PARAMS`로 리셋.

## PWA / 배포

- `vite-plugin-pwa` `generateSW` + `registerType: 'autoUpdate'`
- precache: JS/CSS/HTML/icons/fonts 등 ~473KB
- `wasm/`(34MB)·`models/`는 **precache 제외** → 첫 설치 용량 절약,
  사용 시 `oc-ml` CacheFirst 런타임 캐시
- `/luts/*`는 `oc-luts` CacheFirst — 한 번 쓴 필터는 오프라인 동작
- `luts/wasm/models`의 파일명·내용을 SHA-256으로 해시해 `?v=<16자리>`를
  요청 URL에 붙인다. WASM loader/binary와 모델도 같은 버전을 사용한다.
  프리셋 IDB 키는 `lut-v2-<assetVersion>-<id>`이고 사용자 LUT 키는 유지한다.
  public 자산 변경 후에는 개발 서버를 재시작해야 새 버전이 계산된다.
- `vercel.json`: `/`, `sw.js`, `manifest.webmanifest` → `no-cache`,
  `luts|wasm|models` → immutable 1년, SPA rewrite → `/index.html`
- 배포: `npx vercel --prod` (프로젝트: `leneu/open-camera`,
  URL: `open-camera-leneu.vercel.app` — `open-camera.vercel.app`은 타인 점유)

## iOS 특이사항

- 홈 화면 이름: `apple-mobile-web-app-title`(index.html) + manifest
  `short_name` 둘 다 필요
- 카메라 권한은 origin별 1회 — **Safari와 설치된 PWA는 별도 컨텍스트**
- 파일 선택 `accept`에 `.cube` 같은 미등록 확장자를 넣으면 iOS가 선택을
  막는다 — `accept`를 빼고 JS에서 확장자 검증
- 설치 힌트는 `display-mode: standalone`이면 숨김

## 설정 확인 (`SettingsSummary.tsx`, `SettingsOverview.tsx`)

- App이 현재 CameraSettings와 촬영/편집 모드, 합성 배치, 날짜 실제 활성 상태,
  필터 지원 여부를 읽어 SettingsSnapshot을 만든다. 확인 화면은 값을 복사해
  따로 저장하거나 카메라에 제약 조건을 적용하지 않는다. 웹 줌은 능력 범위의
  최솟값이 아니라 `inspectCamera()`의 실제 트랙 설정을 사용하며 미제공은 명시한다.
- 요약 표시는 기본 꺼짐이며 localStorage 실패에도 세션 동작은 유지한다.
  다른 시트가 열리면 요약은 숨기되 기존 노드는 유지한다. 네 컷 진행 표시와
  합성 창, 필터 목록, dock, visualViewport의 실제 크기에 맞춰 배치한다. 공간이 부족하면
  펼칠 수 없는 접기 버튼 대신 전체 설정 dialog 진입 버튼으로 축약한다.
- CapturePreview는 요약 표시를 켠 경우에만 그 영역을 피한다. 꺼짐일 때 기존
  합성 창 배치는 그대로다. 크기 변경으로 숨겨지는 요약 내부의 키보드 포커스는
  진입 버튼으로 복원하며, 다른 dialog의 포커스를 가져오지 않는다.
- 전체 확인은 읽기 전용이다. 보정/뷰티 기본값은 선택해서 표시하고, 저장되어
  있지만 현재 모드에서 적용되지 않는 설정은 구분한다. 편집 링크는 확인창을
  닫고 기존 UI로 이동하며 첫 컷 잠금과 합성 재현상의 뷰티 미지원 제한을 유지한다.
  닫기/Escape는 원래 진입점 또는 메뉴로 포커스를 복원한다.
- Studio의 탭은 기존 tablist/키보드 동작을 유지한 분할 선택형이다. 도움말만
  접히며 기존 효과 취소/해제와 촬영 설정의 의미는 바뀌지 않는다.

## 빈티지 우연성 (`variation.ts`, `useFilmVariation.ts`)

- 선택형 추가 효과이며 새 필터/촬영 모드가 아니다. 기본은 `off`, 네 강도는
  입자 20% / 빛샘 15% / 먼지 10% / 색 편차 15%. `oc-film-variation`에는 버전 1
  설정만 보관하고, 매 컷 모드의 임시 seed는 고정 seed로 저장하지 않는다.
- 프리셋의 전체 룩/은은한 질감 처리 뒤에 순수 resolver로 추가한다. 추가 상한은
  grain .35 / leak .30 / dust .12, 최종 0–1 clamp. 색 편차는 노출 ±.08 EV,
  색온도 ±.04, 틴트 ±.02 × 강도이며 PARAM_DEFS의 범위를 지킨다.
  0%는 추가량만 끄며 기존 프리셋 효과를 지우지 않는다. grainOff는 프리셋과
  추가 FX 입자를 끄되 수동 params.grain 동작은 바꾸지 않는다.
- `FilmPattern { version: 1, seed }`의 seed는 유한한 [0, 1). 버전 1 Mulberry32
  입자 타일과 별도 색 편차 스트림을 사용한다. pattern이 있는 경우에만 GPU의
  시간값을 고정한다. 렌더러당 새 텍스처 한 장을 재사용하고 패턴 변경 시 삭제,
  context 복구 시 동일 seed로 재생성한다. 꺼짐은 기존 랜덤 타일/시간 경로 그대로다.
- 설정 조절·화면 복귀는 seed를 소비하지 않는다. 일반 사진은 성공한 인코딩 뒤,
  합성 컷은 성공한 프레임 생성 뒤 다음 seed를 준비한다. 공유 취소/저장 재시도는
  이미 생성한 패턴을 다시 소비하지 않는다. 네 컷은 첫 컷의 설정을 고정하면서
  매 컷 모드의 패턴만 컷별로 바꾼다.
- 레시피 버전 1과 `oc-recipes`를 유지한다. 누락된 설정은 꺼짐, 잘못된 새 값은
  전체 설정 적용 전에 거절한다. 손상된 저장값은 자동 삭제/덮어쓰기하지 않는다.
  저장 실패 시 현재 실행의 조절·촬영을 유지하고 안내한다.
- CaptureRecord.framePatterns는 선택적 컷별 배열이다. normal/instant는 1,
  half/double은 2, booth는 4개. null은 해당 컷의 추가 효과가 꺼졌음을 뜻한다.
  기존 기록에는 메타데이터가 없어도 보관함이 열리며 잘못된 배열/버전은 재현상만
  거절한다. 원본 없는 사진은 다시 현상할 수 없다.
- 재현상은 독립적인 작업 배열과 컷별 추가 강도를 복원한다. 일부 컷이 꺼진
  사진도 활성 컷의 강도와 null 슬롯을 유지하며 명시적인 조절 뒤에만 전체 설정을
  바꾼다. 재추첨은 전체 컷, 고정은 마지막 컷의 패턴을 전체 컷에 적용한다.
  마지막 컷이 꺼짐이면 새 패턴으로 고정한다. 저장은 새 기록을 만들며 기존
  기록은 덮어쓰지 않는다. 원본은 기존 ‘원본도 보관’ 선택 시에만 복사한다.
  보관 한도 10개/50 MiB의 기존 정리 규칙은 그대로다.
- GPU 패턴 생성 실패는 복구 안내를 표시한다. 실시간 루프는 유지하므로 효과를
  끄고 안내를 닫으면 기존 카메라 미리보기로 돌아갈 수 있다.
- seed 재현은 질감/색 편차의 재사용이지 최초 촬영본의 픽셀 단위 복원 약속이
  아니다. 원본 크롭·미용·JPEG·브라우저 차이가 결과에 영향을 줄 수 있다.
