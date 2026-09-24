# LinguaSheet

LinguaSheet extracts selectable text and AcroForm values directly from Japanese
and Filipino (Tagalog) PDFs, translates them to English, and exports a
translated English PDF and a page-for-page Excel workbook. Image-only pages use
an automatic browser OCR fallback.

Live app: https://lingua-sheet.vercel.app

## Features

- Browser-side extraction of embedded PDF text and form-field values
- Browser-side Tesseract OCR fallback for scanned Japanese and Filipino pages
- Japanese and Filipino (Tagalog) to English translation
- Downloadable English PDF generated from the translated content
- One-sheet Excel output containing images of the translated English PDF pages
- Original PDF page order and form-field grouping retained in the English output
- URLs, email addresses, phone numbers, IDs, codes, and numeric references
  protected during translation
- No server, API key, or paid translation account required

## Translation service

The app calls the MyMemory free translation endpoint directly from the browser.
Long text is split below the service's 500-byte request limit. The service has a
daily free-use quota, so large or repeated documents may reach that limit.

Only extracted or OCR-recognized text and form values are sent for translation.
The PDF file and page images stay in the browser. Tesseract language data is
downloaded on demand and cached by the browser. Do not upload sensitive
documents unless using the third-party translation service is acceptable for
the extracted text.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Render

The repository includes `render.yaml` for a Render static site. It runs
`npm ci && npm run build` and publishes `dist`.

If an existing Render service still runs Python, Argos, `pip`, or
`install_argos_models.py`, that service is using its old backend settings.
Create a new Blueprint from this repository, or change the existing service to
a static site with the build command and publish directory above.

## Architecture

- `src/App.tsx` coordinates the upload, translation, preview, and downloads.
- `src/lib/pdf.ts` extracts embedded PDF text and AcroForm values in the browser.
- `src/lib/pdf.ts` also renders empty pages locally and runs Tesseract with
  `jpn` or `fil`, according to the selected document language.
- `src/lib/translation.ts` protects structured values, splits text safely, and
  calls the free translation service.
- `src/lib/translated-pdf.ts` creates the paginated English PDF.
- `src/lib/workbook.ts` renders the English PDF pages and embeds them in Excel.
- `src/lib/languages.ts` contains supported languages and source detection.
- `src/lib/download.ts` handles browser downloads.

## Known limitations

- OCR quality depends on scan resolution and clarity. Handwriting, signatures,
  checkboxes, and dense tables can require manual review.
- The generated English PDF uses a clean document layout. It retains page
  grouping and content, but does not reproduce the source PDF's exact fonts,
  coordinates, graphics, or complex table geometry.
- Excel contains rendered page images, following the original PDF-to-Excel
  application's workflow. Its content is not split into editable table cells.
- Translation quality varies by content; review important translations before
  relying on them.
- The anonymous translation quota is suitable for trials and light usage, not
  large production batches.
