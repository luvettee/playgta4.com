// Playback runs on the audio rendering thread, independent of page scheduling.
// Header words: read, write, started, underrun frames, played frames.
'use strict';
class LibertyAudioProcessor extends AudioWorkletProcessor {
 constructor(options) {
  super();
  const { buffer, capacity, channels } = options.processorOptions;
  this.header = new Int32Array(buffer, 0, 8);
  this.pcm = new Float32Array(buffer, 32);
  this.capacity = capacity;
  this.channels = channels;
 }
 process(inputs, outputs) {
  const output = outputs[0];
  if (!output || !output.length) return true;
  const length = output[0].length;
  for (const channel of output) channel.fill(0);
  if (!Atomics.load(this.header, 2)) return true;
  const read = Atomics.load(this.header, 0) >>> 0;
  const write = Atomics.load(this.header, 1) >>> 0;
  const take = Math.min(length, (write - read) >>> 0);
  for (let channel = 0; channel < Math.min(output.length, this.channels); channel++) {
   const data = output[channel];
   const base = channel * this.capacity;
   for (let i = 0; i < take; i++) data[i] = this.pcm[base + ((read + i) & (this.capacity - 1))];
  }
  Atomics.store(this.header, 0, (read + take) | 0);
  Atomics.add(this.header, 4, take);
  if (take < length) Atomics.add(this.header, 3, length - take);
  return true;
 }
}
registerProcessor('liberty-audio', LibertyAudioProcessor);
