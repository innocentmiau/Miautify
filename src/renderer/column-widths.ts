// How wide each song list column is, from how much room its text needs.
//
// All columns grow together, each at the speed of its weight (so the title, weighted
// most, grows fastest). A column stops growing once its widest text fits, and the room it
// would have taken goes to the columns that still need more. Once every column fits, the
// room left over is shared again by weight.
//
// Example, 3 columns of weight 1 with 300px to share: needs of 50, 400 and 400 give 50,
// 125 and 125 (the first is full, the other two split the rest). Needs of 50, 60 and 70
// give 90, 100 and 110 (all fit, and the 120px left is split three ways).
//
// Pure math with no page code, so it's unit tested in test/column-widths.test.ts.

export interface ColumnNeed {
  // Width that shows the column's widest text in full, in pixels.
  need: number;
  // How fast the column grows compared with the others. Above 0.
  weight: number;
}

// Widths in pixels, in the same order as `columns`, adding up to `available`.
export function fitColumns(columns: readonly ColumnNeed[], available: number): number[] {
  const widths = columns.map(() => 0);
  let room = Math.max(0, available);
  // Columns that still need more, the one that's full first coming first: the one with
  // the least need per weight.
  const growing = [...columns.keys()].sort(
    (a, b) => columns[a].need / columns[a].weight - columns[b].need / columns[b].weight,
  );
  let growingWeight = columns.reduce((sum, column) => sum + column.weight, 0);

  // Each pass looks at the column that's full first. If its share of the room is enough,
  // it gets just what it needs and the others share the rest. If not, no column left is
  // full either, so they all split the room by weight and nothing is left over.
  while (growing.length > 0) {
    const index = growing[0];
    const { need, weight } = columns[index];
    if (need > (room * weight) / growingWeight) {
      for (const other of growing) {
        widths[other] = (room * columns[other].weight) / growingWeight;
      }
      return widths;
    }
    widths[index] = need;
    room -= need;
    growingWeight -= weight;
    growing.shift();
  }

  // Everything fits: share what's left by weight.
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  return widths.map((width, index) => width + (room * columns[index].weight) / totalWeight);
}
