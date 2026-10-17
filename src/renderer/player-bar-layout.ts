// How wide the middle of the player bar (the buttons and the timeline) is.
//
// The middle stays centered in the window, so the two sides are always equally wide. As
// the window grows, the room goes, in this order:
// 1. The middle gets the width of its buttons, so they always fit.
// 2. The sides grow until both are full: the song's title and artist fit on the left,
//    and the volume slider reaches its full width on the right.
// 3. Past that, the middle takes a share of every extra pixel (`middleShare`), so the
//    timeline grows with big screens without ever filling them. The rest stays with the
//    sides, as empty space.
//
// Example: buttons 200px wide, sides needing 300px each. With 800px or less, the middle
// is 200px. With 1200px, there are 400px extra: the middle gets 100px of them (300px).
//
// Pure math with no page code, so it's unit tested in test/player-bar-layout.test.ts.

export interface PlayerBarSizes {
  // Room for the three parts together, in pixels (the gaps between them already taken off).
  available: number;
  // Width of the play buttons.
  buttons: number;
  // Width each side needs to be full: the larger of the two.
  side: number;
}

// The middle's share of the room left once both sides are full.
export const middleShare = 0.25;

export function middleWidth({ available, buttons, side }: PlayerBarSizes): number {
  const extra = available - 2 * side - buttons;
  return buttons + Math.max(0, extra) * middleShare;
}
