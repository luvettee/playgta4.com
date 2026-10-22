// Adapt SDL's playback callback to a bounded PCM ring consumed by AudioWorklet.
// SDL keeps mixing/conversion; hardware playback no longer waits for a page callback.
'use strict';
(function () {
 async function prepare(module) {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context || !globalThis.AudioWorkletNode || !globalThis.SharedArrayBuffer) return;
  const sdl = module.SDL3;
  const context = new Context({ latencyHint: 'interactive' });
  try {
   await context.audioWorklet.addModule('audio_worklet.js');
  } catch (error) {
   await context.close();
   module.printErr('AudioWorklet unavailable; using SDL playback: ' + error.message);
   return;
  }
  const original = context.createScriptProcessor.bind(context);
  context.createScriptProcessor = function (frames, inputs, channels) {
   if (inputs !== 0) return original(frames, inputs, channels);
   // Four SDL blocks absorb short scheduling stalls. Never queue unbounded audio.
   const target = frames * 4;
   let capacity = 1;
   while (capacity < target + frames) capacity *= 2;
   const shared = new SharedArrayBuffer(32 + capacity * channels * 4);
   const header = new Int32Array(shared, 0, 8);
   const pcm = new Float32Array(shared, 32);
   const node = new AudioWorkletNode(context, 'liberty-audio', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [channels],
    processorOptions: { buffer: shared, capacity, channels },
   });
   const output = context.createBuffer(channels, frames, context.sampleRate);
   let timer = null;
   let connected = false;
   const facade = {
    bufferSize: frames, context, onaudioprocess: null,
    connect(destination) {
     if (connected) return;
     connected = true;
     node.connect(destination);
     timer = setInterval(pump, 8);
     pump();
    },
    disconnect() {
     connected = false;
     clearInterval(timer);
     node.disconnect();
     context.removeEventListener('statechange', stateChanged);
    },
   };
   function pump() {
    if (!connected || context.state !== 'running' || !facade.onaudioprocess) return;
    let read = Atomics.load(header, 0) >>> 0;
    let write = Atomics.load(header, 1) >>> 0;
    let blocks = 0;
    while (((write - read) >>> 0) < target && blocks++ < 4) {
     // SDL's handler fills currentPlaybackBuffer through its existing wasm callback.
     facade.onaudioprocess({ outputBuffer: output });
     for (let channel = 0; channel < channels; channel++) {
      const data = output.getChannelData(channel);
      const offset = write & (capacity - 1);
      const first = Math.min(frames, capacity - offset);
      const base = channel * capacity;
      pcm.set(data.subarray(0, first), base + offset);
      if (first < frames) pcm.set(data.subarray(first), base);
     }
     write = (write + frames) >>> 0;
     Atomics.store(header, 1, write | 0);
     read = Atomics.load(header, 0) >>> 0;
    }
    Atomics.store(header, 2, 1);
   }
   function stateChanged() {
    if (context.state !== 'running') {
     Atomics.store(header, 2, 0);
     Atomics.store(header, 0, Atomics.load(header, 1));
    } else pump();
   }
   context.addEventListener('statechange', stateChanged);
   module.audioOutputStats = () => ({
    bufferedMs: (((Atomics.load(header, 1) >>> 0) - (Atomics.load(header, 0) >>> 0)) >>> 0) / context.sampleRate * 1000,
    underrunFrames: Atomics.load(header, 3) >>> 0,
    playedFrames: Atomics.load(header, 4) >>> 0,
   });
   module.print(`AudioWorklet ready: ${Math.round(target / context.sampleRate * 1000)} ms buffer, ${channels} channels.`);
   return facade;
  };
  sdl.audioContext = context;
 }
 globalThis.LibertyAudioOutput = { prepare };
})();
