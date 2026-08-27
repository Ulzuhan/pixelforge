/**
 * Cuántos trabajos pesados corren a la vez.
 *
 * Ni quitar un fondo ni vectorizar son peticiones normales: cada una arranca un
 * Python que puede tardar minutos y comerse más de un giga. No había cola de
 * ninguna clase, así que seis peticiones simultáneas arrancaban seis procesos
 * simultáneos —medido: los seis a la vez, y cada uno pasó de 5 a 29 segundos
 * peleándose por los cuatro núcleos de esta máquina—.
 *
 * Con imágenes grandes eso deja de ser lentitud y pasa a ser otra cosa: a 2,1 GB
 * por trabajo, una docena de peticiones se lleva la memoria libre del equipo, y
 * el que se queda sin ella no es sólo este servicio, son los otros cuatro y el
 * proveedor de identidad, que viven en la misma máquina.
 *
 * Dos a la vez sobre cuatro núcleos deja sitio a todo lo demás. Los que llegan
 * después esperan; si la espera ya es larga se contesta 503 con `Retry-After`,
 * que es más honrado que aceptar un trabajo que no va a empezar en un buen rato.
 */
const MAX_A_LA_VEZ = Number(process.env.PIXELFORGE_MAX_JOBS || 2);
const MAX_EN_ESPERA = Number(process.env.PIXELFORGE_MAX_QUEUE || 6);

let activos = 0;
const esperando: Array<() => void> = [];

export class ColaLlena extends Error {
  constructor() {
    super("too_busy");
    this.name = "ColaLlena";
  }
}

/** Cuántos hay ahora mismo, para poder afirmarlo en los tests. */
export function estado(): { activos: number; esperando: number; max: number } {
  return { activos, esperando: esperando.length, max: MAX_A_LA_VEZ };
}

export async function conTurno<T>(trabajo: () => Promise<T>): Promise<T> {
  if (activos >= MAX_A_LA_VEZ) {
    if (esperando.length >= MAX_EN_ESPERA) throw new ColaLlena();
    await new Promise<void>((listo) => esperando.push(listo));
  }

  activos++;
  try {
    return await trabajo();
  } finally {
    activos--;
    // El turno se cede pase lo que pase. Sin este `finally`, un trabajo que
    // falla dejaría el contador subido y la cola se cerraría sola para siempre.
    const siguiente = esperando.shift();
    if (siguiente) siguiente();
  }
}
