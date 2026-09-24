import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfField = {
  name: string;
  type: string;
  value: string;
  page: number | null;
};

export type PdfPage = { page: number; text: string; fields: PdfField[] };

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

export async function extractPdf(file: File): Promise<PdfPage[]> {
  const pdf = await getDocument({
    data: await file.arrayBuffer(),
    ...pdfOptions,
  }).promise;

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
      pages.push({
        page: pageNumber,
        text: normalizeText(text),
        fields: fields.filter(
          (field) =>
            field.page === pageNumber ||
            (field.page === null && pageNumber === 1),
        ),
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
