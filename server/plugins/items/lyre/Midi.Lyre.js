/**
 * Reads a Standard MIDI File well enough to tell whether the client can play it, and for how long.
 * The client's music synth (RealtimeMidiSynth) plays format 0 and 1 files timed in ticks per quarter
 * note; SMPTE-timed files and format 2 (independent sequences) are refused.
 *
 * readMidi(bytes) returns { format, tracks, division, notes, durationMs } or throws a MidiError whose
 * message says what is wrong, in words a player can read.
 */
class MidiError extends Error {}

const DEFAULT_TEMPO = 500_000; // microseconds per quarter note (120 BPM)

function u16(bytes, at) { return (bytes[at] << 8) | bytes[at + 1]; }
function u32(bytes, at) { return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3]; }

/** One track's events: note-ons with a velocity, tempo changes, and the last tick. */
function readTrack(bytes, start, end, index) {
  let at = start, tick = 0, status = 0, notes = 0;
  const tempos = [];
  const fail = (why) => { throw new MidiError(`track ${index + 1} ${why}`); };
  const varLength = () => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      if (at >= end) fail("ends in the middle of an event");
      const byte = bytes[at++];
      value = (value << 7) | (byte & 0x7f);
      if (byte < 0x80) return value;
    }
    return fail("has a malformed length");
  };
  while (at < end) {
    tick += varLength();
    if (at >= end) fail("ends in the middle of an event");
    let byte = bytes[at];
    if (byte >= 0x80) { at++; if (byte < 0xf0) status = byte; }
    else if (status) byte = status;
    else fail("starts with data before any event");
    if (byte === 0xff) {
      if (at >= end) fail("ends in the middle of an event");
      const type = bytes[at++];
      const length = varLength();
      if (at + length > end) fail("ends in the middle of an event");
      if (type === 0x51 && length === 3) tempos.push([tick, (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2]]);
      at += length;
      if (type === 0x2f) break; // end of track
    } else if (byte === 0xf0 || byte === 0xf7) {
      at += varLength();
      if (at > end) fail("ends in the middle of an event");
    } else {
      const kind = byte & 0xf0;
      const size = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      if (at + size > end) fail("ends in the middle of an event");
      if (kind === 0x90 && bytes[at + 1] > 0) notes++;
      at += size;
    }
  }
  return { notes, tempos, lastTick: tick };
}

/** Milliseconds at `tick`, with the tempo changes (sorted) in force. */
function ticksToMs(tick, tempos, division) {
  let ms = 0, lastTick = 0, tempo = DEFAULT_TEMPO;
  for (const [at, value] of tempos) {
    if (at >= tick) break;
    ms += ((at - lastTick) * tempo) / division / 1000;
    lastTick = at;
    tempo = value;
  }
  return ms + ((tick - lastTick) * tempo) / division / 1000;
}

function readMidi(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 14 || u32(bytes, 0) !== 0x4d546864) throw new MidiError("it isn't a MIDI file");
  const headerLength = u32(bytes, 4);
  if (headerLength < 6) throw new MidiError("its header is too short");
  const format = u16(bytes, 8), declared = u16(bytes, 10), division = u16(bytes, 12);
  if (format > 1) throw new MidiError("format 2 MIDI files aren't supported");
  if (division & 0x8000) throw new MidiError("SMPTE-timed MIDI files aren't supported");
  if (division === 0) throw new MidiError("its timing is missing");
  let at = 8 + headerLength;
  const tracks = [];
  while (at + 8 <= bytes.length && tracks.length < declared) {
    const id = u32(bytes, at), length = u32(bytes, at + 4);
    const end = at + 8 + length;
    if (end > bytes.length) throw new MidiError(`track ${tracks.length + 1} is cut short`);
    if (id === 0x4d54726b) tracks.push(readTrack(bytes, at + 8, end, tracks.length)); // "MTrk"
    at = end;
  }
  if (tracks.length < declared) throw new MidiError(tracks.length === 0 ? "it has no tracks" : "it is cut short");
  const notes = tracks.reduce((sum, track) => sum + track.notes, 0);
  if (notes === 0) throw new MidiError("it has no notes");
  // Format 0/1: tempo changes in any track apply to all.
  const tempos = tracks.flatMap((track) => track.tempos).sort((a, b) => a[0] - b[0]);
  const lastTick = Math.max(...tracks.map((track) => track.lastTick));
  return { format, tracks: tracks.length, division, notes, durationMs: Math.round(ticksToMs(lastTick, tempos, division)) };
}

module.exports = { readMidi, MidiError, ticksToMs };
