# 얼굴 보정(Beauty) 기능 계획

SNOW식 얼굴 감지 보정. 전부 온디바이스 — 모델을 PWA 에셋으로 번들해 오프라인 동작.

## 목표

- 1단계: 얼굴 감지 + 피부 스무딩/브라이트닝 (실시간 프리뷰 + 저장 반영)
- 2단계: 얼굴 슬리밍/눈 확대 (랜드마크 워핑)
- 이후: 다중 얼굴, 메이크업 계열은 여건 보고

## 접근

- **감지**: MediaPipe FaceMesh(`@mediapipe/tasks-vision`, WASM) — 468개 랜드마크.
  네이티브 FaceDetector API는 iOS Safari 미지원이라 사용 불가.
- 모델 파일(.tflite 등, 수 MB)을 `public/models/`에 번들 → SW precache or 런타임 캐시.
- 보정 UI 첫 진입 시 lazy-load (초기 로딩 영향 없게).
- 감지는 **다운스케일 프레임(~256px)에서 주기적**(100–200ms) 실행 → 성능 확보.

## 아키텍처

```
video → downscale canvas → FaceMesh → landmarks
                                   ↓
                mask canvas (피부 영역, 눈/입술/윤곽 제외)
                                   ↓
            WebGL mask texture → FilterPipeline 유니폼
                                   ↓
        shader: 마스크 내에서만 스무딩(blur mix)/브라이트닝 적용
```

- `FxSpec`와 별개로 `BeautyParams { smooth, brighten }`(가칭) 추가.
- 파이프라인은 마스크 텍스처 유닛을 추가로 바인딩 (그레인 텍스처와 동일 패턴).
- 저장(export) 시에도 같은 마스크/파라미터로 합성 → 프리뷰와 결과 일치.
- 조절 패널에 "피부" 슬라이더 추가 (보정 칩 또는 별도 탭).

## 마일스톤

1. tasks-vision 의존성 + 모델 에셋, 감지 루프, 마스크 텍스처 생성
2. 셰이더 마스크 합성 (스무딩+브라이트닝) + 슬라이더 UI
3. 저장 경로 적용 + 실기기 성능 검증 (프레임 드랍 체크)
4. (2단계) 랜드마크 displacement 맵 → UV 워핑 슬리밍/눈 확대

## 리스크/한계

- 모델 용량(수 MB)으로 precache 증가 — lazy 로딩으로 완화
- 저조도/측면 얼굴 감지 정확도 — 감지 실패 시 효과 0으로 자연 폴백
- iOS WASM 속도: 저해상도 감지로 커버, 필요시 감지 주기 조절
- 워핑(슬리밍)은 자연스러움 튜닝이 핵심 — 1단계 결과 보고 판단
