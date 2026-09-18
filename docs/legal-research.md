# 오픈소스/PWA 배포 법적 리서치 — 필터·LUT 관련

> 작성일: 2026-09-18
> 주의: 이 문서는 법률 자문이 아니라 기술적 리스크 정리 자료다. 실제 배포 전
> 중요한 결정은 변호사 상담 권장.

## TL;DR

- **"필름 룩" 자체는 보호되지 않는다.** 특정 색감/스타일을 직접 구현해서
  흉내 내는 것은 합법이다. 저작권은 "표현(파일/코드)"을 보호할 뿐 "룩"이라는
  아이디어를 보호하지 않는다.
- **남이 만든 LUT 파일(.cube, .3dl, HaldCLUT PNG)을 번들하는 것이 핵심 리스크다.**
  LUT 파일은 창작 데이터로서 저작권/라이선스 대상이며, 시중 LUT 팩 대부분은
  재배포를 명시적으로 금지한다.
- **필름 이름(Portra, Velvia 등)은 상표다.** 업계 관행상 필터 이름으로
  널리 쓰이지만 상표권자가 문제 삼을 여지가 있다. 완충 장치(이름 변경 또는
  고지)를 두는 게 안전하다.
- **카메라/소프트웨어에서 추출한 LUT는 절대 번들 금지.** 후지 공식 배포
  LUT도 재배포 조건이 불명확해 선례상 제거하는 추세다.
- **사용자가 .cube를 직접 import 하는 기능 자체는 문제없다.** 에뮬레이터와
  ROM의 관계처럼, 파일 선택 책임은 사용자에게 있다.

---

## 1. LUT 파일(.cube 등)의 법적 지위

### 1-1. LUT 파일은 저작권 보호 대상이 될 수 있음

LUT는 단순 숫자 나열처럼 보이지만, 색보정가의 창작적 선택(톤 커브, 색역 매핑
등)이 담긴 데이터 파일로서 실무상 저작물로 취급된다. 따라서:

- **구매한 LUT 팩**: 사실상 전부 "개인 라이선스, 재배포/재판매 금지".
  예: Fujify — "Every product is licensed to a single individual...
  redistribution, resale or sharing ... is strictly prohibited."
  (https://fujify.me/en-gbp/pages/faq)
- **무료 배포 LUT**: "무료 다운로드" ≠ "재배포 허용". 대부분 라이선스 문구가
  없어서 애매하다. 명시적 라이선스(CC0, CC-BY 등)가 없으면 번들하지 않는 게
  원칙.
- **카메라 제조사 공식 LUT**: 후지가 공식 사이트에서 배포하는 F-Log LUT,
  X100VI의 Eterna/WDR LUT 등은 재배포 조건이 불명확하다. 오픈소스 프로젝트
  FilmFrame은 이 이유로 번들 후지 LUT를 제거한 선례가 있다:
  "The X100VI Eterna / Eterna BB / WDR .cube files come from Fujifilm's
  official support download — redistribution terms aren't clear, so don't
  ship them in a public repo."
  (https://github.com/ryuheiyokokawa/FilmFrame/commit/5b4606f4a834dc33885b5acb1904babb55ad00ef)

### 1-2. "룩"은 보호되지 않음 — 직접 만들면 OK

- 색 변환의 *결과*(Portra 같은 따뜻한 피부톤) 자체는 아이디어/스타일 영역이라
  저작권 보호 대상이 아니다.
- **측정 기반 자체 제작**이 안전한 표준 방법이다. 대표 사례: Stuart Sowerby의
  Fuji 필름 시뮬레이션 LUT 팩 — 후지 "RAW FILE CONVERTER" 출력을 기준 이미지에
  적용해 측정하고 그 결과로 LUT를 생성한 것으로, 10년 가까이 공개 배포되고
  G'MIC에도 포함되어 있다.
  (https://blog.sowerby.me/fuji-film-simulation-profiles/)
- 즉 "실제 필름/카메라 출력을 측정해서 유사 변환을 직접 생성"하는 것은
  clean-room 방식이라 파일 복제 문제가 없다. 현재 프로젝트의 `buildLut()`로
  수식 조합해 만드는 방식도 이에 해당 — 가장 깨끗한 방법.

### 1-3. 사용자 import 기능

`loadLutFile()`처럼 사용자가 자기 .cube/.png를 불러오는 기능은 법적으로
안전하다. 앱이 LUT를 배포하는 게 아니라 사용자가 자기 파일을 쓰는 것이므로.
대신 UI/문서에 "사용권한이 있는 LUT만 불러오세요" 정도 안내를 두면 좋다.

---

## 2. 상표 이슈 — 필름 이름

### 2-1. 등록상표인 이름들

다음은 전부 상표권이 있는 이름이다:

| 상표 | 권리자 |
| --- | --- |
| Portra, Ektar, Kodachrome, Ektachrome, Tri-X, T-Max, Gold | Kodak / Kodak Alaris |
| Velvia, Provia, Astia, Superia, Acros, Neopan | Fujifilm |
| Classic Chrome, Eterna, Reala Ace, Nostalgic Neg (필름 시뮬레이션명) | Fujifilm |
| HP5, Delta, FP4 | Ilford (Harman) |
| CineStill | CineStill |
| Polaroid | Polaroid |

### 2-2. 실무 관행 vs 리스크

- 실무적으로 "Portra 400", "Velvia 50" 같은 실명을 필터/프리셋 이름으로 쓰는
  상용 앱이 많다 (Cobalt Image, SHOTON, PixRobe, Mastin Labs 등). 지칭 사용
  (nominative use: "이 룩은 Portra를 참고했다") 으로 용인되는 분위기.
- 그러나 오픈소스 배포는 (a) 무료라 이익 침해 주장에 더 취약한 인상을 주지
  않지만 (b) GitHub는 DMCA/상표 클레임에 그대로 노출된다. 앱스토어 심사가
  없으니 "걸리면 내리면 되지"가 아니라 리포 자체가 대상이 될 수 있다.
- 특히 후지는 필름 시뮬레이션 브랜딩(Provia/Velvia/Classic Chrome...)을 적극
  관리하는 회사다. "후지 필름 시뮬레이션 클론"을 대놓고 표방하는 것보다
  "필름에서 영감받은 룩"으로 포지셔닝하는 게 안전하다.

### 2-3. 리스크 낮추는 방법 (택1 또는 병행)

1. **이름 변경** — `Portra` → `Portrait 400`, `Velvia` → `Alpine Vivid`,
   `Ilford` → `Mono 400` 같은 유추 가능하지만 상표가 아닌 이름.
2. **실명 유지 + 고지** — 필터명에 실명을 쓰되 앱/리포에 명시:
   "Filter names reference film stocks for descriptive purposes only.
   Not affiliated with or endorsed by Fujifilm, Kodak, Ilford...".
   상표 침해 리스크가 남지만 업계 관행상 가장 흔한 방식.
3. **절충** — 실제 필름명은 유지(관행 강함)하고, 후지 *디지털 시뮬레이션명*
   (Classic Chrome, Eterna 등)만 피하기. 후지 디지털 시뮬 이름이 상표 분쟁
   가능성이 제일 높은 영역.

어떤 방식이든 앱 이름/로고/도메인에 "Fuji", "Kodak" 등 브랜드명을 쓰지 말 것.

---

## 3. 현재 프로젝트 자산 감사

### 3-1. 문제 소지 있는 것

| 항목 | 위치 | 이슈 | 조치 제안 |
| --- | --- | --- | --- |
| 필터 id `portra`, `velvia`, `ilford`, `gold` | `src/engine/lut.ts` PRESETS | Kodak/Fujifilm/Ilford 상표명 | 이름 변경 또는 §2-3 고지 방식 |
| `lookup_amatorka.png` | `public/luts/` | GPUImage 리소스와 파일명 동일 — BradLarson/GPUImage(BSD)에서 가져온 것으로 보임. BSD라 재배포 가능하나 저작권 표기 필요. 원본은 deviantart 무료 포토샵 액션(Amatorka/Miss Etikate) 기반이라 2차 라이선스 애매 | NOTICE에 GPUImage BSD 저작권 표기 + 출처 명시. 더 깨끗하게 하려면 `buildLut()`로 동등 룩 자체 생성해 교체 |
| `lookup_miss_etikate.png`, `lookup_soft_elegance_1/2.png`, `lookup.png` | `public/luts/` | 위와 동일 | 위와 동일 |

### 3-2. 깨끗한 것

- `neutral-hald.png`, `samples/sample1.png` — `scripts/gen-assets.mjs`로 자체 생성
- `PRESETS`의 `build:` 항목 전부 — 수식으로 자체 생성한 LUT
- 사용자 `.cube`/PNG import 기능 자체

---

## 4. 안전하게 LUT/필터를 확보하는 방법 (우선순위)

1. **자체 생성 (현행 방식 유지·확장)** — `buildLut()` 체인으로 룩 디자인.
   완전 무결. 필름 룩은 컬러차트 기준 이미지에 목표 색감을 맞춰 피팅하면 된다.
2. **측정 기반 자체 제작** — 실물 필름 스캔/카메라 JPEG 출력을 기준 이미지로
   측정해 LUT 생성 (Sowerby 방식). 데이터를 추출하는 게 아니라 출력을 "관측"
   하는 것이라 안전.
3. **명시적 재배포 허용 라이선스 LUT** — CC0/공식적으로 redistribution을
   허용한 팩만. 라이선스 전문을 `docs/` 에 보관.
4. **커뮤니티 LUT** — G'MIC/RawTherapee/ART 필름 에뮬레이션 팩처럼 오픈
   프로젝트에 포함된 것은 상대적으로 안전하지만 개별 라이선스 확인 필요.
5. **절대 금지** — 구매 LUT 팩, Lightroom/Capture One/VSCO 프리셋 추출,
   카메라 펌웨어/공식 툴에서 추출한 LUT, 라이선스 불명의 "무료 다운로드" LUT.

---

## 5. 오픈소스 배포 체크리스트

- [ ] `LICENSE` 파일 추가 (MIT 또는 Apache-2.0 권장)
- [ ] `NOTICE` 또는 `THIRD_PARTY.md`에 서드파티 에셋 출처/라이선스 표기
      (GPUImage lookup PNG 유지 시 필수)
- [ ] 상표 고지문 README에 명시 (§2-3 참고)
- [ ] `docs/lut-provenance.md`에 필터별 출처/생성 방식 기록 (시작함)
- [ ] 라이선스 불명 LUT 번들 금지 — git 히스토리에 이미 들어간 것도 확인
- [ ] CONTRIBUTING에 "직접 만들었거나 재배포 허용된 LUT만 제출" 명시
- [ ] 앱 about/설정 화면에 라이선스·상표 고지 추가 (PWA니까 메뉴에 링크)
- [ ] 카메라로 찍은 사용자 사진/카메라 접근 권한 관련 개인정보 안내
      (PWA는 온디바이스라 리스크 낮음 — 서버 업로드 없음 명시하면 좋음)

---

## 6. 참고 자료

- Stuart Sowerby, Fuji Film Simulation Profiles (측정 기반 자체 LUT 제작 사례):
  https://blog.sowerby.me/fuji-film-simulation-profiles/
- FilmFrame — 후지 공식 LUT 번들 제거 커밋 (재배포 조건 불명확 사례):
  https://github.com/ryuheiyokokawa/FilmFrame/commit/5b4606f4a834dc33885b5acb1904babb55ad00ef
- BradLarson/GPUImage (lookup PNG 출처, BSD):
  https://github.com/BradLarson/GPUImage
- abpy/FujifilmCameraProfiles (커뮤니티 자체 제작 후지 프로파일/LUT):
  https://github.com/abpy/FujifilmCameraProfiles
- fujilab — WebGL 후지 필름 시뮬 PWA 선례 (Sowerby LUT 기반):
  https://github.com/MatthewGreenberg/fujilab
- Fujify FAQ (상용 LUT 팩의 재배포 금지 조항 예시):
  https://fujify.me/en-gbp/pages/faq
