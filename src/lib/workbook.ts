import ExcelJS from "exceljs";
import { getDocument } from "pdfjs-dist";

export type ImageQuality = "standard" | "high";

export async function createPdfImageWorkbook(
  pdfBytes: Uint8Array,
  quality: ImageQuality = "high",
  onProgress?: (percent: number) => void,
) {
    const pdf = await getDocument({ data: pdfBytes.slice() }).promise;
  try {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Sheet1");
    sheet.views = [{ showGridLines: false }];
    let row = 1;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const scale = quality === "high" ? 3 : 1.75;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable.");

      await page.render({ canvasContext: context, viewport }).promise;
      const imageId = book.addImage({
        base64: canvas.toDataURL("image/png"),
        extension: "png",
      });
      sheet.addImage(imageId, {
        tl: { col: 0, row: row - 1 },
        ext: { width: viewport.width / 2, height: viewport.height / 2 },
      });
      sheet.getColumn(1).width = Math.min(
        100,
        Math.max(1, viewport.width / 7.5),
      );
      row += Math.ceil(viewport.height / 20) + 4;
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      onProgress?.(Math.round((pageNumber / pdf.numPages) * 100));
    }

    const buffer = await book.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } finally {
    await pdf.destroy();
  }
}
