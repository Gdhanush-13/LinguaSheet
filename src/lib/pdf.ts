import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import ExcelJS from "exceljs";
GlobalWorkerOptions.workerSrc = workerUrl;
export type PdfPage = { page: number; text: string };

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
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n);
      const c = await p.getTextContent();
      pages.push({
        page: n,
        text: c.items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      });
      p.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
export async function workbook(
  rows: { page: number; original: string; translated: string }[],
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
  return new Blob([await book.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
