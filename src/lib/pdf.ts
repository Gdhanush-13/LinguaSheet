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

export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfRegion = PdfRect & {
  text: string;
  confidence: number;
  masks: PdfRect[];
  overlay?: boolean;
};

export type PdfPage = {
  page: number;
  text: string;
  fields: PdfField[];
  regions: PdfRegion[];
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

type PositionedTextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
};

type PdfViewport = {
  width: number;
  height: number;
  convertToViewportPoint(x: number, y: number): number[];
};

export const pdfOptions = {
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

function tesseractLanguage(language: LanguageCode) {
  if (language === "ja") return "jpn";
  if (language === "tl") return "fil";
  return "eng";
}

function normalizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): PdfRect {
  return {
    x: Math.max(0, x / pageWidth),
    y: Math.max(0, y / pageHeight),
    width: Math.min(1, Math.max(0, width / pageWidth)),
    height: Math.min(1, Math.max(0, height / pageHeight)),
  };
}

function embeddedRegions(
  items: PositionedTextItem[],
  viewport: PdfViewport,
) {
  const fragments = items
    .filter((item) => item.str.trim())
    .map((item) => {
      const [x, baseline] = viewport.convertToViewportPoint(
        item.transform[4],
        item.transform[5],
      );
      const height = Math.max(
        Math.abs(item.height),
        Math.hypot(item.transform[2], item.transform[3]),
        6,
      );
      return {
        text: item.str.trim(),
        x,
        y: baseline - height,
        width: Math.max(item.width, 2),
        height,
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: typeof fragments[] = [];
  for (const fragment of fragments) {
    const line = lines.find((candidate) => {
      const first = candidate[0];
      return Math.abs(first.y - fragment.y) <= Math.max(first.height, fragment.height) * 0.65;
    });
    if (line) line.push(fragment);
    else lines.push([fragment]);
  }

  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const x0 = Math.min(...line.map(({ x }) => x));
    const y0 = Math.min(...line.map(({ y }) => y));
    const x1 = Math.max(...line.map(({ x, width }) => x + width));
    const y1 = Math.max(...line.map(({ y, height }) => y + height));
    const text = line
      .map((fragment, index) => {
        if (!index) return fragment.text;
        const previous = line[index - 1];
        const gap = fragment.x - (previous.x + previous.width);
        return `${gap > 2 ? " " : ""}${fragment.text}`;
      })
      .join("");
    return {
      ...normalizeRect(
        x0,
        y0,
        x1 - x0,
        y1 - y0,
        viewport.width,
        viewport.height,
      ),
      text,
      confidence: 100,
      masks: line.map((fragment) =>
        normalizeRect(
          fragment.x,
          fragment.y,
          fragment.width,
          fragment.height,
          viewport.width,
          viewport.height,
        ),
      ),
    };
  });
}

function ocrRegions(data: import("tesseract.js").Page, width: number, height: number) {
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines
        .filter((line) => line.text.trim())
        .map((line) => ({
          ...normalizeRect(
            line.bbox.x0,
            line.bbox.y0,
            line.bbox.x1 - line.bbox.x0,
            line.bbox.y1 - line.bbox.y0,
            width,
            height,
          ),
          text: normalizeText(line.text),
          confidence: line.confidence,
          masks: line.words.map((word) =>
            normalizeRect(
              word.bbox.x0,
              word.bbox.y0,
              word.bbox.x1 - word.bbox.x0,
              word.bbox.y1 - word.bbox.y0,
              width,
              height,
            ),
          ),
        })),
    ),
  );
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
      const textItems = content.items.filter(
        (item): item is Extract<typeof item, { str: string }> => "str" in item,
      );
      const text = textItems
        .map((item) => item.str + (item.hasEOL ? "\n" : ""))
        .join("");
      const pageFields = fields.filter(
        (field) =>
          field.page === pageNumber ||
          (field.page === null && pageNumber === 1),
      );
      let normalizedText = normalizeText(text);
      let regions = embeddedRegions(textItems, page.getViewport({ scale: 1 }));
      let usedOcr = false;

      if (!normalizedText && !pageFields.some((field) => field.value.trim())) {
        activeOcrPage = pageNumber;
        if (!ocrWorker) {
          const { createWorker, OEM } = await import("tesseract.js");
          ocrWorker = await createWorker(
            tesseractLanguage(options.ocrLanguage),
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
        const result = await ocrWorker.recognize(canvas, {}, { blocks: true });
        normalizedText = normalizeText(result.data.text);
        regions = ocrRegions(result.data, canvas.width, canvas.height);
        usedOcr = true;
        canvas.width = 1;
        canvas.height = 1;
      }

      pages.push({
        page: pageNumber,
        text: normalizedText,
        fields: pageFields,
        regions,
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
