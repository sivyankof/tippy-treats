/** What a share request carries: a picture and the words that go with it. */
export interface ShareRequest {
  /** The picture to share. */
  image: Blob;
  /** File name offered to the share target or to the downloads folder. */
  fileName: string;
  /** Message that goes with the picture. */
  text: string;
  /** Title of the share sheet where the platform has one. */
  title: string;
}

/**
 * How a share ended: `shared` went through the system sheet, `downloaded` was saved as a file
 * (the browser had no way to share files), `cancelled` the player closed the sheet, `failed`
 * nothing could be done.
 */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** Handing a picture to the system. Native and browser implementations share this interface. */
export interface ShareService {
  shareImage(request: ShareRequest): Promise<ShareOutcome>;
}
