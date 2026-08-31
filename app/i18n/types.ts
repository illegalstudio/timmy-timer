import { en } from "./messages/en";

export type Locale = "en" | "it" | "fr" | "de";
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type TranslationValues = Record<string, string | number>;
