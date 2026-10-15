// Colombia no tiene horario de verano: su desfase con UTC es siempre -05:00.
// Por eso basta con restar cinco horas y escribir el desfase a mano, sin
// depender de la zona horaria del computador o del contenedor.
const CINCO_HORAS = 5 * 60 * 60 * 1000;

export function fechaHoraColombia(fecha) {
  const local = new Date(fecha.getTime() - CINCO_HORAS);
  return `${local.toISOString().slice(0, 19)}-05:00`;
}

// Fecha de hoy en Colombia, "AAAA-MM-DD".
export function hoyColombia(ahora = new Date()) {
  return fechaHoraColombia(ahora).slice(0, 10);
}
