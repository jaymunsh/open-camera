type ShareNav = Navigator & { canShare?: (data: ShareData) => boolean };

export async function saveImage(blob: Blob, name: string): Promise<'shared' | 'aborted' | 'downloaded'> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as ShareNav;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'aborted';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
