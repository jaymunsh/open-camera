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

- 후지 필름 시뮬 스타일 룩 — 자체 측정/생성만 허용. 공식 배포 .cube,
  커뮤니티 추출 LUT, 구매 팩 번들 금지.
- 시중 .cube 팩 — 명시적 재배포 허용 라이선스(CC0 등)가 없으면 번들 불가.
  사용자 import 기능으로 우회 안내.
