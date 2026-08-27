FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3458 \
    PIXELFORGE_PYTHON=/opt/venv/bin/python3 PIXELFORGE_TMP_DIR=/work \
    U2NET_HOME=/models
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 libgl1 libglib2.0-0 ca-certificates \
    && python3 -m venv /opt/venv \
    && rm -rf /var/lib/apt/lists/*
COPY python/requirements.lock /tmp/requirements.lock
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.lock && rm /tmp/requirements.lock
WORKDIR /app
RUN groupadd --system pixelforge && useradd --system --gid pixelforge --home /nonexistent pixelforge \
    && mkdir /work /models && chown pixelforge:pixelforge /work /models
COPY --from=build --chown=pixelforge:pixelforge /app/.next/standalone ./
COPY --from=build --chown=pixelforge:pixelforge /app/.next/static ./.next/static
COPY --from=build --chown=pixelforge:pixelforge /app/public ./public
COPY --from=build --chown=pixelforge:pixelforge /app/python ./python
USER pixelforge
EXPOSE 3458
CMD ["node", "server.js"]
