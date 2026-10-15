// Aplica en orden los archivos de db/migraciones que todavía no se han aplicado.
// Cada archivo corre en su propia transacción: si falla, no queda a medias.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { enTransaccion } from "./db.js";

const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/migraciones");

export async function migrar(pool, registro = console) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS esquema_migraciones (
      nombre     text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query("SELECT nombre FROM esquema_migraciones");
  const aplicadas = new Set(rows.map((fila) => fila.nombre));
  const archivos = (await readdir(carpeta)).filter((nombre) => nombre.endsWith(".sql")).sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(path.join(carpeta, archivo), "utf8");
    await enTransaccion(pool, async (cliente) => {
      await cliente.query(sql);
      await cliente.query("INSERT INTO esquema_migraciones (nombre) VALUES ($1)", [archivo]);
    });
    registro.info?.(`Migración aplicada: ${archivo}`);
  }
}
