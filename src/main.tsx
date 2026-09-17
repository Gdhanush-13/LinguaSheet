import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { extractPdf, workbook, type PdfPage } from "./lib/pdf";
import "./styles.css";
type Lang = { code: string; name: string };
const langs: Lang[] = [
  ["en", "English"],
  ["tl", "Filipino"],
  ["ja", "Japanese"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["hi", "Hindi"],
  ["te", "Telugu"],
  ["ta", "Tamil"],
  ["ar", "Arabic"],
  ["zh", "Chinese"],
  ["ko", "Korean"],
  ["ru", "Russian"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["tr", "Turkish"],
  ["vi", "Vietnamese"],
  ["th", "Thai"],
].map(([code, name]) => ({ code, name }));
const script: Record<string, RegExp> = {
  ja: /[\u3040-\u30ff]/,
  hi: /[\u0900-\u097f]/,
  te: /[\u0c00-\u0c7f]/,
  ta: /[\u0b80-\u0bff]/,
  ar: /[\u0600-\u06ff]/,
  zh: /[\u4e00-\u9fff]/,
  ko: /[\uac00-\ud7af]/,
  th: /[\u0e00-\u0e7f]/,
  ru: /[\u0400-\u04ff]/,
};
function detect(text: string) {
  const hit = Object.entries(script).find(([, re]) => re.test(text));
  return langs.find((x) => x.code === hit?.[0]) ?? langs[0];
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
  if (!pages.some((page) => page.text.trim())) {
    throw new Error(
      "This PDF has no text layer. Scanned PDFs need OCR before translation.",
    );
  }
  const url = (
    import.meta.env.VITE_TRANSLATION_API_URL || "http://localhost:8000"
  ).replace(/\/+$/, "");
  let r: Response;
  try {
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
  const [source, setSource] = useState(langs[0]);
  const [target, setTarget] = useState(langs[1]);
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
      setSource(detect(p.map((x) => x.text).join(" ")));
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
      setTranslated(await translate(pages, source, target));
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
          translated: translated[i]?.text ?? p.text,
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
                    setSource(
                      langs.find((x) => x.code === e.target.value) ?? source,
                    )
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
                <select
                  value={target.code}
                  onChange={(e) =>
                    setTarget(
                      langs.find((x) => x.code === e.target.value) ?? target,
                    )
                  }
                >
                  {langs.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.name}
                    </option>
                  ))}
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
              only changes the preview. URLs, IDs, emails, phone numbers, and
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
                          "No text layer found. Scanned PDFs need OCR support in the backend."}
                      </p>
                    </div>
                    <div className="result">
                      <h4>
                        TRANSLATED <small>{target.code.toUpperCase()}</small>
                      </h4>
                      <p>
                        {current?.text || "Translate to preview the result."}
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
