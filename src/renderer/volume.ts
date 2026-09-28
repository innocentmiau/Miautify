// How the volume slider maps to loudness.
//
// Hearing is roughly logarithmic: a straight line from 0 to 1 puts nearly all the audible
// change in the bottom of the slider, and the top half barely does anything. Squaring the
// slider position spreads it out, so 50% on the slider (a gain of 0.25) sounds about half
// as loud. Same curve as MiautifyPrivate.
//
// The saved setting is the slider position ("level"), not the gain, so changing this curve
// later doesn't change what anyone's saved volume means.

export const defaultLevel = 0.8;

// Slider position (0 to 1) to the gain applied to the audio (0 to 1).
export function levelToGain(level: number): number {
  return clampLevel(level) ** 2;
}

export function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : defaultLevel;
}
