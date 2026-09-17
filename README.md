# LinguaSheet

Translate PDFs. Structure data. Export anywhere.

LinguaSheet is a separate companion app to PDF2Excel. The existing PDF2Excel source is not modified. The frontend extracts text with `pdfjs-dist` and creates formatted Excel workbooks with `ExcelJS`. Translation uses only a self-hosted Argos Translate service—no OpenAI, Google Translate, Azure Translator, paid API, or frontend secret.

## Features

- PDF upload, size/type validation, page preview, language detection, and manual source override
- Japanese → English priority support when the Argos Japanese-English package is installed
- English, Japanese, Spanish, French, German, Portuguese, Hindi, Telugu, Tamil, Arabic, Chinese, Korean, Russian, Italian, Dutch, Turkish, Vietnamese, and Thai language choices
- Direct PDF → Excel flow without translation
- Page, Original, and Translated Excel columns with wrapping, filters, and frozen header
- Protection for URLs, emails, phone numbers, IDs, codes, and numeric references

## Run locally

Frontend:

```bash
npm install
npm run dev
```

Backend (from this folder):

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r backend_requirements.txt
uvicorn backend_main:app --reload --port 8000
```

Install the Argos language packages for each pair you need. Argos model packages are open-source and are not bundled in this repository because they are large and pair-specific. Set `VITE_TRANSLATION_API_URL=http://localhost:8000` if the frontend needs a non-default backend URL.

## Deployment

Deploy the frontend as its own Vercel project. The included `render.yaml` deploys `backend_main.py` as a Render web service. Set `FRONTEND_ORIGIN` to the Vercel URL, install the required Argos model packages on the service, and set `VITE_TRANSLATION_API_URL` to the Render URL. Vercel serverless functions are not suitable for bundling all Argos models and Japanese OCR dependencies.

## Known limitations

Normal text PDFs are supported by the browser extractor. Scanned PDFs need a backend OCR endpoint using Tesseract with the `jpn` language pack (or another OCR engine) before translation. Complex tables are exported as page-associated text rows rather than reconstructed cell-by-cell. Quality depends on the installed Argos model pair.
