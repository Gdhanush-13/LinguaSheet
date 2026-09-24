import ExcelJS from "exceljs";
import type { PdfField } from "./pdf";

export type WorkbookRow = {
  page: number;
  original: string;
  translated: string;
  fields: PdfField[];
  translatedFields: PdfField[];
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF172033" },
  };
}

export async function createWorkbook(
  rows: WorkbookRow[],
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
  styleHeader(sheet.getRow(1));
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
    fieldSheet.views = [
      { showGridLines: false, state: "frozen", ySplit: 1 },
    ];
    fieldSheet.columns = [
      { header: "Page", key: "page", width: 10 },
      { header: "Field name", key: "name", width: 36 },
      { header: "Field type", key: "type", width: 18 },
      { header: `Original (${source})`, key: "original", width: 44 },
      { header: `Translated (${target})`, key: "translated", width: 52 },
    ];
    styleHeader(fieldSheet.getRow(1));
    fieldRows.forEach((row) => {
      const excelRow = fieldSheet.addRow(row);
      excelRow.alignment = { vertical: "top", wrapText: true };
    });
    fieldSheet.autoFilter = {
      from: "A1",
      to: `E${fieldRows.length + 1}`,
    };
  }

  return new Blob([await book.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
