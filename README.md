# LinguaSheet

Translate PDF text and export it to Excel.

LinguaSheet is a separate companion app to [PDF2Excel](https://github.com/Gdhanush-13/PDF2Excel). It extracts selectable text and AcroForm values directly from PDFs in the browser, translates them through a self-hosted Argos Translate backend, and creates a reviewable `.xlsx` workbook. It does not use OCR.

No OpenAI, Google Translate, Azure Translator, or other paid translation API is used.

## Live deployment

- Frontend: https://lingua-sheet.vercel.app
- Backend: Oracle Cloud Always Free VM deployment (URL configured after VM setup)
- Source repository: https://github.com/Gdhanush-13/LinguaSheet

The Vercel project uses `VITE_TRANSLATION_API_URL` to connect to the self-hosted
backend. Set `FRONTEND_ORIGIN` to the Vercel origin on the backend.

## Features

- PDF upload with PDF-only and 25 MB validation
- Browser-side extraction of embedded text and AcroForm form field names, types, and values
- Source-language detection with manual source-language selection
- Japanese and Filipino (Tagalog) source languages, with English as the output language
- Full-document translation: the page list is for preview navigation only; translation and Excel export include every extracted page
- Direct PDF-to-Excel export without translation
- Page text and form values exported to separate Excel sheets with original and translated columns
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

Install the Argos language model packages for each language pair you need. They are not bundled because they are large and pair-specific. Filipino uses Argos code `tl` (Tagalog); install the English↔Tagalog packages for English/Filipino translation. Run `python install_argos_models.py` to install the default Japanese→English and Tagalog→English models before starting the backend.

## Deploy

### Vercel frontend

Import this repository as a Vite project using the repository root. Add this production environment variable:

```env
VITE_TRANSLATION_API_URL=https://linguasheet-translation.onrender.com
```

### Oracle Cloud Always Free backend

Google Cloud Run was not used because Google requires an active Cloud Billing
account even when usage is intended to stay within the Free Tier. Render was
also not upgraded. The recommended free-development host is an Oracle Cloud
Always Free Ampere A1 VM. `Dockerfile` installs and verifies only the Japanese-
to-English and Tagalog-to-English Argos packages inside the image, so runtime
storage is not required for the model files.

For an A1 Ubuntu VM, run `oracle-cloud-init.sh` or use the equivalent commands
from `docker-compose.oracle.yml`. The VM must have inbound TCP 8080 allowed and
should use HTTPS through a reverse proxy before production use.

The PDF remains in the browser. The backend receives only extracted page text
and form values for translation and does not receive or store the uploaded PDF
file. No public translation API is used.

The Oracle Always Free VM is the recommended self-hosted backend for always-on
use. Render remains a lightweight development option; its free service can
sleep between requests, so its first translation request may be slow while it
wakes up.

The included `render.yaml` installs `backend_requirements.txt` and the priority Japanese→English and Filipino/Tagalog→English Argos model pairs during its build, starts `backend_main.py`, and checks `/health`. Override the model list with `ARGOS_PAIRS` using comma-separated pairs such as `ja:en,tl:en`.

Set this Render environment variable to the deployed Vercel origin:

```env
FRONTEND_ORIGIN=https://lingua-sheet.vercel.app
```

The Docker image build requires network access to download the Argos packages,
but the running service does not download models and does not depend on a
persistent model disk.

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

Scanned/image-only PDFs are not supported because this app intentionally does not use OCR. Complex tables are exported as page-associated text rows rather than reconstructed cell-by-cell. AcroForm values are kept as named fields in a separate workbook sheet. Translation quality depends on the installed Argos model pair; review translations before using them as authoritative records.
