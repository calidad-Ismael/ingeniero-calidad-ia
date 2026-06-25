# Backend de conversión/edición — necesita LibreOffice para convertir Word a PDF exacto
FROM python:3.11-slim

# Instalar LibreOffice (headless) y fuentes para fidelidad de conversión
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-core \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY servidor.py .

# Railway inyecta el puerto en $PORT; servidor.py lo lee de os.environ
ENV PORT=8000
EXPOSE 8000

# Arranque simple: Python lee PORT del entorno (sin expansión de variables en la CMD)
CMD ["python", "servidor.py"]
