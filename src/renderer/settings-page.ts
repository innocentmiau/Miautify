import type { Preferences } from "../shared/preferences.js";

// The preferences that are on/off switches.
type ToggleKey = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

// One switch on the Settings page.
export interface ToggleRow {
  key: ToggleKey;
  label: string;
  description: string;
}

// A titled group on the Settings page: switches, and/or any other content (like the list
// of keyboard shortcuts).
export interface SettingsSection {
  title: string;
  rows?: ToggleRow[];
  content?: HTMLElement;
}

export interface SettingsPageOptions {
  title: string;
  closeLabel: string;
  sections: SettingsSection[];
  // A switch was flipped. The app saves it and applies it.
  onChange(key: ToggleKey, value: boolean): void;
}

// The Settings window: every option of the app in one place, so the player itself stays
// clean. A native <dialog>: Escape closes it and focus stays inside while it's open.
//
// Adding a setting: add it to shared/preferences.ts, then a row in a section here (see
// app.ts), plus its text in the translations.
export class SettingsPage {
  readonly element = document.createElement("dialog");
  readonly #switches = new Map<ToggleKey, HTMLInputElement>();

  constructor(options: SettingsPageOptions) {
    this.element.className = "settings";

    const title = document.createElement("h2");
    title.textContent = options.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "secondary";
    close.textContent = options.closeLabel;
    close.addEventListener("click", () => this.element.close());
    const header = document.createElement("header");
    header.append(title, close);

    const body = document.createElement("div");
    body.className = "settings-body";
    for (const section of options.sections) {
      body.append(this.#section(section, options.onChange));
    }

    this.element.append(header, body);
  }

  get isOpen(): boolean {
    return this.element.open;
  }

  // Opens the page with every switch showing its current value.
  open(preferences: Preferences): void {
    for (const [key, input] of this.#switches) {
      input.checked = preferences[key];
    }
    this.element.showModal();
  }

  #section(section: SettingsSection, onChange: SettingsPageOptions["onChange"]): HTMLElement {
    const element = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = section.title;
    element.append(heading);

    for (const row of section.rows ?? []) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "toggle-switch";
      // A switch, not a plain checkbox, for screen readers too: it takes effect right away.
      input.setAttribute("role", "switch");
      input.addEventListener("change", () => onChange(row.key, input.checked));
      this.#switches.set(row.key, input);

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = row.label;
      const description = document.createElement("span");
      description.className = "description";
      description.textContent = row.description;
      const text = document.createElement("span");
      text.className = "text";
      text.append(label, description);

      // Clicking anywhere on the row (it's a <label>) flips the switch.
      const rowElement = document.createElement("label");
      rowElement.className = "setting-row";
      rowElement.append(text, input);
      element.append(rowElement);
    }

    if (section.content) {
      element.append(section.content);
    }
    return element;
  }
}
