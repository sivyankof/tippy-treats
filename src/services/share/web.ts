import type { ShareOutcome, ShareRequest, ShareService } from './types';

/** The part of `navigator` the share uses; both members may be missing. */
export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

/** Saves a blob as a file with the given name. */
export type DownloadFn = (blob: Blob, fileName: string) => void;

/** Offers the blob to the browser as a download through a temporary link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser starts the download on the click; the address may go a moment later.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Browser stub: the Web Share API with the picture as a file when the browser can share files,
 * otherwise a PNG download.
 */
export class WebShare implements ShareService {
  private readonly nav: ShareNavigator | undefined;
  private readonly download: DownloadFn;

  constructor(nav?: ShareNavigator, download: DownloadFn = downloadBlob) {
    this.nav = nav ?? (typeof navigator === 'undefined' ? undefined : navigator);
    this.download = download;
  }

  async shareImage(request: ShareRequest): Promise<ShareOutcome> {
    const file = new File([request.image], request.fileName, { type: request.image.type });
    const data: ShareData = { files: [file], text: request.text, title: request.title };
    const nav = this.nav;
    if (nav?.share && nav.canShare?.(data)) {
      try {
        await nav.share(data);
        return 'shared';
      } catch (error) {
        // Closing the sheet is not a failure; anything else falls back to the download.
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
    try {
      this.download(request.image, request.fileName);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
}
