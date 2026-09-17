FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ARGOS_DEVICE_TYPE=cpu \
    ARGOS_PACKAGES_DIR=/app/argos-packages

WORKDIR /app

COPY backend_requirements.txt install_argos_models.py backend_main.py ./
RUN pip install --no-cache-dir -r backend_requirements.txt \
    && python install_argos_models.py

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "backend_main:app", "--host", "0.0.0.0", "--port", "7860"]
