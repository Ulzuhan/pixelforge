# Despliegue y operación

PixelForge procesa entradas no confiables con librerías nativas y redes neuronales. Debe publicarse como **una sola instancia** detrás de un proxy HTTPS. La cola y el rate limit viven en memoria: varias réplicas no comparten sus contadores y multiplican el máximo real de procesos.

## Docker Compose

1. Copia `.env.example` a `.env`. Genera `PIXELFORGE_SESSION_SECRET` con `openssl rand -hex 32` y configura OIDC. Añade `PIXELFORGE_ENROLL_URL` con el flujo de alta de tu proveedor: es el botón «Request an account» de la portada y sin ella no aparece — que es lo correcto si tu proveedor no tiene alta autoservicio.
2. Construye y arranca con `docker compose up -d --build`.
3. **Los modelos se descargan al primer arranque, verificados**: el entrypoint baja los cuatro ONNX permitidos a `/models` (~400 MB) y comprueba su sha256 contra los valores fijados en `scripts/container-entrypoint.mjs` — si el origen sirviera otros bytes, el servicio se niega a arrancar. El healthcheck da 5 minutos de margen a ese primer arranque; los siguientes son inmediatos porque `/models` es persistente. Sin salida a internet, siembra el volumen copiando los `.onnx` a mano: si ya existen, no se descarga nada.
4. Publica sólo el proxy TLS. Compose enlaza PixelForge a `127.0.0.1:3458`.

El contenedor corre sin root, sin capacidades, con raíz de solo lectura y subidas en un tmpfs privado. Si montas `/work` como `tmpfs` (por ejemplo `mode=1777` en Podman rootless), fija `PIXELFORGE_TMP_DIR=/work/jobs` y un volumen escribible para revocaciones con `PIXELFORGE_STATE_DIR=/state`. Con la cola FIFO única por defecto (`PIXELFORGE_MAX_JOBS=1`, `PIXELFORGE_MAX_QUEUE=12`), los trabajos de `/api/removebg` y `/api/vectorize` corren de uno en uno y solo arrancan si quedan al menos `PIXELFORGE_MIN_MEM_AVAILABLE_MB` (`1024` MiB en host) y `PIXELFORGE_MIN_CGROUP_FREE_MB` (`768` MiB en cgroup), reintentando cada `PIXELFORGE_MEM_POLL_MS` (`1500` ms) hasta `PIXELFORGE_MAX_WAIT_MS` (`90000` ms); con 2,5 GiB de techo de contenedor y `PIXELFORGE_MAX_PIXELS=25000000` cabe holgadamente hasta 24 MP de 1 en 1. El endpoint de salud `GET /api/health` responde `200 {"ok":true}` sin pasar por OIDC.

## Proxy inverso obligatorio

El proxy debe reemplazar —no anexar desde el cliente— `X-Forwarded-For`, `X-Forwarded-Host` y `X-Forwarded-Proto`. Limita el cuerpo a 51 MiB, aplica timeout de petición superior a 180 s y no almacenes cuerpos ni URLs completas en logs. Ejemplo nginx:

```nginx
location / {
  client_max_body_size 51m;
  proxy_read_timeout 200s;
  proxy_send_timeout 200s;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto https;
  proxy_pass http://127.0.0.1:3458;
}
```

La aplicación también corta multipart en streaming a 50 MiB; el límite del proxy protege recursos antes de que Node reciba la petición.

## Drenaje privado antes de parar el contenedor

No hay endpoint HTTP de control. La imagen usa un socket Unix `0600` dentro
de un directorio `0700` nuevo en el tmpfs privado `/tmp`. No expongas ni
compartas ese directorio. En un standalone manual es optativo:
`PIXELFORGE_DRAIN_DIR` debe apuntar a un directorio absoluto aún inexistente,
en un padre privado o con sticky bit.

El operador coordina **en exclusiva** la ventana y actúa sobre el ID completo
del contenedor exacto, no sobre un nombre reutilizable. Genera un token de 32
hexadecimales con `openssl rand -hex 16`. Desde el host, sustituye `"$cid"` por
esa identidad verificada:

```sh
podman exec "$cid" node scripts/drain-control.mjs begin "$token"
podman exec "$cid" node scripts/drain-control.mjs status "$token"
```

`begin` cierra la admisión en ambas rutas antes de leer el multipart; rechaza
nuevos trabajos con 503/Retry-After sin publicar contadores. Los admitidos,
incluidos los que aún reciben la imagen, conservan su turno; su contador no
baja hasta que se prepara la respuesta y acaba la limpieza. El control no
elimina ni altera trabajos. Conserva `instancia` de la **primera** respuesta:
`status` debe devolver esa misma instancia, `cerrado=true`, `listo=true` y cero
en `admitidas`, `activos` y `esperando`. Verifica otra vez ID, estado y sesión
justo antes de parar. Coordina el cierre de conexiones con el proxy: el dato
privado no confirma que una respuesta preparada ya se haya enviado al cliente.

Usa un plazo finito. Ante error, timeout, proceso cambiado o socket ausente
**no pares**; comprueba el origen y abandona el corte. Para cancelar en la
misma instancia y bajo la misma exclusión, vuelve a abrir con
`podman exec "$cid" node scripts/drain-control.mjs resume "$token"`. No emitas
`begin` otra vez para ocultar un reinicio ni compartas el token en logs. El
token equivocado no permite tomar o reabrir una operación existente. No
automatices la primera transición desde una versión sin este mecanismo:
requiere ventana supervisada con corte de admisión externo y política
explícita para trabajos que no se pueden medir.

La prueba `npm run test:drain` usa el servidor construido, dos peticiones
autenticadas ficticias, un procesador sin modelos y un socket local. Comprueba
drenaje/retorno a servicio, no inferencia ni un corte ARM64 de producción.

## systemd

Instala el standalone en `/opt/pixelforge`, el venv en `/opt/pixelforge-venv`, crea el usuario `pixelforge` y los directorios `/var/lib/pixelforge/{tmp,models}` con modo `0700`. Copia `deploy/pixelforge.service`, coloca secretos con permisos `0600` en `/etc/pixelforge.env`, ejecuta `systemctl daemon-reload` y habilita la unidad.

## Privacidad, modelos y backups

Las imágenes viven sólo durante la petición, en carpetas `0700` y ficheros `0600`; un `finally` las elimina y el arranque y un barrido cada 30 minutos eliminan huérfanos de más de 30 minutos. No respaldes el directorio temporal ni vuelques cuerpos HTTP. El volumen de modelos sí puede respaldarse: contiene pesos públicos, no imágenes de usuarios.

El SVG se entrega como attachment con `Content-Security-Policy: default-src 'none'; sandbox`; la interfaz lo previsualiza desde una URL `blob:`. No cambies a inline en el origen de la aplicación.

## Identidad y respuesta a incidentes

Las sesiones firmadas duran 12 horas por defecto, máximo 24, y no tienen revocación local. Deshabilitar una cuenta en OIDC no elimina una cookie ya emitida; rota `PIXELFORGE_SESSION_SECRET` para invalidar todas. Los endpoints OIDC requieren HTTPS salvo loopback y tienen timeout de 10 s.

Supervisa respuestas 401/403/413/429/503/500, longitud de cola, memoria, espacio de tmpfs, reinicios y descargas inesperadas de modelos. Una oleada de 429 indica abuso de una identidad o IP; 503 sostenidos indican saturación legítima o límites demasiado altos para el hardware.

## Puerta de despliegue

Ejecuta `npm ci`, instala el lock auditado `python/requirements.lock`, y después `npm run lint`, `npm run build`, `npx tsc --noEmit`, `npm test`, `npm audit --omit=dev`, `pip-audit -r python/requirements.lock`. No despliegues con una comprobación roja.

## Lo que se le exige al proxy de delante

Dos cosas, y las dos están comprobadas en vivo contra el túnel de Cloudflare:

- **`X-Forwarded-For` debe llegar con la dirección real al final.** El límite de
  peticiones toma el último valor, no el primero, y eso es deliberado: el primero lo
  escribe quien llama. Verificado — mandando `X-Forwarded-For: 1.2.3.4` desde fuera,
  a la aplicación le llega `1.2.3.4,<la de verdad>`. **Expuesto sin proxy sí se
  esquiva**, de ahí que la aplicación deba escuchar sólo en loopback.
- **`Host` debe traer el nombre público.** La comprobación de origen lo usa a él y
  no a `X-Forwarded-Host`, porque esa segunda **el túnel no la reemplaza** —también
  verificado— y quien llama puede escribirla. Si el proxy reescribe `Host` con un
  nombre interno, hay que poner `PIXELFORGE_PUBLIC_HOST`.
