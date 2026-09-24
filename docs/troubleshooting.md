# 트러블슈팅 / 겪은 이슈 모음

배포·개발 중 실제로 겪은 문제와 해결법. 재발 방지용으로 증상 → 원인 → 조치 순으로 정리.

## 배포 / Vercel

### `npx vercel` 실패 — npm 캐시 EACCES/EEXIST

**증상**: `npm error code EEXIST … _cacache … EACCES`
**원인**: `~/.npm` 캐시 일부가 다른 사용자/root 소유로 섞임
**조치**: 프로젝트 로컬 캐시로 우회
`npm_config_cache=/path/to/repo/.npm-cache npx vercel …`
(`.npm-cache/`는 `.gitignore`에 있어야 함)

### Vercel 로그인

`vercel login` → `vercel.com/device`에 표시된 코드 입력.
브라우저에서 GitHub 승인하면 CLI가 이어서 진행된다.

### 배포 도메인이 프로젝트명과 다르게 잡힘

**증상**: 프로젝트를 `open-camera`로 rename했는데도 프로덕션 URL이
`open-camera.vercel.app`이 아님. 해당 도메인 접속 시 **전혀 다른 사이트**가 뜸.
**원인**: `open-camera.vercel.app`은 다른 Vercel 사용자가 이미 점유.
이름이 겹치면 `{project}-{team}.vercel.app` 형태로 배정된다.
**조치**: 우리 프로젝트의 실제 도메인은 `open-camera-leneu.vercel.app`.
CLI 재배포(`vercel --prod`)하면 alias가 자동 배정된다.
프로젝트 rename은 API로도 가능:

```
PATCH /v9/projects/{projectId}?teamId={teamId}  { "name": "open-camera" }
```

(토큰은 `~/Library/Application Support/com.vercel.cli/auth.json`의 `token`)

### 새 도메인이 로그인 페이지로 리다이렉트 (302 → vercel.com/sso-api)

**증상**: `-leneu` 접미사 도메인만 SSO 로그인으로 튕기고 기본 도메인은 열림.
**원인**: 팀 기본값으로 `ssoProtection: all_except_custom_domains`가 켜져 있어
프로젝트 도메인이 인증 대상이었다.
**조치**: 프로젝트 PATCH로 해제

```
PATCH /v9/projects/{id}  { "ssoProtection": null }
```

### Git push 시 자동 배포가 안 됨

Vercel GitHub 앱이 계정에 설치/승인되지 않아 repo 연결이 실패한 상태.
`vercel git connect` 또는 대시보드 → Settings → Git에서 연결하면 됨.
지금은 CLI 수동 배포만 가능.

## iOS / Safari

### `.cube` 파일을 선택할 수 없음

**증상**: LUT 가져오기에서 `.cube`가 회색/선택 불가.
**원인**: `<input accept=".cube,.png,…">` — iOS는 `.cube`를 아는 UTI가 없어서
accept 필터가 파일을 막는다.
**조치**: `accept` 속성 제거 + `importLut`에서 JS로 확장자 검증
(`/\.(cube|png|jpe?g)$/i`). 이미지 외 파일이 들어와도 에러 토스트로 처리.

### 홈 화면 아이콘 이름이 "oC"로만 표시

**원인**: `apple-mobile-web-app-title`이 `oC`였음 (manifest short_name도).
**조치**: 둘 다 `Open Camera`로 변경. **이미 추가된 아이콘은 이름이 안 바뀜** —
삭제 후 다시 "홈 화면에 추가"해야 함.

### 카메라 권한을 매번 묻는 것처럼 보임

- origin(도메인)별로 기억 — trycloudflare 같은 임시 터널 도메인은 매번 바뀌어
  매번 묻는 것처럼 보인다. 고정 도메인이면 최초 1회.
- Safari 브라우저와 홈 화면 PWA는 **별도 권한 컨텍스트** — 각각 한 번씩 승인 필요.
- iOS 17+ 프롬프트에서 "기억하기/항상 허용" 선택 필요.

### 백그라운드 복귀 시 카메라가 멈춤/검은 화면

`visibilitychange`에서 트랙 `ended` 또는 `video.readyState < 2`면
`nonce`를 올려 `getUserMedia`를 재실행 (`useCamera.ts`).

## 렌더링 / 레이아웃

### 격자·날짜 스탬프가 사진 가장자리와 어긋남

**증상**: 3:4에서 격자선이 사진 밖 검정 영역까지 내려옴.
**원인**: `frameRect`(오버레이 좌표)만 하단 정렬로 바꾸고
`pipeline.render`의 contain 뷰포트는 여전히 중앙 정렬(`vy=(ch-vh)/2`).
**조치**: `RenderOpts.valign: 'bottom'` 추가, 카메라 프리뷰에 지정.
**교훈**: GL 뷰포트와 DOM 오버레이의 정렬은 항상 같이 바꿀 것.
편집 모드/익스포트는 중앙 정렬 유지.

### 프리뷰가 까맣거나 익스포트가 검은 이미지

- `preserveDrawingBuffer: false`(프리뷰)에서는 `toBlob`/`drawImage`가
  빈 버퍼를 읽을 수 있다 → 익스포트용 `expPipe`는 `preserve: true` 유지.
- WebGL 컨텍스트 로스: `webglcontextlost`에 `preventDefault` +
  `webglcontextrestored`에서 `initGL()` 재실행.

### 사진 상단이 어둡게 그라데이션처럼 보임

**원인**: 앱 요소가 아님 — 3:4 레터박스(사진이 viewer보다 짧음)의 검정 밴드
+ 사진 상부가 어두운 장면 + LUT 섀도 크러시가 겹쳐 보인 것.
코드에 스크림/그라데이션 요소는 없다. 확인: "원본보기" 길게 눌러 비교.

### 필터 목록 위 빈 여백이 김

**원인**: 레터박스 + 스트립 상단 패딩 + 쉐브론이 프레임 하단에 붙는 구조.
**조치**: 프레임 하단 정렬 + `padding-top` 14→8 / 스트립 8→6.

## LUT / 파서

### `.cube` 파싱 실패 "지원하지 않는 .cube 파일입니다"

- 데이터 라인 수가 `size³×3`과 안 맞으면 이 에러.
- 흔한 원인: 파일 끝 빈 라인, CR-only(`\r`) 라인 — `trim()`으로 걸러짐.
- 대문자 키워드 라인(`TITLE`, `DOMAIN_MIN` 등)은 자동 스킵.
- 1D LUT(`LUT_1D_SIZE`)나 size 힌트 없는 파일은 미지원.

### LENEU 시리즈가 목록에 없음

의도된 제거 — 외부 제작자 LUT(rossandhisjpegs 표기 등)라 번들에서 뺐다.
개인 사용은 햄버거 메뉴 → LUT 가져오기(다중 선택 가능)로 각자 등록.
원본은 리포 밖(Downloads)에 보관.

### 썸네일이 안 뜨거나 느림

- 썸네일은 공유 `FilterPipeline`에서 순차 생성 — 샘플 이미지
  (`/samples/sample1.png`) 로드 실패 시 카메라 프레임으로 폴백.
- `thumbCache`는 `srcKey`별 관리 — 편집 이미지가 바뀌면 이전 편집분 캐시는 삭제.

## 성능 관련 (의도된 트레이드오프)

- **MediaPipe dynamic import**: 뷰티 미사용 시 143KB 번들을 아예 안 받음.
  첫 뷰티 진입 시 로딩 살짝 있음 (정상).
- **`generateMipmap` 매 프레임**: bloom/halation/soft가 `textureLod`로 낮은
  밉을 샘플하기 위해 필요. 발열이 문제 되면 저해상도 FBO 패스로 교체 검토.
- **uber-shader 분기**: `if (u_x > 0.001)` 유니폼 가드는 거의 무비용 —
  프리셋별 셰이더 분리는 복잡도 대비 이득 없음.
- **wasm/models precache 제외**: 37MB를 설치 시 받지 않아 초기 설치가 가볍다.
  대신 첫 뷰티 사용은 온라인 필요.

## 개발 환경

- `npm run dev`는 `--host` 포함 — LAN으로 실기기 접속 가능.
  단, iOS는 `getUserMedia`가 HTTPS/localhost만 허용 → 실기기는 터널이나
  배포 URL로 테스트.
- `vite.config.ts`의 `server.allowedHosts`에 터널 도메인 패턴 등록돼 있음.
- 타입 체크는 `npm run typecheck` (`tsc -b --noEmit`), 빌드 시에도 실행됨.
