import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { extractPdf, workbook, type PdfPage } from "./lib/pdf";
import "./styles.css";
type Lang = { code: string; name: string };
const langs: Lang[] = [
  ["en", "English"],
  ["tl", "Filipino (Tagalog)"],
  ["ja", "Japanese"],
].map(([code, name]) => ({ code, name }));
const tagalogHints = /\b(ang|ng|mga|ito|iyon|ako|ikaw|kami|kayo|sila|ay|at|sa|para|mula|may|pag|hindi|kung|isang|pagsubok|kumusta)\b/gi;
function detect(text: string) {
  if (/[\u3040-\u30ff]/.test(text)) return langs.find((x) => x.code === "ja")!;
  const tagalogMatches = text.match(tagalogHints)?.length ?? 0;
  return tagalogMatches >= 2
    ? langs.find((x) => x.code === "tl") ?? langs[0]
    : langs.find((x) => x.code === "en") ?? langs[0];
}
function save(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 700);
}
async function translate(pages: PdfPage[], source: Lang, target: Lang) {
  if (source.code === target.code) return pages;
  if (!pages.some((page) => page.text.trim() || page.fields.some((field) => field.value.trim()))) {
    throw new Error(
      "No selectable PDF text or form values were found. This app does not use OCR.",
    );
  }
  const url = (
    import.meta.env.VITE_TRANSLATION_API_URL ||
    "https://linguasheet-translation.onrender.com"
  ).replace(/\/+$/, "");
  let r: Response;
  try {
    const health = await fetch(`${url}/health`);
    if (health.ok) {
      const status = await health.json();
      if (Array.isArray(status.installed_languages) && !status.installed_languages.includes(source.code)) {
        const missing = source.code === "ja" ? "Japanese" : "Filipino (Tagalog)";
        throw new Error(
          `The translation server is online, but its ${missing} model is not installed. Redeploy the Render service from the latest main branch so it installs the ja→en and tl→en models.`,
        );
      }
    }
    r = await fetch(`${url}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages, source: source.code, target: target.code }),
    });
  } catch {
    throw new Error(
      "Could not reach the translation service. It may be waking up; please try again in a few seconds.",
    );
  }
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({}))).detail ||
        "The self-hosted translation service is unavailable.",
    );
  return (await r.json()).pages as PdfPage[];
}
function App() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [translated, setTranslated] = useState<PdfPage[]>([]);
  const [translationReady, setTranslationReady] = useState(false);
  const [source, setSource] = useState(langs[0]);
  const target = langs[0];
  const [active, setActive] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const base = file?.name.replace(/\.pdf$/i, "") ?? "linguasheet";
  const original = pages.find((p) => p.page === active),
    current = translated.find((p) => p.page === active);
  async function choose(f?: File) {
    if (!f) return;
    setError("");
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"))
      return setError("Please choose a PDF file.");
    if (f.size > 25 * 1024 * 1024)
      return setError("Please choose a PDF smaller than 25 MB.");
    setBusy("Reading pages…");
    try {
      const p = await extractPdf(f);
      setFile(f);
      setPages(p);
      setTranslated(p);
      const detectedSource = detect(p.map((x) => x.text).join(" "));
      setSource(detectedSource);
      setTranslationReady(detectedSource.code === target.code);
    } catch {
      setError(
        "Unable to read this PDF. Password-protected and corrupt files are not supported.",
      );
    } finally {
      setBusy("");
    }
  }
  async function doTranslate() {
    setBusy("Translating locally…");
    setError("");
    try {
      const result = await translate(pages, source, target);
      setTranslated(result);
      setTranslationReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed.");
    } finally {
      setBusy("");
    }
  }
  async function excel() {
    if (!file) return;
    save(
      await workbook(
        pages.map((p, i) => ({
          page: p.page,
          original: p.text,
          translated: translationReady ? translated[i]?.text ?? p.text : "",
          fields: p.fields,
          translatedFields: translationReady
            ? translated[i]?.fields ?? p.fields
            : p.fields.map((field) => ({ ...field, value: "" })),
        })),
        source.name,
        target.name,
      ),
      `${base}-${target.code}.xlsx`,
    );
  }
  function reset() {
    setFile(undefined);
    setPages([]);
    setTranslated([]);
    setTranslationReady(false);
    setError("");
    setBusy("");
    if (input.current) input.current.value = "";
  }
  return (
    <main>
      <nav>
        <div className="brand">
          <span>文</span>Lingua<strong>Sheet</strong>
        </div>
        <small>Open-source translation · no paid APIs</small>
      </nav>
      <header>
        <label>PDF TRANSLATION WORKSPACE</label>
        <h1>
          Translate documents.
          <br />
          <i>Structure the data.</i>
        </h1>
        <p>
          Convert multilingual PDFs into reviewable, readable Excel workbooks.
        </p>
      </header>
      <section className="workspace">
        {!file ? (
          <div
            className="drop"
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && input.current?.click()
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void choose(e.dataTransfer.files[0]);
            }}
          >
            <b>↑</b>
            <h2>Drop a PDF to begin</h2>
            <p>
              or <u>browse files</u> · PDF only · up to 25 MB
            </p>
            <input
              ref={input}
              hidden
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </div>
        ) : (
          <>
            <div className="filebar">
              <em>PDF</em>
              <div>
                <strong>{file.name}</strong>
                <small>{pages.reduce((count, page) => count + page.fields.length, 0)} form fields found</small>
                <small>
                  {pages.length} pages · {(file.size / 1024 / 1024).toFixed(2)}{" "}
                  MB
                </small>
              </div>
              <button onClick={reset}>Start over</button>
            </div>
            <div className="controls">
              <label>
                Source language
                <select
                  value={source.code}
                  onChange={(e) =>
                    (() => {
                      const next = langs.find((x) => x.code === e.target.value) ?? source;
                      setSource(next);
                      setTranslationReady(next.code === target.code);
                    })()
                  }
                >
                  {langs.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <span>→</span>
              <label>
                Translate to
                <select value={target.code} disabled>
                  <option value="en">English</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={!!busy || !pages.length}
                onClick={() => void doTranslate()}
              >
                {busy || "Translate PDF"} ↗
              </button>
            </div>
            <p className="note">
              Local/self-hosted translation keeps the API key out of the
              browser. The Translate button processes every page; the page list
              only changes the preview. Selectable text and form values are
              extracted directly without OCR. URLs, IDs, emails, phone numbers, and
              numeric values are preserved.
            </p>
            {error && <div className="error">{error}</div>}
            {pages.length > 0 && (
              <div className="preview">
                <aside>
                  <h3>
                    PAGES <small>{pages.length}</small>
                  </h3>
                  {pages.map((p) => (
                    <button
                      className={p.page === active ? "selected" : ""}
                      key={p.page}
                      onClick={() => setActive(p.page)}
                    >
                      <b>{String(p.page).padStart(2, "0")}</b>
                      <small>{(p.text || "No text layer").slice(0, 38)}</small>
                    </button>
                  ))}
                </aside>
                <article>
                  <div className="top">
                    <div>
                      <small>TRANSLATION PREVIEW</small>
                      <strong>
                        {source.name} <i>→</i> {target.name}
                      </strong>
                    </div>
                    <button onClick={() => void excel()}>Export Excel ↓</button>
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
                        TRANSLATED <small>{target.code.toUpperCase()}</small>
                        <span className={`translation-status ${translationReady ? "ready" : ""}`}>
                          {translationReady ? "Ready" : error ? "Failed" : "Not translated"}
                        </span>
                      </h4>
                      <p>
                        {translationReady
                          ? current?.text || "No text content on this page."
                          : error || "Use Translate PDF above to create an English translation."}
                      </p>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="primary" onClick={() => void excel()}>
                      Download Excel ↓
                    </button>
                    <button
                      onClick={() =>
                        save(
                          new Blob(
                            [
                              translated
                                .map((p) => `Page ${p.page}\n${p.text}`)
                                .join("\n\n"),
                            ],
                            { type: "text/plain" },
                          ),
                          `${base}-${target.code}.txt`,
                        )
                      }
                      disabled={!translationReady}
                    >
                      Download translated text
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
createRoot(document.getElementById("root")!).render(<App />);
