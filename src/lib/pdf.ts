import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import ExcelJS from "exceljs";
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

export async function extractPdf(file: File) {
  const pdf = await getDocument({
    data: await file.arrayBuffer(),
    ...pdfOptions,
  }).promise;
  const pages: PdfPage[] = [];
  try {
    const rawFields = await pdf.getFieldObjects();
    const fields: PdfField[] = Object.entries(rawFields ?? {}).flatMap(
      ([name, objects]) =>
        objects.map((object) => {
          const field = object as { type?: unknown; value?: unknown; defaultValue?: unknown; page?: unknown };
          const value = field.value ?? field.defaultValue ?? "";
          return {
            name,
            type: typeof field.type === "string" ? field.type : "Unknown",
            value: Array.isArray(value) ? value.map(String).join(", ") : String(value),
            page: typeof field.page === "number" && field.page >= 0 ? field.page + 1 : null,
          };
        }),
    );
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n);
      const c = await p.getTextContent();
      pages.push({
        page: n,
        text: c.items
          .map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : "") : ""))
          .join("")
          .replace(/[\t\f\v ]+/g, " ")
          .replace(/ *\n */g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
        fields: n === 1 ? fields : [],
      });
      p.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
export async function workbook(
  rows: { page: number; original: string; translated: string; fields: PdfField[]; translatedFields: PdfField[] }[],
  source: string,
  target: string,
) {
  const book = new ExcelJS.Workbook();
  book.creator = "LinguaSheet";
  const sheet = book.addWorksheet("Translation");
  sheet.views = [{ showGridLines: false, state: "frozen", ySplit: 1 }];
  sheet.columns = [
    { header: "Page", key: "page", width: 10 },
    { header: `Original (${source})`, key: "original", width: 56 },
    { header: `Translated (${target})`, key: "translated", width: 64 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF172033" },
  };
  rows.forEach((row) => {
    const excelRow = sheet.addRow(row);
    excelRow.alignment = { vertical: "top", wrapText: true };
  });
  sheet.autoFilter = { from: "A1", to: `C${rows.length + 1}` };
  const fieldRows = rows.flatMap((row) =>
    row.fields.map((field, index) => ({
      page: field.page ?? row.page,
      name: field.name,
      type: field.type,
      original: field.value,
      translated: row.translatedFields[index]?.value ?? field.value,
    })),
  );
  if (fieldRows.length) {
    const fieldSheet = book.addWorksheet("Form Fields");
    fieldSheet.views = [{ showGridLines: false, state: "frozen", ySplit: 1 }];
    fieldSheet.columns = [
      { header: "Page", key: "page", width: 10 },
      { header: "Field name", key: "name", width: 36 },
      { header: "Field type", key: "type", width: 18 },
      { header: `Original (${source})`, key: "original", width: 44 },
      { header: `Translated (${target})`, key: "translated", width: 52 },
    ];
    fieldSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    fieldSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172033" } };
    fieldRows.forEach((row) => {
      const excelRow = fieldSheet.addRow(row);
      excelRow.alignment = { vertical: "top", wrapText: true };
    });
    fieldSheet.autoFilter = { from: "A1", to: `E${fieldRows.length + 1}` };
  }
  return new Blob([await book.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
