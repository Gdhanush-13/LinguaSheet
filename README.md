# LinguaSheet

Translate PDF text and export it to Excel.

LinguaSheet is a separate companion app to [PDF2Excel](https://github.com/Gdhanush-13/PDF2Excel). It extracts text from normal, text-based PDFs in the browser, optionally translates the extracted pages through a self-hosted Argos Translate backend, and creates a reviewable `.xlsx` workbook.

No OpenAI, Google Translate, Azure Translator, or other paid translation API is used.

## Live deployment

- Frontend: https://lingua-sheet.vercel.app
- Translation API: https://linguasheet-translation.onrender.com
- API health check: https://linguasheet-translation.onrender.com/health
- Source repository: https://github.com/Gdhanush-13/LinguaSheet

The Vercel project uses `VITE_TRANSLATION_API_URL` to connect to Render. Render uses `FRONTEND_ORIGIN` for CORS.

## Features

- PDF upload with PDF-only and 25 MB validation
- Browser-side text extraction with page preview
- Source-language detection with manual source-language selection
- English, Filipino, Japanese, Spanish, French, German, Portuguese, Hindi, Telugu, Tamil, Arabic, Chinese, Korean, Russian, Italian, Dutch, Turkish, Vietnamese, and Thai choices
- Full-document translation: the page list is for preview navigation only; translation and Excel export include every extracted page
- Direct PDF-to-Excel export without translation
- Page, original, and translated Excel columns with wrapping, filters, and frozen headers
- Preservation of URLs, email addresses, phone numbers, IDs, codes, and numeric references during translation

## Run locally

Install and start the frontend:

```bash
npm install
npm run dev
```

Start the backend from this folder:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r backend_requirements.txt
python -m uvicorn backend_main:app --reload --port 8000
```

For local frontend-to-backend translation, create `.env.local` from `.env.example`:

```env
VITE_TRANSLATION_API_URL=http://localhost:8000
```

Install the Argos language model packages for each language pair you need. They are not bundled because they are large and pair-specific. Filipino uses Argos code `tl` (Tagalog); install the English↔Tagalog packages for English/Filipino translation.

## Deploy

### Vercel frontend

Import this repository as a Vite project using the repository root. Add this production environment variable:

```env
VITE_TRANSLATION_API_URL=https://linguasheet-translation.onrender.com
```

### Render backend

The included `render.yaml` installs `backend_requirements.txt`, installs the priority Japanese→English and Filipino/Tagalog→English Argos model pairs, starts `backend_main.py`, and checks `/health`. Override the model list with `ARGOS_PAIRS` using comma-separated pairs such as `ja:en,tl:en`.

Set this Render environment variable to the deployed Vercel origin:

```env
FRONTEND_ORIGIN=https://lingua-sheet.vercel.app
```

The Render free instance can sleep after inactivity, so the first request may take longer while it wakes up.

## API

`GET /health` returns the service status and translation engine.

`POST /translate` accepts:

```json
{
  "pages": [{"page": 1, "text": "Hello"}],
  "source": "en",
  "target": "ja"
}
```

If source and target are the same, the original pages are returned. If the requested Argos model pair is not installed, the API returns HTTP 503.

## Known limitations

Scanned/image-only PDFs need OCR before translation. Complex tables are exported as page-associated text rows rather than reconstructed cell-by-cell. Translation quality depends on the installed Argos model pair.
