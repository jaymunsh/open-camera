# open-camera (oC)

iOS 카메라 경험을 목표로 한 설치형 웹 카메라 필터 PWA.
WebGL2 셰이더 파이프라인 위에서 실시간 필터/프로시저럴 이펙트를 처리합니다.

**Live**: https://open-camera.vercel.app

> **지원 환경**: iOS(Safari/WebKit) 위주로 개발·검증되었습니다.
> UI/제스처/설치 흐름 모두 iOS 기준이며, Android·데스크탑 브라우저에서는
> 동작하더라도 일부 기능(카메라, 설치, 공유 등)이 다르게 동작할 수 있습니다.

## 기능

- **실시간 카메라 프리뷰** — 전/후면 전환, 핀치 줌 + 프리셋 줌 버튼
- **필터** — 프로시저럴 LUT(자체 생성) + HaldCLUT 필름 시뮬레이션, 강도 조절
- **디지캠 이펙트** — JPEG 아티팩트, 저가 렌즈(배럴 왜곡/코너 소프트니스), CCD 블루밍/핫픽셀, 플래시, 수직 스미어, 레드아이(얼굴 인식 기반), 색수차, 먼지, 라이트 리크, 할레이션, 그레인 등
- **일본풍 프리셋** — UTSURUN / SHINSEN / TOUMEI / MORI / SHOWA / NEON / MIDORI
- **날짜 스탬프** — DSEG7 세그먼트 폰트, 포맷/크기/가로·세로 방향 설정
- **뷰티/보정** — MediaPipe 얼굴 랜드마크 기반 스킨 스무딩, 눈/턱/코/소두 워프, 블러시/립 등 (최대 3인)
- **사진 편집** — 불러온 사진에 동일 파이프라인 적용, 원본 비교(길게 누르기)
- **커스텀 LUT** — `.cube` / HaldCLUT PNG 다중 import, 이름 변경/삭제, 현재 설정을 LUT로 굽기
- **즐겨찾기/최근 사용** — 필터 즐겨찾기 + 최근 5개
- **PWA** — 홈 화면 설치, 오프라인 동작 (서비스 워커), 고해상도 JPEG 저장/공유

## 기술 스택

- React 19 + Vite + TypeScript
- WebGL2 (3D LUT 텍스처 + 싱글 패스 이펙트 셰이더)
- MediaPipe Face Landmarker (얼굴 인식, lazy-load)
- vite-plugin-pwa + Workbox (서비스 워커)

## 개발

```bash
npm install
npm run dev        # --host로 LAN 공개 (실기기 테스트용)
```

## 빌드 / 검증

```bash
npm run build      # tsc 타입체크 + vite build → dist/
npm run preview    # 빌드 결과 로컬 서빙
npm run typecheck
```

## 배포 (Vercel)

`vercel.json` 포함 — 저장소를 Vercel에 연결하면 자동 감지됩니다.

- Framework: **Vite** (자동)
- Build: `npm run build` / Output: `dist`
- `sw.js`·`index.html`은 `no-cache`, `luts|wasm|models`는 immutable 캐시 헤더 적용

CLI 배포: `npx vercel` (프로젝트 루트에서)

### iOS 설치

https://open-camera.vercel.app 를 Safari로 열고 공유 → **홈 화면에 추가**.
독립 앱으로 동작하며 카메라 권한은 최초 1회만 묻습니다.

## 구조

```
src/
  engine/    WebGL 파이프라인, 셰이더, LUT 파서/프리셋, 날짜 스탬프
  beauty/    MediaPipe 얼굴 추적, 뷰티 마스크/워프 필드
  components/ 필터 스트립/시트, 조절·뷰티 패널, 썸네일, 커스텀 LUT 모달
  camera/    getUserMedia 훅
  utils/     이미지 로딩, LUT 저장소(IndexedDB), 공유
public/
  luts/film/ HaldCLUT 필름 LUT (RawTherapee/Natron, CC BY-SA — CREDITS.md 참조)
  wasm/      MediaPipe WASM 런타임
  models/    face_landmarker.task
docs/        뷰티 설계, LUT 출처/라이선스 추적
```

## 커스텀 LUT

햄버거 메뉴 → **LUT 가져오기**에서 `.cube` 또는 HaldCLUT PNG를 선택
(여러 개 동시 선택 가능). 등록된 LUT는 기기 IndexedDB에 저장되며
"커스텀 LUT 관리"에서 이름 변경/삭제할 수 있습니다.
앱 삭제 시 함께 지워지니 원본 파일은 따로 보관하세요.

## 라이선스 / 출처

- 필름 LUT: RawTherapee Film Simulation / Natron CLUT — **CC BY-SA 4.0**
  (`public/luts/film/CREDITS.md`, 앱 내 메뉴 → 라이선스)
- Lookup 텍스처: GPUImage — BSD (`public/licenses/gpuimage-bsd.txt`)
- 얼굴 인식: MediaPipe — Apache 2.0 (`public/licenses/apache-2.0.txt`)
- 날짜 폰트: DSEG7 — SIL OFL (`public/fonts/LICENSE-dseg.txt`)
- 상표 안내: 필터명의 필름 이름들은 룩 식별 목적이며 각 상표권자와 무관합니다
- 세부 출처 추적: `docs/lut-provenance.md`
