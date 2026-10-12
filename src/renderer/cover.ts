// A song's cover on the page: a box that shows a placeholder icon until the picture has
// loaded, and keeps showing it when there's no picture (the cover URL answers 404) or none
// was asked for yet.
//
//   <span class="cover">
//     <svg>  the placeholder, under the picture
//     <img>  hidden until loaded
export function createCover(placeholder: SVGSVGElement): HTMLSpanElement {
  const cover = document.createElement("span");
  cover.className = "cover";
  const image = document.createElement("img");
  // Empty alt: the cover is decoration next to the song's name, not information of its own.
  image.alt = "";
  image.addEventListener("load", () => cover.classList.add("loaded"));
  cover.append(placeholder, image);
  return cover;
}

// Shows the picture at `url` in a cover box, or only the placeholder for null. Asking for
// the picture already shown does nothing, so callers can set it as often as they like.
export function setCover(cover: HTMLElement, url: string | null): void {
  const image = cover.querySelector("img");
  if (!image || image.getAttribute("src") === url) {
    return;
  }
  cover.classList.remove("loaded");
  if (url === null) {
    image.removeAttribute("src");
  } else {
    image.src = url;
  }
}
