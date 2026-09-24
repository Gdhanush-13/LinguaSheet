import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
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

export async function createTranslatedPdf(pages: PdfPage[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  for (const source of pages) {
    let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const nextPage = () => {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
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

    if (source.text) {
      drawLines(wrapText(source.text, font, BODY_SIZE, maxWidth));
    }

    if (source.fields.length) {
      for (const field of source.fields) {
        drawLines(wrapText(field.name, bold, BODY_SIZE, maxWidth), {
          bold: true,
          gap: source.text ? 10 : 0,
        });
        if (field.value) {
          drawLines(wrapText(field.value, font, BODY_SIZE, maxWidth));
        }
      }
    }
  }

  return document.save();
}
