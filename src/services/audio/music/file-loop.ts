import { runSource, SOURCE_FOREVER_SEC, stopQuietly, type NodeTally } from '../node-tally';

/**
 * The file fallback of the music (docs/06, section 7): a decoded track looped by one buffer
 * source into the player's fader, so the music switch, the menu level and the duck act on it as
 * on the synthesized tune. Loading is asynchronous; a stop or a new play before the file is
 * ready cancels it. Decoded buffers are kept per URL.
 */
export class FileLoop {
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private source: AudioBufferSourceNode | null = null;
  /** Bumped by every play and stop: a load that finishes under an old ticket is dropped. */
  private ticket = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly tally: NodeTally,
    private readonly load: (url: string) => Promise<AudioBuffer> = (url) =>
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data)),
  ) {}

  /** Starts looping the file at `url` into `out` as soon as it is decoded (not before `at`). */
  play(url: string, out: AudioNode, at: number): Promise<void> {
    this.stop(at);
    const ticket = ++this.ticket;
    let buffer = this.buffers.get(url);
    if (!buffer) {
      buffer = this.load(url);
      this.buffers.set(url, buffer);
    }
    return buffer.then(
      (decoded) => {
        if (ticket !== this.ticket) return;
        const source = this.ctx.createBufferSource();
        source.buffer = decoded;
        source.loop = true;
        source.connect(out);
        const start = Math.max(at, this.ctx.currentTime);
        // Far ahead: the loop runs until `stop` moves its end.
        runSource(this.tally, source, [source], start, start + SOURCE_FOREVER_SEC);
        this.source = source;
      },
      () => {
        // A missing or broken file leaves the music silent, never the game broken.
        this.buffers.delete(url);
      },
    );
  }

  /** Stops the loop at context time `at` (and cancels a load still running). */
  stop(at: number): void {
    this.ticket += 1;
    const source = this.source;
    this.source = null;
    if (!source) return;
    stopQuietly(source, at);
  }

  get playing(): boolean {
    return this.source !== null;
  }
}

/** Track files in `assets/music/`, by file name: their URLs in the build. */
const FILE_URLS = import.meta.glob<string>('../../../../assets/music/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** The URL of the music file `name` (a file in `assets/music/`), or null when there is none. */
export function musicFileUrl(
  name: string | undefined,
  files: Readonly<Record<string, string>> = FILE_URLS,
): string | null {
  if (!name) return null;
  return files[`../../../../assets/music/${name}`] ?? null;
}
