import type { BoothInterval, BoothMethod } from '../capture/types';

export function BoothControls({ method, interval, locked, onMethod, onInterval }: {
  method: BoothMethod; interval: BoothInterval; locked: boolean;
  onMethod: (method: BoothMethod) => void; onInterval: (interval: BoothInterval) => void;
}) {
  return <>
    <fieldset className="camera-field" disabled={locked}><legend>네 컷 촬영 방식</legend><div className="camera-choices">
      {([['auto', '자동'], ['manual', '수동']] as const).map(([key, label]) => <button key={key} aria-pressed={method === key} onClick={() => onMethod(key)}>{label}</button>)}
    </div></fieldset>
    {method === 'auto' && <fieldset className="camera-field" disabled={locked}><legend>다음 컷까지</legend><div className="camera-choices">
      {([3, 5, 10] as const).map((seconds) => <button key={seconds} aria-pressed={interval === seconds} onClick={() => onInterval(seconds)}>{seconds}초</button>)}
    </div></fieldset>}
    <p className="camera-note">{locked ? '촬영 중에는 방식과 간격이 고정됩니다.' : method === 'auto' ? `첫 컷은 셔터로, 다음 컷부터 ${interval}초 간격으로 찍어요.` : '매 컷마다 셔터를 눌러 찍어요.'}</p>
  </>;
}
