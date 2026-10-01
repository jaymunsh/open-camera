/** Same version at the HTTP, service-worker and IndexedDB cache boundaries. */
export const ASSET_VERSION = __ASSET_VERSION__;

export function assetUrl(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
