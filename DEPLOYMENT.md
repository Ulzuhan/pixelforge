# Despliegue y operación

PixelForge procesa entradas no confiables con librerías nativas y redes neuronales. Debe publicarse como **una sola instancia** detrás de un proxy HTTPS. La cola y el rate limit viven en memoria: varias réplicas no comparten sus contadores y multiplican el máximo real de procesos.

## Docker Compose

1. Copia `.env.example` a `.env`. Genera `PIXELFORGE_SESSION_SECRET` con `openssl rand -hex 32` y configura OIDC. Añade `PIXELFORGE_ENROLL_URL` con el flujo de alta de tu proveedor: es el botón «Request an account» de la portada y sin ella no aparece — que es lo correcto si tu proveedor no tiene alta autoservicio.
2. Construye y arranca con `docker compose up -d --build`.
3. **Los modelos se descargan al primer arranque, verificados**: el entrypoint baja los cuatro ONNX permitidos a `/models` (~400 MB) y comprueba su sha256 contra los valores fijados en `scripts/container-entrypoint.mjs` — si el origen sirviera otros bytes, el servicio se niega a arrancar. El healthcheck da 5 minutos de margen a ese primer arranque; los siguientes son inmediatos porque `/models` es persistente. Sin salida a internet, siembra el volumen copiando los `.onnx` a mano: si ya existen, no se descarga nada.
4. Publica sólo el proxy TLS. Compose enlaza PixelForge a `127.0.0.1:3458`.

El contenedor corre sin root, sin capacidades, con raíz de solo lectura y subidas en un tmpfs privado. El límite de 6 GiB presupone dos trabajos simultáneos; mídelo con tus imágenes y reduce `PIXELFORGE_MAX_JOBS` antes de reducir memoria.

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
