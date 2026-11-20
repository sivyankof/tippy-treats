/**
 * A stand-in audio context with only what the sound service touches, shared by its tests (a plain
 * module: no test runner is needed here, and the game never imports it).
 */
/** The only parts of the audio graph the synth touches; everything else is not needed. */
export interface FakeParam {
  value: number;
  setValueAtTime(): void;
  linearRampToValueAtTime(): void;
  exponentialRampToValueAtTime(): void;
  setTargetAtTime(value: number): void;
}

export class FakeNode {
  onended: (() => void) | null = null;
  type = '';
  buffer: unknown = null;
  disconnected = false;
  readonly gain = fakeParam();
  readonly frequency = fakeParam();
  readonly Q = fakeParam();
  readonly threshold = fakeParam();
  readonly knee = fakeParam();
  readonly ratio = fakeParam();
  readonly attack = fakeParam();
  readonly release = fakeParam();
  connect(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {}
  stop(): void {}
}

function fakeParam(): FakeParam {
  const param: FakeParam = {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(value: number) {
      param.value = value;
    },
  };
  return param;
}

export class FakeContext {
  currentTime = 0;
  state = 'suspended';
  sampleRate = 8000;
  destination = new FakeNode();
  oscillators: FakeNode[] = [];
  nodes = 0;
  resumes = 0;
  suspends = 0;
  private node(): FakeNode {
    this.nodes++;
    return new FakeNode();
  }
  gains: FakeNode[] = [];
  createGain = () => {
    const g = this.node();
    this.gains.push(g);
    return g;
  };
  createDynamicsCompressor = () => this.node();
  createWaveShaper = () => this.node();
  createBiquadFilter = () => this.node();
  createBufferSource = () => this.node();
  createOscillator = () => {
    const osc = this.node();
    this.oscillators.push(osc);
    return osc;
  };
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  resume = () => {
    this.resumes++;
    return Promise.resolve();
  };
  closes = 0;
  close = (): Promise<void> => {
    this.closes++;
    return Promise.reject(new Error('closed'));
  };
  suspend = (): Promise<void> => {
    this.suspends++;
    return Promise.reject(new Error('closed'));
  };
}
