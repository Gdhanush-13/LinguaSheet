import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist";
import { pdfOptions, type PdfPage, type PdfRect, type PdfRegion } from "./pdf";

const RENDER_SCALE = 2;

function pixelRect(rect: PdfRect, width: number, height: number) {
  return {
    x: rect.x * width,
    y: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  };
}

function backgroundColor(
  context: CanvasRenderingContext2D,
  rect: ReturnType<typeof pixelRect>,
) {
  const points = [
    [rect.x - 2, rect.y - 2],
    [rect.x + rect.width + 2, rect.y - 2],
    [rect.x - 2, rect.y + rect.height + 2],
    [rect.x + rect.width + 2, rect.y + rect.height + 2],
  ];
  const colors = points.map(([x, y]) =>
    context.getImageData(
      Math.max(0, Math.min(context.canvas.width - 1, Math.round(x))),
      Math.max(0, Math.min(context.canvas.height - 1, Math.round(y))),
      1,
      1,
    ).data,
  );
  const brightest = colors.sort(
    (first, second) =>
      second[0] + second[1] + second[2] - (first[0] + first[1] + first[2]),
  )[0];
  return `rgb(${brightest[0]}, ${brightest[1]}, ${brightest[2]})`;
}

function overlapsVertically(first: PdfRegion, second: PdfRegion) {
  const overlap =
    Math.min(first.y + first.height, second.y + second.height) -
    Math.max(first.y, second.y);
  return overlap > Math.min(first.height, second.height) * 0.35;
}

function availableWidth(region: PdfRegion, regions: PdfRegion[], canvasWidth: number) {
  const rightNeighbor = regions
    .filter(
      (candidate) =>
        candidate !== region &&
        candidate.x > region.x + region.width * 0.4 &&
        overlapsVertically(region, candidate),
    )
    .sort((a, b) => a.x - b.x)[0];
  const rightEdge = rightNeighbor ? rightNeighbor.x * canvasWidth - 4 : canvasWidth - 4;
  return Math.max(region.width * canvasWidth, rightEdge - region.x * canvasWidth);
}

function applyTranslatedRegions(
  context: CanvasRenderingContext2D,
  regions: PdfRegion[],
) {
  const { width, height } = context.canvas;
  const overlays = regions.filter((region) => region.overlay && region.text.trim());

  for (const region of overlays) {
    const masks = region.masks.length ? region.masks : [region];
    for (const mask of masks) {
      const rect = pixelRect(mask, width, height);
      const padding = Math.max(1.5, rect.height * 0.12);
      context.fillStyle = backgroundColor(context, rect);
      context.fillRect(
        rect.x - padding,
        rect.y - padding,
        rect.width + padding * 2,
        rect.height + padding * 2,
      );
    }
  }

  for (const region of overlays) {
    const rect = pixelRect(region, width, height);
    const maxWidth = availableWidth(region, regions, width);
    let fontSize = Math.min(24, Math.max(9, rect.height * 0.82));
    context.font = `500 ${fontSize}px Arial, sans-serif`;
    while (context.measureText(region.text).width > maxWidth && fontSize > 7) {
      fontSize -= 0.5;
      context.font = `500 ${fontSize}px Arial, sans-serif`;
    }

    context.fillStyle = "#111827";
    context.textBaseline = "top";
    context.fillText(
      region.text.replace(/\s+/g, " ").trim(),
      rect.x,
      rect.y + Math.max(0, (rect.height - fontSize) / 2),
      maxWidth,
    );
  }
}

export async function createTranslatedPdf(file: File, pages: PdfPage[]) {
  const source = await getDocument({
    data: await file.arrayBuffer(),
    ...pdfOptions,
  }).promise;
  const output = await PDFDocument.create();

  try {
    for (const translatedPage of pages) {
      const sourcePage = await source.getPage(translatedPage.page);
      const viewport = sourcePage.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas rendering is unavailable.");

      await sourcePage.render({ canvasContext: context, viewport }).promise;
      applyTranslatedRegions(context, translatedPage.regions);

      const image = await output.embedPng(canvas.toDataURL("image/png"));
      const pdfPage = output.addPage([
        viewport.width / RENDER_SCALE,
        viewport.height / RENDER_SCALE,
      ]);
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: pdfPage.getWidth(),
        height: pdfPage.getHeight(),
      });

      canvas.width = 1;
      canvas.height = 1;
      sourcePage.cleanup();
    }
    return output.save();
  } finally {
    await source.destroy();
  }
}
