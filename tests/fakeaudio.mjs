// Recording stand-ins for AudioContext and OfflineAudioContext: AudioParams take their value at once; nodes record start/stop and connections.
export class Param { constructor(v = 0) { this.value = v; } setValueAtTime(v) { this.value = v; return this; } linearRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; } exponentialRampToValueAtTime(v) { this.value = v; return this; } cancelScheduledValues() { return this; } }
class Node { constructor(ctx, kind) { Object.assign(this, { kind, gain: new Param(1), frequency: new Param(440), Q: new Param(1), detune: new Param(0), out: [], type: '', buffer: null, loop: false }); ctx.made.push(this); }
  connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } start(t = 0) { this.started = t; } stop(t = 0) { this.stopped = t; } }
export class FakeAC { constructor() { Object.assign(this, { made: [], state: 'suspended', currentTime: 0, sampleRate: 44100, destination: { kind: 'dest' } }); }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return new Node(this, 'gain'); } createBiquadFilter() { return new Node(this, 'filter'); } createOscillator() { return new Node(this, 'osc'); } createBufferSource() { return new Node(this, 'src'); }
  createBuffer(ch, n, sr) { const d = new Float32Array(n); return { length: n, sampleRate: sr, numberOfChannels: ch, getChannelData: () => d, copyToChannel: s => d.set(s) }; } }
export class FakeOffline extends FakeAC { constructor(ch, n, sr) { super(); this.length = n; this.sampleRate = sr; } startRendering() { return Promise.resolve(this.createBuffer(1, this.length, this.sampleRate)); } }
