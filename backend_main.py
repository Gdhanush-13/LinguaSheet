import re
import os

import argostranslate.translate
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="LinguaSheet self-hosted translation")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        os.getenv("FRONTEND_ORIGIN", "https://lingua-sheet.vercel.app"),
    ],
    allow_origin_regex=r"https://lingua-sheet(?:-[a-z0-9-]+)?\.vercel\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class Page(BaseModel):
    page: int
    text: str


class TranslationRequest(BaseModel):
    pages: list[Page]
    source: str
    target: str


TOKEN = re.compile(
    r"https?://\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|"
    r"\+?\d[\d\s().-]{5,}\d|\b[A-Z0-9][A-Z0-9/_-]{3,}\b"
)


def protect(text: str):
    tokens: list[str] = []

    def replacement(match: re.Match[str]) -> str:
        tokens.append(match.group(0))
        return f" __LS_TOKEN_{len(tokens) - 1}__ "

    return TOKEN.sub(replacement, text), tokens


def restore(text: str, tokens: list[str]) -> str:
    return re.sub(
        r"__LS_TOKEN_(\d+)__",
        lambda match: tokens[int(match.group(1))],
        text,
    )


@app.get("/health")
def health():
    languages = [language.code for language in argostranslate.translate.get_installed_languages()]
    return {
        "status": "ok",
        "engine": "Argos Translate",
        "provider": "self-hosted",
        "installed_languages": languages,
    }


@app.post("/translate")
def translate(request: TranslationRequest):
    if request.source == request.target:
        return {"pages": request.pages}

    try:
        output = []
        for page in request.pages:
            safe_text, tokens = protect(page.text)
            translated = argostranslate.translate.translate(
                safe_text,
                request.source,
                request.target,
            )
            output.append({"page": page.page, "text": restore(translated, tokens)})
        return {"pages": output}
    except Exception as exc:
        raise HTTPException(
            503,
            "No Argos package is installed for this language pair.",
        ) from exc
