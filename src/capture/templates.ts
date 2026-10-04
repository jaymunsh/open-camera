import type { CompositionOptions } from './types';

type Template = { id: string; label: string; options: Pick<CompositionOptions, 'layout' | 'frame'>; paper?: CompositionOptions['paper'] };
export const BOOTH_TEMPLATES: readonly Template[] = [
  { id: 'grid', label: '기본 2×2', options: { layout: 'grid', frame: 'plain' } },
  { id: 'strip', label: '클래식 스트립', options: { layout: 'strip', frame: 'plain' } },
  { id: 'memory-grid', label: '메모리 2×2', options: { layout: 'grid', frame: 'memory' } },
  { id: 'memory-strip', label: '메모리 스트립', options: { layout: 'strip', frame: 'memory' } },
  { id: 'row', label: '가로 네 컷', options: { layout: 'row', frame: 'plain' } },
  { id: 'film', label: '필름 스트립', options: { layout: 'strip', frame: 'film' }, paper: 'black' },
];
export function applyTemplate(options: CompositionOptions, template: Template): CompositionOptions {
  const current = options.layout === template.options.layout && (options.frame ?? 'plain') === template.options.frame;
  return { ...options, ...template.options, paper: current ? options.paper : template.paper ?? options.paper };
}
