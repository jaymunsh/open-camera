import type { CompositionOptions } from './types';

export const PAPERS = [
  { id: 'white', label: '흰 여백', color: '#ffffff', ink: '#292622' },
  { id: 'black', label: '검은 여백', color: '#000000', ink: '#f5eddc' },
  { id: 'cream', label: '크림', color: '#f5eddc', ink: '#292622' },
  { id: 'blush', label: '연분홍', color: '#f6e2e1', ink: '#292622' },
] as const;
export function compositionPaper(options: Partial<CompositionOptions>) {
  return PAPERS.find((p) => p.id === options.paper) ?? PAPERS[0];
}
