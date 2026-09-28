// Which rows a scrolled list needs to draw, when every row has the same height.
//
// With a fixed height, row i always starts at i * rowHeight, so the rows in view follow
// from the scroll position alone, without measuring anything. Pure math with no page code,
// so it's unit tested in test/virtual.test.ts.

export interface RowRange {
  start: number; // First row to draw.
  end: number; // One past the last row to draw.
}

// `overscan` extra rows are drawn above and below the visible ones, so scrolling fast
// doesn't show a blank gap before the next frame fills it in.
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): RowRange {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0 };
  }
  const top = Math.max(0, scrollTop);
  const first = Math.floor(top / rowHeight);
  const last = Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight);
  return {
    start: Math.min(count, Math.max(0, first - overscan)),
    end: Math.min(count, last + overscan),
  };
}
