/**
 * La puerta.
 *
 * Aquí no se guarda nada de nadie —entra una imagen, sale otra, no queda ficha a
 * nombre de nadie—, así que lo que se protege no es la intimidad: es el coste.
 * Quitar un fondo ejecuta una red neuronal que ocupa más de un giga durante
 * segundos. Abierto a internet, esto es cómputo gratis para quien lo encuentre, y
 * la máquina que se queda sin memoria sostiene otros cuatro servicios.
 *
 * Por eso la sesión se prueba por sus dos caras. Comprobar sólo que un extraño
 * recibe 401 no vale nada si resulta que la aplicación está devolviendo 401 a
 * todo el mundo: eso no es una puerta cerrada, es una puerta rota.
 */
import { BASE, check, firmar, nota, png, procesar, resumen, sesion } from "./comun.mjs";

const PNG = png(40, 30);

console.log("La puerta, por sus dos caras");
const buena = sesion();
const legitima = await procesar("/api/removebg", { cookie: buena, datos: PNG });
check("una sesión legítima entra", legitima.status, 200);
if (legitima.status !== 200) nota("motivo", JSON.stringify(legitima.body));
check("y lo que devuelve es una imagen", legitima.tipo, "image/png");

check("sin cookie no se pasa", (await procesar("/api/removebg", { datos: PNG })).status, 401);
check("ni a vectorizar", (await procesar("/api/vectorize", { datos: PNG })).status, 401);

console.log("\nSesiones que no valen");
const [carga, firma] = buena.split("=")[1].split(".");
const con = (v) => `pixelforge_session=${v}`;
const ahora = Date.now();

const rechazables = [
  ["la firma cambiada", con(`${carga}.${firma.slice(0, -4)}AAAA`)],
  ["la firma vacía", con(`${carga}.`)],
  ["sin firma ni punto", con(carga)],
  [
    "la carga cambiada dejando la firma buena",
    con(`${Buffer.from(JSON.stringify({ sub: "otro", email: "otro@x.invalid", exp: ahora + 3600_000 })).toString("base64url")}.${firma}`),
  ],
  ["firmada con otro secreto", firmar({ sub: "x", email: "x@x.invalid", exp: ahora + 3600_000 }, "otro-secreto")],
  ["caducada", firmar({ sub: "x", email: "x@x.invalid", exp: ahora - 1000 })],
  ["sin fecha de caducidad", firmar({ sub: "x", email: "x@x.invalid" })],
  ["con la caducidad puesta como texto", firmar({ sub: "x", email: "x@x.invalid", exp: "9999999999999" })],
  ["sin sujeto", firmar({ email: "x@x.invalid", exp: ahora + 3600_000 })],
  ["sin correo", firmar({ sub: "x", exp: ahora + 3600_000 })],
  ["que no es ni base64", con("nada.de-nada")],
  ["vacía del todo", con("")],
];
for (const [que, cookie] of rechazables) {
  check(`no entra con ${que}`, (await procesar("/api/removebg", { cookie, datos: PNG })).status, 401);
}

console.log("\nEl desvío al entrar");
// Sin esto, un enlace con ?next=https://otro-sitio convertiría el inicio de
// sesión en un redirector a donde quisiera quien mandara el enlace.
for (const destino of [
  "https://malo.example",
  "//malo.example",
  "/\\malo.example",
  "javascript:alert(1)",
  "https:/malo.example",
  "  //malo.example",
]) {
  const res = await fetch(`${BASE}/api/auth/login?next=${encodeURIComponent(destino)}`, {
    redirect: "manual",
  });
  const location = res.headers.get("location") ?? "";
  const sale = Boolean(location) && !location.startsWith("/") && !/^https?:\/\/127\.0\.0\.1:9999/.test(location);
  check(`next=${destino.trim().slice(0, 20)} no saca de casa`, sale, false);
}

// Y uno interno sí tiene que sobrevivir: un saneado que se lo come todo rompe
// volver a donde estabas, que es para lo que existe el parámetro.
const interno = await fetch(`${BASE}/api/auth/login?next=%2Ftrabajo`, { redirect: "manual" });
check("el desvío interno sigue siendo interno", (interno.headers.get("location") ?? "").startsWith("http://127.0.0.1:9999"), true);

console.log("\nSalir");
const csrfSalida = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: buena, origin: "https://hermano.example", "sec-fetch-site": "same-site" }, redirect: "manual" });
check("un origen hermano no puede cerrar la sesión", csrfSalida.status, 403);
check("y no borra la cookie", csrfSalida.headers.get("set-cookie"), null);

/**
 * Y la cabecera que decide de dónde viene la petición no la puede escribir quien
 * llama.
 *
 * `X-Forwarded-Host` **no la reemplaza este despliegue**: comprobado en vivo contra
 * el túnel, llega intacta mientras `Host` sigue valiendo el nombre de verdad.
 * Prefiriéndola, la comprobación de origen se saltaba sola.
 *
 * El `Origin` va con el mismo esquema que ve el servidor de pruebas, a propósito:
 * con otro, rechazaría por el esquema y este test pasaría aunque el fallo siguiera
 * ahí. Y sin `Sec-Fetch-Site`, que es como llega un navegador que no manda Fetch
 * Metadata: deja sola a la comprobación de origen, que es la que se quiere probar.
 */
const falseada = await fetch(`${BASE}/api/auth/logout`, {
  method: "POST",
  headers: { cookie: buena, origin: "http://malo.example", "x-forwarded-host": "malo.example" },
  redirect: "manual",
});
check("una cabecera X-Forwarded-Host inventada no cierra la sesión", falseada.status, 403);
check("y tampoco borra la cookie", falseada.headers.get("set-cookie"), null);

// Y en la ruta que gasta CPU, que es la que de verdad importa aquí.
const conFalseada = await procesar("/api/removebg", {
  cookie: buena,
  datos: PNG,
  headers: { origin: "http://malo.example", "x-forwarded-host": "malo.example" },
});
check("ni cuela un trabajo de proceso", conFalseada.status, 403);

const salida = await fetch(`${BASE}/api/auth/logout`, {
  method: "POST",
  headers: { cookie: buena },
  redirect: "manual",
});
const borrada = (salida.headers.get("set-cookie") ?? "").match(/pixelforge_session=;|pixelforge_session=deleted|Max-Age=0|Expires=Thu, 01 Jan 1970/);
check("al salir se borra la cookie", Boolean(borrada), true);

/**
 * La portada, y de dónde sale el enlace de alta.
 *
 * Estaba escrito a fuego en el componente, apuntando al Authentik de quien escribió
 * esto — en un repositorio con licencia MIT, así que cualquiera que lo desplegara le
 * ponía a sus visitantes un botón de alta hacia el proveedor de un desconocido. Ahora
 * llega por `PIXELFORGE_ENROLL_URL`, y esto es lo que impide que vuelva a colarse una constante.
 */
console.log("\nDónde se pide cuenta");
const portada = await (await fetch(`${BASE}/`)).text();
check(
  "la portada ofrece el alta que dice el entorno",
  portada.includes("https://idp.example.invalid/if/flow/enroll-pixelforge/"),
  true
);
check("y la de nadie más", portada.includes("auth.kaicorplabs.com"), false);

resumen();
