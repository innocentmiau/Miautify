import type { Folder } from "./folders.js";

export interface FolderTreeOptions {
  // A folder name was clicked.
  onOpen(folder: Folder): void;
  // Screen reader labels for the expand arrow.
  expandLabel: string;
  collapseLabel: string;
}

// The folder tree in the main menu: nested lists of folder buttons, each with an arrow to
// show or hide its subfolders. Only expanded folders have their children on the page, so a
// library with hundreds of folders stays light.
export class FolderTree {
  readonly element = document.createElement("ul");
  readonly #options: FolderTreeOptions;
  #tree: Folder | null = null;
  #open: Folder | null = null;
  // Expanded folders, by their path ("" is the root). Kept by path, not by object, because
  // a rescan builds a new tree with new objects for the same folders.
  readonly #expanded = new Set<string>([""]);

  constructor(options: FolderTreeOptions) {
    this.#options = options;
    this.element.className = "folder-tree";
  }

  setTree(tree: Folder | null): void {
    this.#tree = tree;
    this.#render();
  }

  // Highlights the open folder and expands its parents, so it's visible in the tree.
  setOpen(folder: Folder): void {
    this.#open = folder;
    for (let depth = 0; depth < folder.segments.length; depth++) {
      this.#expanded.add(key(folder.segments.slice(0, depth)));
    }
    this.#render();
  }

  #render(): void {
    this.element.replaceChildren(...(this.#tree ? [this.#item(this.#tree)] : []));
  }

  #item(folder: Folder): HTMLLIElement {
    const item = document.createElement("li");
    const row = document.createElement("div");
    row.className = "folder-tree-row";
    // Indent by depth; the variable is read by the CSS.
    row.style.setProperty("--depth", String(folder.segments.length));

    const folderKey = key(folder.segments);
    const expanded = this.#expanded.has(folderKey);

    if (folder.folders.length > 0) {
      const arrow = document.createElement("button");
      arrow.type = "button";
      arrow.className = "arrow";
      arrow.textContent = expanded ? "▾" : "▸";
      arrow.setAttribute("aria-expanded", String(expanded));
      arrow.setAttribute(
        "aria-label",
        expanded ? this.#options.collapseLabel : this.#options.expandLabel,
      );
      arrow.addEventListener("click", () => {
        if (expanded) {
          this.#expanded.delete(folderKey);
        } else {
          this.#expanded.add(folderKey);
        }
        this.#render();
      });
      row.append(arrow);
    } else {
      // Keeps names lined up with their siblings that do have an arrow.
      const spacer = document.createElement("span");
      spacer.className = "arrow";
      row.append(spacer);
    }

    const name = document.createElement("button");
    name.type = "button";
    name.className = "name";
    name.textContent = folder.name;
    name.title = folder.name;
    if (this.#open && key(this.#open.segments) === folderKey) {
      name.setAttribute("aria-current", "location");
    }
    name.addEventListener("click", () => this.#options.onOpen(folder));
    row.append(name);
    item.append(row);

    if (expanded && folder.folders.length > 0) {
      const children = document.createElement("ul");
      children.append(...folder.folders.map((child) => this.#item(child)));
      item.append(children);
    }
    return item;
  }
}

function key(segments: readonly string[]): string {
  return segments.join("/");
}
