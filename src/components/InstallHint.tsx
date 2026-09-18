import { useState } from 'react';

const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

export function InstallHint() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('izi-install-dismissed') === '1',
  );
  if (!isIOS || standalone || dismissed) return null;
  return (
    <div className="install-hint">
      <span>앱으로 설치하려면 공유 버튼 → &quot;홈 화면에 추가&quot;</span>
      <button
        onClick={() => {
          localStorage.setItem('izi-install-dismissed', '1');
          setDismissed(true);
        }}
      >
        닫기
      </button>
    </div>
  );
}
