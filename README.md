# LinguaSheet

LinguaSheet extracts selectable text and AcroForm values directly from Japanese
and Filipino (Tagalog) PDFs, translates them to English, and exports a
reviewable Excel workbook. It does not use OCR.

Live app: https://lingua-sheet.vercel.app

## Features

- Browser-side extraction of embedded PDF text and form-field values
- Japanese and Filipino (Tagalog) to English translation
- Separate `Translation` and `Form Fields` Excel worksheets
- Original and translated values kept side by side
- URLs, email addresses, phone numbers, IDs, codes, and numeric references
  protected during translation
- No server, API key, or paid translation account required

## Translation service

The app calls the MyMemory free translation endpoint directly from the browser.
Long text is split below the service's 500-byte request limit. The service has a
daily free-use quota, so large or repeated documents may reach that limit.

Only extracted text and form values are sent for translation. The PDF file
itself stays in the browser. Do not upload sensitive documents unless using the
third-party translation service is acceptable for that data.

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
- `src/lib/translation.ts` protects structured values, splits text safely, and
  calls the free translation service.
- `src/lib/workbook.ts` creates the Excel workbook.
- `src/lib/languages.ts` contains supported languages and source detection.
- `src/lib/download.ts` handles browser downloads.

## Known limitations

- Image-only and scanned PDFs are unsupported because OCR is intentionally not
  used.
- Complex visual tables are exported as page text rather than reconstructed
  cell by cell.
- Translation quality varies by content; review important translations before
  relying on them.
- The anonymous translation quota is suitable for trials and light usage, not
  large production batches.
