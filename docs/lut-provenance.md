# LUT/필터 자산 출처 추적

오픈소스 배포를 위해 각 필터 에셋의 출처와 라이선스 상태를 기록한다.
새 LUT를 추가할 때마다 이 표에 행을 추가하고, 라이선스 문구가 있으면
원문을 함께 보관한다.

## 바이너리 LUT 에셋 (`public/luts/`)

| 파일 | 출처 | 라이선스 | 상태 |
| --- | --- | --- | --- |
| `neutral-hald.png` | `scripts/gen-assets.mjs` 자체 생성 | 프로젝트 라이선스 | OK |
| `lookup.png` | GPUImage Resources (추정, 파일명 일치) | BSD (GPUImage) / 원본 포토샵 액션 라이선스 불명 | NOTICE 표기 or 교체 |
| `lookup_amatorka.png` | GPUImage — deviantart "Amatorka Action 2" 기반 | 동일 | 동일 |
| `lookup_miss_etikate.png` | GPUImage — deviantart "Miss Etikate Action 15" 기반 | 동일 | 동일 |
| `lookup_soft_elegance_1.png` | GPUImage Resources | 동일 | 동일 |
| `lookup_soft_elegance_2.png` | GPUImage Resources | 동일 | 동일 |
| `film/*.png` (HaldCLUT 20종) | RawTherapee Film Simulation / Natron CLUT | CC BY-SA 4.0 | CREDITS.md 표기 — 저작자 표기 의무 충족됨 (앱 내 라이선스 시트) |
| (LENEU 시리즈 — 구 classic-chrome/classic-neg 및 LUMIX PhotoStyle 변환 .cube 7종) | 사용자 제공 .cube (Resolve 생성 표기 / rossandhisjpegs 제작 표기 포함) | 재배포 라이선스 미확인 | **번들에서 제거됨** — 사용자가 커스텀 LUT import로 개별 설치하는 방식으로 전환 |
| `provided/muted-chrome.cube` | 사용자 제공 `CLASSIC CHROME.cube` / 역추출이라는 사용자 설명, 구체적 원출처·방법 미확인 | **미확인** | 2026-10-05 사용자 재요청으로 별도 ID에 추가; 원본 바이트 유지, 제공 LUT CREDITS.md 참조 |
| `provided/deep-negative.cube` | 사용자 제공 `CLASSIC Neg.cube` / 동일 | **미확인** | 동일; 자체 제작·제조사 공식·CC 라이선스로 표시하지 않음 |

## 코드 생성 프리셋 (`src/engine/lut.ts` PRESETS)

| id | label | 생성 방식 | 상표 이슈 |
| --- | --- | --- | --- |
| none, mono, noir, sepia, fade, warm, cool, cine, vivid, bleach | — | `buildLut()` 수식 자체 생성 | 없음 |
| portra | 포트라 | 자체 생성 | Kodak "Portra" 상표 |
| gold | 골드 | 자체 생성 | Kodak "Gold" 상표 |
| ilford | 일포드 | 자체 생성 | Ilford 상표 |
| velvia | 벨비아 | 자체 생성 | Fujifilm "Velvia" 상표 |
| amatorka, etikate, elegance, elegance2, classic | — | 파일 LUT (위 표 참고) | 이름 자체는 무관 |

## 추가 예정 자산 (계획)

- 기존 계획은 재배포 허용 조건이 확인된 LUT 또는 자체 생성만 번들에 넣고,
  조건 미확인 파일은 사용자 import로 제공하는 방향이었다.
- 2026-10-05 사용자는 위 두 파일의 별도 이름 추가를 재요청했다. 이번 변경은
  그 두 파일만의 프로젝트 결정이며, 라이선스가 확인됐다는 뜻은 아니다.
  나머지 구 LENEU/LUMIX 파일은 계속 제외한다. 이후 추가는 출처·조건을 개별 기록한다.

## 사용자 제공 2종 검증 — 2026-10-05

- 기존 `.cube` 로더·이미지 처리·UI 컴포넌트는 수정하지 않고 PRESETS에 두 항목만
  추가했다. 전달 파일의 SHA-256 및 로더가 반환하는 33³ RGB 데이터 해시를 비교해
  원본 바이트와 값의 보존을 확인했다. 일반 8비트 LUT 변환은 기존 로더 방식 그대로다.
- 등록 전 새 테스트 3개가 unknown preset / missing group으로 실패한 뒤,
  등록 후 새 테스트 및 공개 6종·색감 비교·PWA를 포함한 11개가 통과했다(49.0초).
  TypeScript와 diff 공백 검사도 통과했다.
- 기존 임시 HTTPS에서 새 번들 `/assets/index-DrGhBWjo.js`, 두 필터 선택과 JPG
  촬영 저장, 제공 LUT 출처 기록의 응답 및 브라우저 오류 없음 확인. Chromium의
  가상 카메라를 사용했고 실물 iPhone 색감이나 제조사 색감 일치는 검증하지 않았다.
- 독립 읽기 전용 코드 검토: 기술 변경 Ready, Critical/Important/Minor 없음.
  권리·제조사 일치 여부는 미확인이므로 판단 제외가 타당하다. 이전 UI 변경은
  이번 범위 밖으로 유지했다. 원본 재현상은 기존 공유 로더 연결을 검토했으나
  새 테스트에서 재현상 결과 픽셀까지 검증하지 않았으므로 그 보증은 하지 않는다.
  전체 회귀·배포 검증은 부모 작업에서 수행하며, 정식 배포는 요청 범위 밖이다.
- 최종 전체 테스트: `npm test -- --workers=2 --reporter=line`, **246개 통과
  (9.3분)**, 실패 없음. 최종 빌드·타입 검사 및 diff 공백 검사 통과. 최신 번들은
  동일한 `/assets/index-DrGhBWjo.js`이며 PWA precache는 22개다.
- 테스트 서버 5185/5186과 이전 진단 포트 5195/5196/5197은 종료됨. 이 프로젝트의
  기존 미리보기(5188, PID 83770)와 기존 HTTPS 터널(PID 83803)만 유지했다.
  Git commit/push 및 정식 Vercel 배포는 하지 않았다.
