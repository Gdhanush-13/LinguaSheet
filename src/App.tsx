import { useRef, useState } from "react";
import { downloadBlob } from "./lib/download";
import {
  detectLanguage,
  ENGLISH,
  LANGUAGES,
  type LanguageCode,
} from "./lib/languages";
import { extractPdf, type PdfPage } from "./lib/pdf";
import { translatePages } from "./lib/translation";
import { createTranslatedPdf } from "./lib/translated-pdf";
import { createPdfImageWorkbook } from "./lib/workbook";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export default function App() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [translatedPages, setTranslatedPages] = useState<PdfPage[]>([]);
  const [translatedPdf, setTranslatedPdf] = useState<Uint8Array>();
  const [translationReady, setTranslationReady] = useState(false);
  const [source, setSource] = useState(ENGLISH);
  const [activePage, setActivePage] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const baseName = file?.name.replace(/\.pdf$/i, "") ?? "linguasheet";
  const original = pages.find(({ page }) => page === activePage);
  const translated = translatedPages.find(({ page }) => page === activePage);

  async function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setError("");
    if (
      nextFile.type !== "application/pdf" &&
      !nextFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please choose a PDF file.");
      return;
    }
    if (nextFile.size > MAX_PDF_BYTES) {
      setError("Please choose a PDF smaller than 25 MB.");
      return;
    }

    setBusy("Reading pages...");
    try {
      const extractedPages = await extractPdf(nextFile);
      const detectedSource = detectLanguage(
        extractedPages.map(({ text }) => text).join(" "),
      );
      setFile(nextFile);
      setPages(extractedPages);
      setTranslatedPages(extractedPages);
      setTranslatedPdf(undefined);
      setSource(detectedSource);
      setActivePage(1);
      setTranslationReady(detectedSource.code === ENGLISH.code);
    } catch {
      setError(
        "Unable to read this PDF. Password-protected and corrupt files are not supported.",
      );
    } finally {
      setBusy("");
    }
  }

  function changeSource(code: LanguageCode) {
    const nextSource = LANGUAGES.find((language) => language.code === code);
    if (!nextSource) return;
    setSource(nextSource);
    setTranslatedPages(pages);
    setTranslatedPdf(undefined);
    setTranslationReady(nextSource.code === ENGLISH.code);
    setError("");
  }

  async function translate() {
    setBusy("Translating...");
    setError("");
    setTranslationReady(false);
    setTranslatedPdf(undefined);
    try {
      const result = await translatePages(pages, source.code, ENGLISH.code);
      setTranslatedPages(result);
      setBusy("Creating English PDF...");
      setTranslatedPdf(await createTranslatedPdf(result));
      setTranslationReady(true);
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Translation failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function downloadWorkbook() {
    if (!file || !translationReady) return;
    setBusy("Converting English PDF to Excel...");
    setError("");
    try {
      const pdfBytes =
        translatedPdf ?? (await createTranslatedPdf(translatedPages));
      if (!translatedPdf) setTranslatedPdf(pdfBytes);
      const workbook = await createPdfImageWorkbook(pdfBytes);
      downloadBlob(workbook, `${baseName}-${ENGLISH.code}.xlsx`);
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "Unable to convert the English PDF to Excel.",
      );
    } finally {
      setBusy("");
    }
  }

  async function downloadTranslatedPdf() {
    if (!translationReady) return;
    setBusy("Preparing English PDF...");
    setError("");
    try {
      const pdfBytes =
        translatedPdf ?? (await createTranslatedPdf(translatedPages));
      if (!translatedPdf) setTranslatedPdf(pdfBytes);
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      downloadBlob(
        new Blob([pdfBuffer], { type: "application/pdf" }),
        `${baseName}-${ENGLISH.code}.pdf`,
      );
    } catch (pdfError) {
      setError(
        pdfError instanceof Error
          ? pdfError.message
          : "Unable to create the English PDF.",
      );
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setFile(undefined);
    setPages([]);
    setTranslatedPages([]);
    setTranslatedPdf(undefined);
    setTranslationReady(false);
    setSource(ENGLISH);
    setActivePage(1);
    setError("");
    setBusy("");
    if (input.current) input.current.value = "";
  }

  return (
    <main>
      <nav>
        <div className="brand">
          <span>{"\u6587"}</span>Lingua<strong>Sheet</strong>
        </div>
        <small>Open-source translation {"\u00b7"} no paid APIs</small>
      </nav>
      <header>
        <label>PDF TRANSLATION WORKSPACE</label>
        <h1>
          Translate documents.
          <br />
          <i>Structure the data.</i>
        </h1>
        <p>Translate PDFs to English, then convert the English pages to Excel.</p>
      </header>
      <section className="workspace">
        {!file ? (
          <div
            className="drop"
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                input.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <b>{"\u2191"}</b>
            <h2>{busy || "Drop a PDF to begin"}</h2>
            <p>
              or <u>browse files</u> {"\u00b7"} PDF only {"\u00b7"} up to 25 MB
            </p>
            <input
              ref={input}
              hidden
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </div>
        ) : (
          <>
            <div className="filebar">
              <em>PDF</em>
              <div>
                <strong>{file.name}</strong>
                <small>
                  {pages.reduce(
                    (count, page) => count + page.fields.length,
                    0,
                  )}{" "}
                  form fields found
                </small>
                <small>
                  {pages.length} pages {"\u00b7"}{" "}
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </small>
              </div>
              <button onClick={reset}>Start over</button>
            </div>
            <div className="controls">
              <label>
                Source language
                <select
                  value={source.code}
                  onChange={(event) =>
                    changeSource(event.target.value as LanguageCode)
                  }
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </label>
              <span>{"\u2192"}</span>
              <label>
                Translate to
                <select value={ENGLISH.code} disabled>
                  <option value={ENGLISH.code}>{ENGLISH.name}</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={Boolean(busy) || !pages.length}
                onClick={() => void translate()}
              >
                {busy || "Translate PDF"} {"\u2197"}
              </button>
            </div>
            <p className="note">
              Selectable text and form values are translated into an English PDF
              without OCR. Excel export renders that translated PDF page by page
              into one worksheet, matching the PDF-to-Excel workflow.
            </p>
            {error && <div className="error">{error}</div>}
            {pages.length > 0 && (
              <div className="preview">
                <aside>
                  <h3>
                    PAGES <small>{pages.length}</small>
                  </h3>
                  {pages.map((page) => (
                    <button
                      className={page.page === activePage ? "selected" : ""}
                      key={page.page}
                      onClick={() => setActivePage(page.page)}
                    >
                      <b>{String(page.page).padStart(2, "0")}</b>
                      <small>
                        {(page.text || "No text layer").slice(0, 38)}
                      </small>
                    </button>
                  ))}
                </aside>
                <article>
                  <div className="top">
                    <div>
                      <small>TRANSLATION PREVIEW</small>
                      <strong>
                        {source.name} <i>{"\u2192"}</i> {ENGLISH.name}
                      </strong>
                    </div>
                    <button
                      disabled={!translationReady || Boolean(busy)}
                      onClick={() => void downloadWorkbook()}
                    >
                      Export Excel {"\u2193"}
                    </button>
                  </div>
                  <div className="compare">
                    <div>
                      <h4>
                        ORIGINAL <small>{source.code.toUpperCase()}</small>
                      </h4>
                      <p>
                        {original?.text ||
                          "No selectable text was found on this page. OCR is not used."}
                      </p>
                    </div>
                    <div className="result">
                      <h4>
                        TRANSLATED <small>{ENGLISH.code.toUpperCase()}</small>
                        <span
                          className={`translation-status ${translationReady ? "ready" : ""}`}
                        >
                          {translationReady
                            ? "Ready"
                            : error
                              ? "Failed"
                              : "Not translated"}
                        </span>
                      </h4>
                      <p>
                        {translationReady
                          ? translated?.text || "No text content on this page."
                          : error ||
                            "Use Translate PDF above to create an English translation."}
                      </p>
                    </div>
                  </div>
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={!translationReady || Boolean(busy)}
                      onClick={() => void downloadWorkbook()}
                    >
                      Download Excel {"\u2193"}
                    </button>
                    <button
                      onClick={() => void downloadTranslatedPdf()}
                      disabled={!translationReady || Boolean(busy)}
                    >
                      Download English PDF
                    </button>
                  </div>
                </article>
              </div>
            )}
          </>
        )}
      </section>
      <footer>
        LinguaSheet{" "}
        <span>Translate PDFs. Structure data. Export anywhere.</span>
      </footer>
    </main>
  );
}
