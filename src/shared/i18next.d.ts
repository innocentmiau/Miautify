// Tells TypeScript which keys exist, so t("libary.empty") is a compile error.
import "i18next";
import type en from "../locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
