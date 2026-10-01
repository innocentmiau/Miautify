import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPreferences, isValidPreference, withDefaults } from "../src/shared/preferences.ts";

describe("isValidPreference", () => {
  it("accepts a known key with a value of the right type", () => {
    assert.equal(isValidPreference("library.showAllSongs", true), true);
  });

  it("refuses unknown keys, wrong types and non-string keys", () => {
    assert.equal(isValidPreference("library.nope", true), false);
    assert.equal(isValidPreference("library.showAllSongs", "yes"), false);
    assert.equal(isValidPreference(42, true), false);
    // Inherited object properties aren't preferences.
    assert.equal(isValidPreference("toString", true), false);
  });
});

describe("withDefaults", () => {
  it("fills in every preference that was never saved", () => {
    assert.deepEqual(withDefaults({}), defaultPreferences);
  });

  it("keeps saved values and ignores broken ones", () => {
    const preferences = withDefaults({
      "library.showAllSongs": true,
      "library.hideUnplayable": "not a boolean",
    });
    assert.equal(preferences["library.showAllSongs"], true);
    assert.equal(preferences["library.hideUnplayable"], false);
  });
});
