import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PdfPage } from "./pdf";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const BODY_SIZE = 10.5;
const LINE_HEIGHT = 15;

function pdfSafe(text: string) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (!text) return [""];
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(fragment + character, size) <= maxWidth) {
        fragment += character;
      } else {
        if (fragment) lines.push(fragment);
        fragment = character;
      }
    }
    line = fragment;
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  return text
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line, font, size, maxWidth));
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  sourcePage: number,
  continued: boolean,
) {
  page.drawText("LINGUASHEET", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 9,
    font: bold,
    color: rgb(0.12, 0.37, 0.82),
  });
  page.drawText(
    `English translation - source page ${sourcePage}${continued ? " (continued)" : ""}`,
    {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - 22,
      size: 15,
      font: bold,
      color: rgb(0.08, 0.11, 0.18),
    },
  );
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 34 },
    thickness: 0.8,
    color: rgb(0.82, 0.85, 0.9),
  });
  page.drawText("Generated from selectable PDF text without OCR", {
    x: MARGIN,
    y: 24,
    size: 7.5,
    font,
    color: rgb(0.42, 0.46, 0.54),
  });
}

export async function createTranslatedPdf(pages: PdfPage[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  for (const source of pages) {
    let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let continued = false;
    let y = PAGE_HEIGHT - MARGIN - 58;
    drawHeader(page, font, bold, source.page, continued);

    const nextPage = () => {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      continued = true;
      y = PAGE_HEIGHT - MARGIN - 58;
      drawHeader(page, font, bold, source.page, continued);
    };

    const drawLines = (lines: string[], options?: { bold?: boolean; gap?: number }) => {
      if (options?.gap) y -= options.gap;
      for (const line of lines) {
        if (y < 48) nextPage();
        if (line) {
          page.drawText(line, {
            x: MARGIN,
            y,
            size: BODY_SIZE,
            font: options?.bold ? bold : font,
            color: rgb(0.1, 0.13, 0.2),
          });
        }
        y -= LINE_HEIGHT;
      }
    };

    const bodyLines = wrapText(
      source.text || "No selectable text was found on this source page.",
      font,
      BODY_SIZE,
      maxWidth,
    );
    drawLines(bodyLines);

    if (source.fields.length) {
      drawLines(["Form fields"], { bold: true, gap: 14 });
      for (const field of source.fields) {
        const label = `${field.name} (${field.type})`;
        drawLines(wrapText(label, bold, BODY_SIZE, maxWidth), {
          bold: true,
          gap: 5,
        });
        drawLines(
          wrapText(field.value || "(empty)", font, BODY_SIZE, maxWidth),
        );
      }
    }
  }

  return document.save();
}
