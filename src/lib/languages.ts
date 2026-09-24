export type LanguageCode = "en" | "tl" | "ja";

export type Language = { code: LanguageCode; name: string };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "tl", name: "Filipino (Tagalog)" },
  { code: "ja", name: "Japanese" },
];

export const ENGLISH = LANGUAGES[0];

const tagalogHints = /\b(ang|ng|mga|ito|iyon|ako|ikaw|kami|kayo|sila|ay|at|sa|para|mula|may|pag|hindi|kung|isang|pagsubok|kumusta)\b/gi;

export function detectLanguage(text: string): Language {
  if (/[\u3040-\u30ff]/.test(text)) {
    return LANGUAGES.find(({ code }) => code === "ja")!;
  }
  const tagalogMatches = text.match(tagalogHints)?.length ?? 0;
  return tagalogMatches >= 2
    ? LANGUAGES.find(({ code }) => code === "tl")!
    : ENGLISH;
}
