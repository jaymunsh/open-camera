export class ThumbnailCache {
  private readonly entries = new Map<string, HTMLCanvasElement>();
  private readonly limit: number;
  constructor(limit = 256) { this.limit = limit; }
  get size(): number { return this.entries.size; }
  get(key: string): HTMLCanvasElement | undefined {
    const value = this.entries.get(key);
    if (value) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key: string, value: HTMLCanvasElement): void {
    const old = this.entries.get(key);
    if (old && old !== value) old.width = old.height = 0;
    this.entries.delete(key); this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value!;
      const canvas = this.entries.get(oldest)!; this.entries.delete(oldest); canvas.width = canvas.height = 0;
    }
  }
  clear(): void { for (const canvas of this.entries.values()) canvas.width = canvas.height = 0; this.entries.clear(); }
}
