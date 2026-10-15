// Conexión a PostgreSQL. Todas las sesiones trabajan en hora de Colombia y las
// fechas salen en el formato del contrato: ISO 8601 con -05:00.
import pg from "pg";
import { fechaHoraColombia } from "./formato.js";

const { Pool, types } = pg;

// date (1082): se devuelve tal cual, "2026-11-02", sin convertirla a Date (evita
// que la zona horaria del proceso la corra un día).
types.setTypeParser(1082, (valor) => valor);
// timestamptz (1184): se convierte a "2026-10-14T18:00:00-05:00".
types.setTypeParser(1184, (valor) => fechaHoraColombia(new Date(valor)));
// bigint (20), que devuelven count(*) y sum(): son cantidades pequeñas, caben en Number.
types.setTypeParser(20, (valor) => Number(valor));

// "esquema" solo lo usan las pruebas: trabajan en un esquema aparte ("pruebas") para
// no tocar los datos del esquema public de la misma base.
export function crearPool(cadenaConexion, { esquema } = {}) {
  if (esquema && !/^[a-z_]+$/.test(esquema)) throw new Error(`Nombre de esquema no válido: ${esquema}`);
  return new Pool({
    connectionString: cadenaConexion,
    max: 10,
    options: `-c timezone=America/Bogota${esquema ? ` -c search_path=${esquema},public` : ""}`,
  });
}

// Ejecuta fn dentro de una transacción: o se guarda todo, o no se guarda nada.
export async function enTransaccion(pool, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
