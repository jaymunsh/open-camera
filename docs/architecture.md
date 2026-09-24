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
4. LUT 적용 (`u_lut` × `u_lutAmount`)
5. 기본 조절 (노출/대비/채도/색온도/틴트/하이라이트/쉐도우/화이트/블랙/비브란스/명료함)
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
  `valign: 'bottom'`이면 수직 레터박스를 하단 정렬(카메라 프리뷰),
  기본은 중앙(편집 모드/익스포트).

프레임 사각형은 `frameRect`(카메라) / `imgRect`(편집, 이미지 종횡비)가
계산하고, 격자/날짜/그레인 칩 오버레이가 같은 좌표를 쓴다.
**GL 렌더와 오버레이가 반드시 같은 정렬을 써야 한다** — 어긋나면 격자가
사진 가장자리를 벗어난다 (troubleshooting 참고).

## 카메라 (`useCamera.ts`)

- `facingMode: ideal` + `width/height ideal 4032×3024`, 4:3 우선
- `track.getCapabilities().zoom` → 줌 프리셋 버튼 노출 여부 결정
- `torch` capability → 햄버거 메뉴 토치 토글
- `enumerateDevices`로 후면 카메라 수 추정 (라벨 없으면 개수 기반)
- `visibilitychange` 복귀 시 트랙 `ended`/비디오 `readyState<2`면
  `nonce++`로 재시작 — iOS에서 앱 전환 후 카메라가 죽는 문제 대응

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
- "현재 설정을 LUT로 굽기": identity 그리드를 현재 파이프라인에 통과시켜
  새 `.cube`급 LUT 데이터로 저장

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
