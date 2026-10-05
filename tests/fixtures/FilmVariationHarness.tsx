import { createRoot } from 'react-dom/client';
import { useFilmVariation } from '../../src/capture/useFilmVariation';
function Harness() {
  const c = useFilmVariation();
  return <section><output id="variation-state">{JSON.stringify({ settings: c.settings, pattern: c.pattern, warning: c.warning, writable: c.writable })}</output>
    <button onClick={() => c.update({ ...c.settings, mode: 'new' })}>h-new</button>
    <button onClick={() => c.update({ ...c.settings, grain: .7 })}>h-tune</button>
    <button onClick={() => { c.commitShot(null); c.commitShot({ version: 1, seed: .99 }); }}>h-wrong</button>
    <button onClick={() => c.commitShot(c.pattern)}>h-commit</button>
    <button onClick={c.freeze}>h-freeze</button><button onClick={c.reroll}>h-reroll</button>
    <button onClick={() => c.apply({ ...c.settings, mode: 'new' })}>h-apply-new</button>
    <button onClick={() => c.apply({ ...c.settings, mode: 'new' }, { version: 1, seed: .25 })}>h-restore</button>
  </section>;
}
export function mountVariationHarness(container: HTMLElement): () => void { const root = createRoot(container); root.render(<Harness />); return () => root.unmount(); }
