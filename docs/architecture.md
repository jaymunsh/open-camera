# open-camera 아키텍처

iOS 카메라 경험을 목표로 한 설치형 PWA. WebGL2 싱글 패스 셰이더로
실시간 필터/이펙트를 처리하고, MediaPipe로 얼굴 인식 보정을 한다.

## 전체 구조

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

## 렌더 파이프라인

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
- 줌 제약 적용 후 `getSettings().zoom`을 다시 읽어 실제 값만 표시합니다. 선택 제약이 무시되거나 값이 제공되지 않으면 요청값을 성공값으로 가정하지 않습니다. 전환 전 트랙의 늦은 응답은 현재 줌 상태를 바꾸지 않습니다.
- `inspectCamera`는 활성 트랙의 실제 방향·해상도·줌 범위와 값을 읽습니다. `CameraInfo`는 메뉴의 접을 수 있는 정보 영역이며 열기·카메라 준비·전환·줌 변경 시 재조회합니다. 미제공 범위와 고정 범위는 구분하고, 장치 ID·사진 데이터는 표시·저장·전송하지 않습니다. 웹 값이 기본 카메라의 배율과 같다는 가정은 하지 않습니다.
- `torch` capability → 햄버거 메뉴 토치 토글
- `enumerateDevices`로 후면 카메라 수 추정 (라벨 없으면 개수 기반)
- `visibilitychange` 복귀 시 트랙 `ended`/비디오 `readyState<2`면
  `nonce++`로 재시작 — iOS에서 앱 전환 후 카메라가 죽는 문제 대응
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
