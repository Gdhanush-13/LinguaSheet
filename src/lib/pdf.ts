import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { LanguageCode } from "./languages";

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfField = {
  name: string;
  type: string;
  value: string;
  page: number | null;
};

export type PdfPage = {
  page: number;
  text: string;
  fields: PdfField[];
  usedOcr: boolean;
};

export type OcrProgress = {
  page: number;
  totalPages: number;
  status: string;
  progress: number;
};

type ExtractionOptions = {
  ocrLanguage: LanguageCode;
  onOcrProgress?: (progress: OcrProgress) => void;
};

const pdfOptions = {
  cMapUrl: "/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/standard_fonts/",
};

function normalizeText(text: string) {
  return text
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tesseractLanguages(language: LanguageCode) {
  if (language === "ja") return "jpn";
  if (language === "tl") return "fil";
  return "eng";
}

export async function extractPdf(
  file: File,
  options: ExtractionOptions,
): Promise<PdfPage[]> {
  const pdf = await getDocument({
    data: await file.arrayBuffer(),
    ...pdfOptions,
  }).promise;

  let ocrWorker: import("tesseract.js").Worker | undefined;
  let activeOcrPage = 1;

  try {
    const rawFields = await pdf.getFieldObjects();
    const fields: PdfField[] = Object.entries(rawFields ?? {}).flatMap(
      ([name, objects]) =>
        objects.map((object) => {
          const field = object as {
            type?: unknown;
            value?: unknown;
            defaultValue?: unknown;
            page?: unknown;
          };
          const value = field.value ?? field.defaultValue ?? "";
          return {
            name,
            type: typeof field.type === "string" ? field.type : "Unknown",
            value: Array.isArray(value)
              ? value.map(String).join(", ")
              : String(value),
            page:
              typeof field.page === "number" && field.page >= 0
                ? field.page + 1
                : null,
          };
        }),
    );

    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : "") : "",
        )
        .join("");
      const pageFields = fields.filter(
        (field) =>
          field.page === pageNumber ||
          (field.page === null && pageNumber === 1),
      );
      let normalizedText = normalizeText(text);
      let usedOcr = false;

      if (
        !normalizedText &&
        !pageFields.some((field) => field.value.trim())
      ) {
        activeOcrPage = pageNumber;
        if (!ocrWorker) {
          const { createWorker, OEM } = await import("tesseract.js");
          ocrWorker = await createWorker(
            tesseractLanguages(options.ocrLanguage),
            OEM.LSTM_ONLY,
            {
              logger: (message) =>
                options.onOcrProgress?.({
                  page: activeOcrPage,
                  totalPages: pdf.numPages,
                  status: message.status,
                  progress: message.progress,
                }),
            },
          );
        }

        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable for OCR.");
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await ocrWorker.recognize(canvas);
        normalizedText = normalizeText(result.data.text);
        usedOcr = true;
        canvas.width = 1;
        canvas.height = 1;
      }

      pages.push({
        page: pageNumber,
        text: normalizedText,
        fields: pageFields,
        usedOcr,
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await ocrWorker?.terminate();
    await pdf.destroy();
  }
}
