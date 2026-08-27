/**
 * Lo que se sube y lo que cuesta.
 *
 * Las dos rutas de esta aplicación arrancan un Python que puede tardar minutos y
 * ocupar más de un giga. Eso convierte cosas que en otra aplicación serían
 * detalles —el tamaño de lo que entra, cuántas peticiones se atienden a la vez—
 * en la diferencia entre un servicio y una forma cómoda de tumbar la máquina.
 */
import { check, nota, png, procesar, resumen, sesion } from "./comun.mjs";

const cookie = sesion();
const PNG = png(40, 30);

console.log("Lo que se acepta y lo que no");
check("una imagen de verdad entra", (await procesar("/api/removebg", { cookie, datos: PNG })).status, 200);
check("sin fichero, no", (await procesar("/api/removebg", { cookie, datos: null })).status, 400);
check("un cero bytes tampoco pasa por bueno", (await procesar("/api/removebg", { cookie, datos: Buffer.alloc(0) })).status !== 200, true);
check(
  "un tipo que no es imagen se rechaza",
  (await procesar("/api/removebg", { cookie, datos: Buffer.from("no soy una imagen"), nombre: "x.txt", tipo: "text/plain" })).status,
  400
);

// Lo anterior lo paraba la comprobación de tipo, que mira el nombre y el tipo
// declarado: dos cosas que escribe quien sube. Esto es lo que se colaba —basura
// con nombre de imagen— y llegaba hasta PIL para acabar en 500. Doce ficheros
// distintos daban 500 los doce, y en quitar fondo cada uno costaba arrancar un
// Python entero, 1,3 segundos, para nada.
const disfrazados = [
  ["texto", Buffer.from("no soy una imagen, soy texto plano")],
  ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
  ["un SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
  ["cero bytes", Buffer.alloc(0)],
  ["un PNG cortado por la mitad", PNG.subarray(0, 40)],
  ["un ZIP", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0])],
];
for (const ruta of ["/api/removebg", "/api/vectorize"]) {
  for (const [que, datos] of disfrazados) {
    const r = await procesar(ruta, { cookie, datos, nombre: "x.png", tipo: "image/png" });
    check(`${ruta.split("/").pop()}: ${que} con nombre .png da 400, no 500`, r.status, 400);
  }
}

console.log("\nEl modelo va por lista blanca");
// `model` viaja hasta `new_session()` de rembg, que con un nombre desconocido
// intenta resolverlo y descargarlo. No hay inyección —los argumentos van en
// array, sin shell— pero un valor cualquiera convertía la petición en trabajo
// inútil del servidor y un 500.
// La cadena vacía NO va en esta lista: `formData.get("model") || "isnet-general-use"`
// la trata como "usa el de por defecto", que es lo correcto.
for (const malo of ["../../etc/passwd", "u2net; rm -rf /", "inventado", "u2net\n--alpha-matting"]) {
  check(
    `no acepta el modelo ${JSON.stringify(malo.slice(0, 18))}`,
    (await procesar("/api/removebg", { cookie, datos: PNG, campos: { model: malo } })).status,
    400
  );
}
check(
  "y uno de la lista sí",
  (await procesar("/api/removebg", { cookie, datos: PNG, campos: { model: "u2netp" } })).status,
  200
);

// Y se rechaza SIN arrancar nada. Importa por dos motivos: no gastar un proceso
// de 1,3 segundos para nada, y sobre todo no dejar que la basura ocupe turno en
// la cola —si se rechazara después de pedir turno, subir ficheros inválidos
// bastaría para que nadie más pudiera trabajar—.
//
// El umbral tiene margen de sobra: medido, la basura se rechaza en 13–70 ms y
// una imagen legítima tarda 5,5 segundos. Cualquier valor entre medias sirve, y
// 800 ms aguanta una máquina cargada sin dar un falso fallo.
const antes = Date.now();
await procesar("/api/removebg", { cookie, datos: Buffer.from("nada de nada"), nombre: "x.png" });
const tardo = Date.now() - antes;
nota("rechazar basura tarda", `${tardo} ms`);
check("la basura se rechaza sin arrancar el proceso", tardo < 800, true);

console.log("\nEl presupuesto de píxeles");
// El tope de 50 MB que había era de FICHERO, y esas dos cosas no se parecen: un
// PNG de color plano de 8000x8000 ocupa 197 KB en disco y son 64 millones de
// píxeles. Medido contra este servicio antes de arreglarlo: esos 197 KB hacían
// que Python llegara a 2,1 GB de residente y once segundos de CPU quitando el
// fondo. Unas diez mil veces lo que pesa lo que se sube.
const bomba = png(8000, 8000);
nota("la bomba pesa", `${Math.round(bomba.length / 1024)} KB para ${(8000 * 8000) / 1e6} millones de píxeles`);
check("quitar el fondo la rechaza", (await procesar("/api/removebg", { cookie, datos: bomba })).status, 413);
check("vectorizar también", (await procesar("/api/vectorize", { cookie, datos: bomba })).status, 413);
// Y una imagen grande pero razonable sigue entrando: un tope que se coma las
// fotos de un móvil no arregla nada, rompe la aplicación.
check(
  "una foto grande de verdad sigue entrando",
  (await procesar("/api/vectorize", { cookie, datos: png(3000, 2000) })).status,
  200
);

console.log("\nLos turnos");
// Sin cola, seis peticiones eran seis procesos de Python a la vez peleándose por
// los cuatro núcleos de esta máquina —medido: cada una pasó de 5 a 29 segundos—.
// Con imágenes grandes eso deja de ser lentitud: es la memoria del equipo, y con
// ella se van los otros cuatro servicios y el proveedor de identidad.
//
// La primera versión de esto comprobaba que las duraciones "se escalonaban", y
// no valía nada: con la cola quitada seguía pasando, porque seis procesos
// peleándose por cuatro núcleos también tardan cosas distintas. Medir el reloj
// era medir la carga de la máquina. Lo que sí es del mecanismo y de nada más:
// pasada la cola, sobra, y lo que sobra se rechaza con 503 y un Retro-After.
const enTromba = await Promise.all(
  Array.from({ length: 6 }, (_, i) =>
    procesar("/api/vectorize", { cookie, datos: png(600, 400), nombre: `t${i}.png` })
  )
);
const codigos = enTromba.map((r) => r.status);
nota("seis a la vez", codigos.join(", "));
check("algunas se atienden", codigos.filter((c) => c === 200).length >= 2, true);
check("y las que sobran se rechazan, no se encolan sin fin", codigos.includes(503), true);
const rechazada = enTromba.find((r) => r.status === 503);
check("el rechazo dice cuándo volver", Boolean(rechazada?.body?.error), true);

// Y pasada la tromba, el servicio sigue vivo: si el turno no se cediera al
// fallar, el contador se quedaría subido y la cola se cerraría sola para
// siempre. Es el fallo clásico de un semáforo sin `finally`.
check(
  "después de la tromba se sigue atendiendo",
  (await procesar("/api/vectorize", { cookie, datos: png(400, 300) })).status,
  200
);

console.log("\nEl nombre del fichero que vuelve");
// Una cabecera HTTP sólo admite bytes 0–255, así que un nombre con acentos o con
// un salto de línea es por donde se cuela una cabecera entera si nadie lo mira.
const conAcentos = await procesar("/api/removebg", { cookie, datos: PNG, nombre: "diseño ñandú.png" });
nota("content-disposition", conAcentos.disp);
// `inline`, no `attachment`: el resultado se previsualiza en la propia página.
check("sale bien formada", /^inline; filename="/.test(conAcentos.disp ?? ""), true);
check("y con el nombre real en UTF-8 detrás", /filename\*=UTF-8''/.test(conAcentos.disp ?? ""), true);
check("y sin saltos de línea sueltos", /[\r\n]/.test(conAcentos.disp ?? ""), false);

const hostil = await procesar("/api/removebg", {
  cookie,
  datos: PNG,
  nombre: 'x";\r\nX-Inyectada: si\r\n\r\n.png',
});
// Lo que importa no es que el TEXTO aparezca dentro del nombre entrecomillado
// —ahí es un dato— sino que no nazca una cabecera de verdad. Comprobar lo
// primero era confundir el dato con la estructura.
check("un nombre hostil no cuela una cabecera nueva", hostil.inyectada, false);
check("y los saltos de línea no sobreviven", /[\r\n]/.test(hostil.disp ?? ""), false);

resumen();
