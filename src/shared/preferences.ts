// The user's preferences: everything on the Settings page. One list for the whole app, so
// adding a setting means adding it here (plus its row on the Settings page).
//
// Each preference's default also fixes its type: main refuses a value of any other type
// (see isValidPreference), so the page can't store something the app can't read back.
//
// Pure logic with no imports, so it's unit tested in test/preferences.test.ts.

export interface Preferences {
  // Folder view: list the songs of subfolders too, instead of showing subfolder tiles.
  "library.showAllSongs": boolean;
  // Leave files that failed to play out of the lists.
  "library.hideUnplayable": boolean;
}

export type PreferenceKey = keyof Preferences;

export const defaultPreferences: Preferences = {
  "library.showAllSongs": false,
  "library.hideUnplayable": false,
};

// True if `key` is a known preference and `value` has the same type as its default.
export function isValidPreference(key: unknown, value: unknown): key is PreferenceKey {
  return (
    typeof key === "string" &&
    Object.hasOwn(defaultPreferences, key) &&
    typeof value === typeof defaultPreferences[key as PreferenceKey]
  );
}

// Every preference, with the saved value where there is one and the default otherwise.
export function withDefaults(saved: Partial<Record<PreferenceKey, unknown>>): Preferences {
  const preferences = { ...defaultPreferences };
  for (const key of Object.keys(defaultPreferences) as PreferenceKey[]) {
    const value = saved[key];
    if (value !== undefined && isValidPreference(key, value)) {
      Object.assign(preferences, { [key]: value });
    }
  }
  return preferences;
}
