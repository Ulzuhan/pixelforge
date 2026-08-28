#!/usr/bin/env bash
#
# Las suites, cada una contra un servidor levantado aquí mismo.
#
# El servidor se arranca con un secreto de sesión propio, y no con el de
# producción: las suites acuñan sus cookies con ese mismo secreto porque esta
# aplicación no tiene login local —la identidad la lleva Authentik entera—, y sin
# eso no habría forma de ejercitar una sola ruta.
#
#   ./scripts/run-suites.sh          # todas
#   ./scripts/run-suites.sh auth     # una
#
# Necesita un build antes (`npm run build`). Sale con código distinto de cero si
# algo falla, que es lo que lee CI.
set -uo pipefail
set -m

cd "$(dirname "$0")/.."

PUERTO="${PORT:-3991}"
export BASE="http://127.0.0.1:$PUERTO"
export PIXELFORGE_SESSION_SECRET="${PIXELFORGE_SESSION_SECRET:-secreto-de-pruebas-pixelforge-32-bytes-minimo}"
LOG="$(mktemp)"
RAIZ_PRUEBAS="$(mktemp -d)"
TEMPORALES="$RAIZ_PRUEBAS/uploads"

TODAS=(auth process)
SUITES=("${@:-${TODAS[@]}}")
[ $# -gt 0 ] && SUITES=("$@")

servidor=""

parar() {
  [ -n "$servidor" ] || return 0
  # El grupo entero, no el proceso: `next start` levanta un trabajador aparte, y
  # matar sólo al padre deja el puerto ocupado. La siguiente suite encontraría un
  # servidor en pie, decidiría que ya ha arrancado, y mediría el de antes.
  kill -- -"$servidor" 2>/dev/null || kill "$servidor" 2>/dev/null
  wait "$servidor" 2>/dev/null
  servidor=""
  for _ in $(seq 1 40); do
    ss -tln 2>/dev/null | grep -qE ":$PUERTO " || return 0
    sleep 0.25
  done
  echo "aviso: el puerto $PUERTO sigue ocupado"
}
trap 'parar; exit 130' INT TERM

arrancar() {
  ss -tln 2>/dev/null | grep -qE ":$PUERTO " && { echo "el puerto $PUERTO ya está ocupado"; return 1; }

  # Los valores de OIDC son de mentira a propósito: ninguna suite completa un
  # inicio de sesión contra el proveedor, sólo comprueban que el desvío se
  # construye y que no saca de casa.
  # Límites apretados a propósito. Con los de por defecto (2 a la vez, 6 en
  # espera) haría falta lanzar nueve peticiones pesadas para ver un rechazo, y el
  # test tardaría minutos. Con 2 y 1, cuatro peticiones bastan y el resultado es
  # el mismo mecanismo.
  rm -rf "$TEMPORALES"
  PIXELFORGE_TMP_DIR="$TEMPORALES" \
  PIXELFORGE_MAX_JOBS="${PIXELFORGE_MAX_JOBS:-2}" \
    PIXELFORGE_MAX_QUEUE="${PIXELFORGE_MAX_QUEUE:-1}" \
    PIXELFORGE_MAX_REQUESTS_PER_HOUR=1000 \
    PIXELFORGE_SESSION_SECRET="$PIXELFORGE_SESSION_SECRET" \
    PIXELFORGE_OIDC_CLIENT_ID=pruebas \
    PIXELFORGE_OIDC_CLIENT_SECRET=pruebas \
    PIXELFORGE_OIDC_REDIRECT_URI="$BASE/api/auth/callback" \
    PIXELFORGE_OIDC_PUBLIC_BASE="http://127.0.0.1:9999" \
    PIXELFORGE_OIDC_INTERNAL_BASE="http://127.0.0.1:9999" \
    PIXELFORGE_OIDC_APP_SLUG=pixelforge \
    PIXELFORGE_ENROLL_URL="https://idp.example.invalid/if/flow/enroll-pixelforge/" \
    PORT="$PUERTO" \
    HOSTNAME=127.0.0.1 \
    node .next/standalone/server.js >"$LOG" 2>&1 &
  servidor=$!

  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "$BASE/" && break
    sleep 0.5
  done

  # La precondición, afirmada: quien escucha tiene que ser este proceso y no un
  # servidor de una tirada anterior que se quedó vivo. Sin esto se mide un build
  # viejo y nada lo dice.
  local escucha
  escucha=$(ss -tlnp 2>/dev/null | grep ":$PUERTO " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
  if [ -z "$escucha" ]; then
    echo "el servidor no arrancó:"
    tail -20 "$LOG"
    return 1
  fi
  local suyo
  suyo=$(tr '\0' '\n' < "/proc/$escucha/environ" 2>/dev/null | grep '^PIXELFORGE_SESSION_SECRET=' | cut -d= -f2-)
  if [ "$suyo" != "$PIXELFORGE_SESSION_SECRET" ]; then
    echo "en $PUERTO escucha otro servidor, no el de esta tirada"
    return 1
  fi
  if [ "$(stat -c %Y "/proc/$escucha")" -lt "$(stat -c %Y .next/BUILD_ID)" ]; then
    echo "el build es más nuevo que el servidor: falta un 'npm run build'"
    return 1
  fi
  return 0
}

fallo=0
for suite in "${SUITES[@]}"; do
  arrancar || { fallo=1; continue; }
  printf "%-10s " "$suite"
  salida=$(node "scripts/test-$suite.mjs" 2>&1)
  estado=$?
  echo "$salida" | tail -1
  [ $estado -ne 0 ] && { echo "$salida" | grep -E "✗" | head -10; fallo=1; }
  if [ "$suite" = process ]; then
    [ "$(stat -c %a "$TEMPORALES" 2>/dev/null)" = 700 ] || { echo "  ✗ temporales sin modo 0700"; fallo=1; }
    [ -z "$(find "$TEMPORALES" -mindepth 1 -print -quit 2>/dev/null)" ] || { echo "  ✗ quedaron imágenes temporales"; fallo=1; }
  fi
  parar
done

rm -f "$LOG"
rm -rf "$RAIZ_PRUEBAS"
if [ $fallo -ne 0 ]; then
  echo
  echo "HAY FALLOS"
  exit 1
fi
echo
echo "todo verde"
