import type { SimEvent, TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import type { SessionHints } from '../session-hints';

/** Something the hint screen has to show now. */
export type TutorialCue =
  { type: 'first_perfect' } | { type: 'creature_intro'; layerIndex: number } | { type: 'wobble' };

const NO_CUES: readonly TutorialCue[] = [];

/** The part of the run state the director reads. */
export type TutorialState = Pick<TowerState, 'phase' | 'layers' | 'wobble'>;

/**
 * Decides which one-time hints a run shows and when. It owns no pictures: the scene asks it
 * whether the sim is held and the hint screen takes its cues. Flags live in `SessionHints`.
 */
export class TutorialDirector {
  private holdLeftMs = 0;
  private cues: TutorialCue[] = [];
  private creatureLayerIndex = -1;
  /** Screen position of the creature layer's top centre, set by the scene while it is held. */
  readonly target = { x: 0, y: 0, valid: false };
  /** Screen y where the top of the tower settles (the flying row is above it), set by the scene. */
  towerTopY = 0;

  constructor(
    private readonly hints: SessionHints,
    /** True for the tutorial run: the Honey intro only happens there. */
    readonly tutorialRun: boolean,
  ) {}

  /** The tap hint (hand and text) is up from the start of the tutorial run until the first drop. */
  get tapHintVisible(): boolean {
    return this.tutorialRun && !this.hints.has('tap');
  }

  /** The sim waits and taps are ignored while the Honey layer is explained. */
  get holding(): boolean {
    return this.holdLeftMs > 0;
  }

  /** Time since the hold began; 0 when nothing is held. */
  get holdElapsedMs(): number {
    return this.holding ? BALANCE.tutorial.creaturePauseMs - this.holdLeftMs : 0;
  }

  /** 0-based index of the layer the arrow points at; -1 before the intro. */
  get introLayerIndex(): number {
    return this.creatureLayerIndex;
  }

  /** Advances the hold by a real frame time. */
  tick(dtMs: number): void {
    const wasHolding = this.holding;
    this.holdLeftMs = Math.max(0, this.holdLeftMs - dtMs);
    if (this.holdLeftMs === 0) this.target.valid = false;
    // The Honey intro has played: the tutorial is done.
    if (wasHolding && !this.holding) this.hints.mark('tutorial');
  }

  setTarget(x: number, y: number): void {
    this.target.x = x;
    this.target.y = y;
    this.target.valid = true;
  }

  /** Looks at the events and the state of one frame; new cues wait for `takeCues`. */
  observe(events: readonly SimEvent[], state: TutorialState): void {
    // The tap hint goes away as soon as the first layer is dropped.
    if (state.phase === 'falling') this.hints.mark('tap');
    for (const event of events) {
      if (event.type === 'land' || event.type === 'miss') this.hints.mark('tap');
      if (event.type === 'land') this.onLand(event, state);
    }
    if (!this.hints.has('wobble') && state.wobble > BALANCE.tutorial.wobbleHintAt) {
      this.hints.mark('wobble');
      this.cues.push({ type: 'wobble' });
    }
  }

  /** The cues since the last call (an empty shared list when there are none). */
  takeCues(): readonly TutorialCue[] {
    if (this.cues.length === 0) return NO_CUES;
    const taken = this.cues;
    this.cues = [];
    return taken;
  }

  private onLand(event: Extract<SimEvent, { type: 'land' }>, state: TutorialState): void {
    if (event.quality === 'perfect' && !this.hints.has('firstPerfect')) {
      this.hints.mark('firstPerfect');
      this.cues.push({ type: 'first_perfect' });
    }
    // A run that went past the Honey layer without the intro (a lost team, say) is done too.
    if (state.layers.length > BALANCE.team.creatureEvery) this.hints.mark('tutorial');
    const index = state.layers.length - 1;
    const layer = state.layers[index];
    if (this.tutorialRun && layer?.creature === 'honey' && !this.hints.has('honey')) {
      this.hints.mark('honey');
      this.holdLeftMs = BALANCE.tutorial.creaturePauseMs;
      this.creatureLayerIndex = index;
      this.cues.push({ type: 'creature_intro', layerIndex: index });
    }
  }
}
