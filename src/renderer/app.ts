import { fallbackLanguage, initI18n } from "../shared/i18n.js";

const language = new URLSearchParams(location.search).get("lang") ?? fallbackLanguage;
const t = await initI18n(language);

document.documentElement.lang = language;
document.title = t("app.name");

// Elements are created here rather than written in index.html, so every visible string
// comes from the translation files.
const heading = document.createElement("h1");
heading.textContent = t("app.name");

const message = document.createElement("p");
message.textContent = t("library.empty");

document.getElementById("app")?.append(heading, message);
