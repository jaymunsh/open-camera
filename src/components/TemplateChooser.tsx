import { compositionLayout } from '../capture/composite';
import { applyTemplate, BOOTH_TEMPLATES } from '../capture/templates';
import type { CompositionOptions } from '../capture/types';
import { compositionPaper } from '../capture/paper';

export function TemplateChooser({ options, ratio, active = true, disabled = false, onChoose }: {
  options: CompositionOptions; ratio: { w: number; h: number }; active?: boolean; disabled?: boolean;
  onChoose: (options: CompositionOptions) => void;
}) {
  return <div className="template-choices" role="group" aria-label="네 컷 템플릿">
    {BOOTH_TEMPLATES.map((template) => {
      const next = applyTemplate(options, template);
      const layout = compositionLayout(ratio.w * 100, ratio.h * 100, 'booth', next);
      const selected = active && options.layout === next.layout && (options.frame ?? 'plain') === next.frame;
      return <button className="template-choice" key={template.id} disabled={disabled} aria-pressed={selected} onClick={() => onChoose(next)}>
        <span className="template-diagram"><svg aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`}>
          <rect width={layout.width} height={layout.height} fill={compositionPaper(next).color} />
          {layout.holes.map((r, i) => <rect key={`hole-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={next.paper === 'black' ? '#fff' : '#000'} />)}
          {layout.cells.map((r, i) => <g key={i}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#45424f" /><text x={r.x + r.w / 2} y={r.y + r.h / 2} dominantBaseline="central" textAnchor="middle" fontSize={Math.min(r.w, r.h) * .2} fill="#eee">{i + 1}</text></g>)}
        </svg></span>
        <span className="template-label">{template.label}</span>
      </button>;
    })}
  </div>;
}
