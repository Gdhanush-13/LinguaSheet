FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ARGOS_DEVICE_TYPE=cpu \
    ARGOS_PACKAGES_DIR=/app/argos-packages \
    ARGOS_PAIRS=ja:en,tl:en \
    ARGOS_INTER_THREADS=1 \
    ARGOS_INTRA_THREADS=1 \
    ARGOS_BATCH_SIZE=8

WORKDIR /app

COPY backend_requirements.txt install_argos_models.py backend_main.py ./
RUN pip install --no-cache-dir -r backend_requirements.txt \
    && python install_argos_models.py \
    && python -c "import argostranslate.package; pairs={(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages() if p.type == 'translate'}; required={('ja','en'),('tl','en')}; missing=required-pairs; assert not missing, f'Missing Argos pairs: {missing}'; print(f'Verified Argos pairs: {sorted(required)}')"

EXPOSE 8080

CMD ["sh", "-c", "python -m uvicorn backend_main:app --host 0.0.0.0 --port ${PORT:-8080}"]
