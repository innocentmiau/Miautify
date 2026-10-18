// Remembering the window's size and place between launches.
//
// Saved when the window closes: its normal bounds (the size and place it goes back to when
// un-maximized, even if it was closed maximized) and whether it was maximized. On launch,
// placeWindow checks the saved place against the screens there are now, since a monitor
// may have been unplugged or changed resolution since.
//
// Pure logic with no Electron imports, so it's unit tested in test/window-state.test.ts.

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: Bounds;
  maximized: boolean;
}

export interface Size {
  width: number;
  height: number;
}

// How much of the window has to be on a screen for the saved place to count as visible:
// enough to grab the title bar and drag it back.
const visibleWidth = 100;
const visibleHeight = 50;

// Checks a value read back from storage, which could come from an older version.
export function isWindowState(value: unknown): value is WindowState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { bounds, maximized } = value as Partial<WindowState>;
  return (
    typeof maximized === "boolean" &&
    typeof bounds === "object" &&
    bounds !== null &&
    [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
  );
}

// Where and how big to open the window. `screens` are the usable areas of the screens
// (without taskbars and panels), the primary one first. The saved place is kept if enough
// of the window would be on one of them. Otherwise there's no x and y (the system centers
// the window) and the size fits the primary screen. The size never goes below `min`.
export function placeWindow(saved: Bounds, screens: readonly Bounds[], min: Size): Bounds | Size {
  const screen = screens.find((area) => {
    const width = Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x);
    const height =
      Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y);
    return width >= visibleWidth && height >= visibleHeight;
  });
  const fitsIn = screen ?? screens[0];
  const size = {
    width: fit(saved.width, min.width, fitsIn?.width),
    height: fit(saved.height, min.height, fitsIn?.height),
  };
  return screen ? { x: saved.x, y: saved.y, ...size } : size;
}

// `value`, but no smaller than `min` and no bigger than `max` (when there is one).
function fit(value: number, min: number, max: number | undefined): number {
  return Math.max(min, max === undefined ? value : Math.min(value, max));
}
