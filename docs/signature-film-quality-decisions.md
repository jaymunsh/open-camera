# 1A 최종 결정 및 검토 기록

2026-10-05 · Native 실행 · 최종 전체 294개 및 추가 손상 검증 1개·typecheck/build 통과.

실행 중의 결정과 비용을 원문 순서대로 보존한다. 이 기록은 결정의 근거이며, 전체 상용화 기능이나 실기기·사진 품질 검증 완료를 뜻하지 않는다. 상세 기능·결과는 [검증 기록](signature-film-quality-verification.md)을 참고한다.

## Rulings I made

- Ruling: Work in the existing feature checkout — user explicitly requested this folder; unrelated diagnostics remain untouched — cost if wrong: no additional branch isolation.

- Ruling: Reuse installed dependencies and existing preview pair — installation/server proliferation is unnecessary — cost if wrong: fresh build/tests will detect a dependency mismatch.

- Ruling: Execute tasks continuously without repeated approval prompts — latest user instruction requests completion — cost if wrong: local, reviewable commits only; no push or production deployment.

- Ruling: Run preflight RED/golden tests against the baseline-owned dev server using an ignored runner config — prevents extra servers and report-directory collisions — cost if wrong: configuration differs only in server ownership/output location, canonical task verification still runs afterward.

- Ruling: Anchor new grain to the final cropped/mirrored photograph coordinates — avoids double-mirroring retained originals during reprocessing — cost if wrong: grain does not follow a pre-crop sensor coordinate system, which is outside the product contract.

- Ruling: Preserve existing half-frame per-cut color choices and use a separate quality/whole-recipe lock — the legacy hook locks all controls only in booth mode, but the new contract requires texture writers to lock in half mode too — cost if wrong: quality cannot be changed between half-frame cuts; ordinary color choices remain available.

- Ruling: Stage onCompare as optional until Task 6 owns a real comparison — avoids a dead visible action during Task 5 — cost if wrong: temporary API differs from planned required callback; Task 6 wires actual behavior.

- Ruling: Reuse the existing comparison surface and suspend the parent Studio dialog while texture comparison is open — keeps one focus/Escape owner and preserves Studio tab/disclosure state — cost if wrong: the parent is hidden while comparing, not visible under the child.

- Ruling: Keep all six candidates in the explicit evaluation query, not the default catalog — generated samples and numeric fixtures do not establish photographic aesthetic quality — cost if wrong: users must open the evaluation URL to try these new combinations until real-photo evaluation.

- Ruling: Include an already selected signature in color comparison choices even outside the evaluation query — a restored valid look must be comparable, without recommending the other hidden candidates — cost if wrong: that one selected experimental label appears in the comparison selector on the normal URL.

- Final: Ruling: Real-photo aesthetic acceptance remains unverified — synthetic fixtures cannot establish photographic appeal; candidates stay explicitly experimental — cost if wrong: the six candidates are not recommended in the default catalog.

- Final: Ruling: Manufacturer/physical-film fidelity is not asserted — these are credited color-data combinations with independently authored texture, not physical emulations — cost if wrong: no manufacturer-grade fidelity guarantee.

- Final: Ruling: iPhone Safari/PWA framing, performance and heat remain device-unverified — desktop synthetic-camera tests do not stand in for an iPhone — cost if wrong: device-specific issues may remain.

- Final: Ruling: Preserve the documented legacy neutral-warp mirror-edge discrepancy — changing it would invalidate incumbent output compatibility — cost if wrong: small sharp-edge reprocessing differences remain.

- Final: Ruling: 1B, 2, 3A and 3B remain separate design stages — approved 1A does not invent the missing written specifications — cost if wrong: broader roadmap functionality is not yet delivered.

- Final: Ruling: Do not certify each incumbent LUT's provenance/table values — catalog and reuse paths are inspected, not independent license evidence — cost if wrong: license eligibility still needs authoritative evidence before distribution.

- Final: Ruling: Use the dedicated finish review for the 16 UI captures — code review alone does not attest to visual correctness — cost if wrong: visual coverage is limited to the recorded viewports/states.

- Final: Ruling: Do not create missing global DESIGN.md/PRODUCT.md — ordinary extension preserves existing surface documents; missing globals are recorded as incumbent drift — cost if wrong: global product/design documentation remains incomplete.

- Final: Ruling: Preserve color-only non-color behavior with an optional versioned nonColorSource snapshot — a LUT ID alone cannot retain the old preset effects/intensity during color A/B, capture and reprocessing — cost if wrong: saved settings gain one optional compatibility field; explicit ordinary filter selection clears it.

- Final: Ruling: Keep existing beauty rather than add a duplicate natural-beauty feature — user says the existing beauty is satisfactory; unneeded new beauty controls stay out — cost if wrong: proposed skin-protection/natural-beauty additions are deferred pending a demonstrated need.

## Deferred minors

- Final: minor (deferred): failed shader compilation cleanup/retry caching; successful and restored render paths are covered, but compile-failure resource cleanup remains follow-up work.

## 최종 검토와 수정

신선한 전체 분기 코드 검토 1회, Impeccable UI 검토 및 같은 검토자의 수정 판정을 수행했다. Critical 0건, Important 5건과 UI 중요 수정 2건을 한 묶음으로 처리했다. 실패 테스트를 확인한 뒤 코드 수정·집중 검증 35개/확장 검증 25개, 최종 전체 294개(11.8분, exit 0)의 통과를 확인했다. 추가 손상 보관정보 테스트 1개도 제품 코드 변경 없이 통과했다. 신선한 코드 재검토를 받은 것으로 표시하지 않는다.

코드 검토의 셰이더 컴파일 실패 자원 정리는 Minor로 남겼다. UI의 잘못된 질감 요약은 실제 사용자에게 활성 효과를 꺼짐으로 알려주므로 Important로 올려 수정했다. 선택 글씨 대비 4.421:1도 6.086:1로 수정했다. 16장 재캡처 후 같은 UI 검토자가 scored fixes에 ship 판정을 냈고, 별도 문서화 검토는 기존 surface contract에만 사실을 추가했다.
