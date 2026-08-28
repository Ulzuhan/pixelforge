FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3458 \
    PIXELFORGE_PYTHON=/opt/venv/bin/python3 PIXELFORGE_TMP_DIR=/work \
    U2NET_HOME=/models \
    NUMBA_CACHE_DIR=/work/numba-cache
# NUMBA_CACHE_DIR: numba (pymatting, que rembg importa al cargar) compila con
# cache=True y quiere escribir junto al código del venv — imposible con la raíz
# de solo lectura: todos los removebg daban 500, medido. Al tmpfs de /work; se
# recompila en cada arranque y eso es aceptable.
# upgrade además del install: la base arrastra arreglos de seguridad de Debian
# (medido por el Trivy semanal). npm/npx/yarn fuera: el runtime ejecuta node y
# python, nunca npm — su CLI trae node_modules propios que salen en los
# escáneres y jamás se usarían.
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 libgl1 libglib2.0-0 ca-certificates \
    && python3 -m venv /opt/venv \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY python/requirements.lock /tmp/requirements.lock
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.lock && rm /tmp/requirements.lock
WORKDIR /app
# uid fijo y alto a propósito: es la política de las cinco imágenes (10001), no
# choca con usuarios del sistema del host y los bind mounts saben a quién
# pertenecer. Sin él, --system asignaba el siguiente uid libre (999 aquí).
RUN groupadd --system --gid 10001 pixelforge && useradd --system --uid 10001 --gid pixelforge --home /nonexistent pixelforge \
    && mkdir /work /models && chown pixelforge:pixelforge /work /models
COPY --from=build --chown=pixelforge:pixelforge /app/.next/standalone ./
COPY --from=build --chown=pixelforge:pixelforge /app/.next/static ./.next/static
COPY --from=build --chown=pixelforge:pixelforge /app/public ./public
COPY --from=build --chown=pixelforge:pixelforge /app/python ./python
COPY --from=build --chown=pixelforge:pixelforge /app/scripts/container-entrypoint.mjs ./scripts/container-entrypoint.mjs
USER pixelforge
EXPOSE 3458
# start-period largo a conciencia: un primer arranque con el volumen de modelos
# vacío descarga ~400 MB verificados antes de escuchar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3458/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "scripts/container-entrypoint.mjs"]
