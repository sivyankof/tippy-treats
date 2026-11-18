/** A media element wired into the audio graph once: element -> source node -> its own gain. */
export interface PooledMedia {
  readonly el: HTMLMediaElement;
  /** The element's level (0 while it is free); connect it to a deck. */
  readonly gain: GainNode;
  busy: boolean;
}

/** What the pool needs of the context: media element sources exist only on a live `AudioContext`. */
export interface MediaContext {
  createMediaElementSource(el: HTMLMediaElement): AudioNode;
  createGain(): GainNode;
}

/**
 * The media elements that stream the long tracks (docs/08 journal, session 6b: such a track is
 * never decoded whole). A `MediaElementAudioSourceNode` can be made once per element, so the
 * elements are made once, at the audio unlock, and lent out. `bless` plays each one inside the
 * unlocking gesture: iOS lets an element play later without a gesture once it has played in one.
 */
export class MediaPool {
  private readonly all: PooledMedia[] = [];

  constructor(ctx: MediaContext, make: () => HTMLMediaElement, size: number) {
    for (let i = 0; i < size; i++) {
      const el = make();
      el.preload = 'auto';
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      this.all.push({ el, gain, busy: false });
    }
  }

  /** Call inside a user gesture: starts and at once pauses every free element on `url` (silent: their gains are 0). */
  bless(url: string): void {
    for (const media of this.all) {
      if (media.busy) continue;
      try {
        media.el.src = url;
        const started = media.el.play();
        // A lent element plays for real by now: only a still free one is paused.
        const pause = (): void => {
          if (!media.busy) media.el.pause();
        };
        if (started) started.then(pause, () => undefined);
        else pause();
      } catch {
        // Blessing is only needed on iOS outside the native shell; the music still plays elsewhere.
      }
    }
  }

  /** A free element, or null when all are lent. */
  acquire(): PooledMedia | null {
    const media = this.all.find((m) => !m.busy) ?? null;
    if (media) media.busy = true;
    return media;
  }

  /** Takes an element back: paused, silent, disconnected from its deck, its file let go. */
  release(media: PooledMedia): void {
    if (!media.busy) return;
    media.busy = false;
    try {
      media.el.pause();
      media.el.removeAttribute('src');
      media.el.load();
    } catch {
      // The element is reset on its next use anyway.
    }
    media.gain.gain.cancelScheduledValues(0);
    media.gain.gain.value = 0;
    media.gain.disconnect();
  }

  get free(): number {
    return this.all.filter((m) => !m.busy).length;
  }
}
