import type { LanguageCode } from "./languages";
import type { PdfPage } from "./pdf";

const TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_QUERY_BYTES = 450;
const protectedValue = /https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{5,}\d|\b[A-Z0-9][A-Z0-9/_-]{3,}\b/g;
const japaneseScript = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const letter = /\p{L}/u;

type TranslationResponse = {
  responseData?: { translatedText?: unknown };
  responseDetails?: unknown;
  responseStatus?: unknown;
  quotaFinished?: unknown;
};

function protectValues(text: string) {
  const values: string[] = [];
  return {
    text: text.replace(protectedValue, (value) => {
      values.push(value);
      return ` https://ls.invalid/${values.length - 1} `;
    }),
    values,
  };
}

function restoreValues(text: string, values: string[]) {
  return text.replace(
    /https:\/\/ls\.invalid\/(\d+)/g,
    (placeholder, index: string) => values[Number(index)] ?? placeholder,
  );
}

function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

function preferredBoundary(text: string) {
  return Math.max(
    text.lastIndexOf("\n") + 1,
    text.lastIndexOf(". ") + 2,
    text.lastIndexOf("! ") + 2,
    text.lastIndexOf("? ") + 2,
    text.lastIndexOf("\u3002") + 1,
    text.lastIndexOf("\uff01") + 1,
    text.lastIndexOf("\uff1f") + 1,
    text.lastIndexOf(" ") + 1,
  );
}

export function splitForTranslation(text: string, maxBytes = MAX_QUERY_BYTES) {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of text) {
    if (utf8Length(chunk + character) <= maxBytes) {
      chunk += character;
      continue;
    }
    const boundary = preferredBoundary(chunk);
    const cut = boundary >= Math.floor(chunk.length / 2) ? boundary : chunk.length;
    chunks.push(chunk.slice(0, cut));
    chunk = chunk.slice(cut) + character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function translateText(
  text: string,
  sourceCode: LanguageCode,
  targetCode: LanguageCode,
) {
  if (!text.trim() || sourceCode === targetCode) return text;

  const safe = protectValues(text);
  const translated: string[] = [];
  for (const chunk of splitForTranslation(safe.text)) {
    const query = new URLSearchParams({
      q: chunk,
      langpair: `${sourceCode}|${targetCode}`,
    });
    const response = await fetch(`${TRANSLATION_ENDPOINT}?${query.toString()}`);
    const result = (await response.json().catch(() => null)) as TranslationResponse | null;
    const translatedText = result?.responseData?.translatedText;
    if (
      !response.ok ||
      Number(result?.responseStatus) !== 200 ||
      result?.quotaFinished === true ||
      typeof translatedText !== "string"
    ) {
      throw new Error(
        typeof result?.responseDetails === "string"
          ? result.responseDetails
          : "The free translation service is unavailable or its daily quota has been reached.",
      );
    }
    translated.push(translatedText);
  }
  return restoreValues(translated.join(""), safe.values);
}

export async function translatePages(
  pages: PdfPage[],
  sourceCode: LanguageCode,
  targetCode: LanguageCode,
) {
  if (sourceCode === targetCode) return pages;
  const hasContent = pages.some(
    (page) => page.text.trim() || page.fields.some((field) => field.value.trim()),
  );
  if (!hasContent) {
    throw new Error(
      "No PDF text or form values were extracted or recognized.",
    );
  }

  const output: PdfPage[] = [];
  for (const page of pages) {
    const regions = [];
    for (const region of page.regions) {
      const japaneseCharacters = region.text.match(
        /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g,
      )?.length ?? 0;
      const reliableRegion =
        region.height < 0.045 &&
        (region.confidence >= 40 || japaneseCharacters >= 2);
      const overlay =
        sourceCode === "ja"
          ? reliableRegion && japaneseScript.test(region.text)
          : sourceCode === "tl" && reliableRegion && letter.test(region.text);
      regions.push({
        ...region,
        text: overlay
          ? await translateText(region.text, sourceCode, targetCode)
          : region.text,
        overlay,
      });
    }
    const fields = [];
    for (const field of page.fields) {
      fields.push({
        ...field,
        name: await translateText(field.name, sourceCode, targetCode),
        value: await translateText(field.value, sourceCode, targetCode),
      });
    }
    output.push({
      ...page,
      text: regions.length
        ? regions.map((region) => region.text).join("\n")
        : await translateText(page.text, sourceCode, targetCode),
      fields,
      regions,
    });
  }
  return output;
}
