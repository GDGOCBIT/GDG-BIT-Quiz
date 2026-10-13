FROM python:3.13-slim

WORKDIR /srv

# Install build deps for asyncpg (C extension)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY schema.sql ./schema.sql
COPY app ./app

# DATABASE_URL must be set at runtime (e.g. via -e or docker-compose env_file)
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
