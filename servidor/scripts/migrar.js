// npm run migrar: aplica las migraciones pendientes y termina.
import { crearPool } from "../src/db.js";
import { migrar } from "../src/migraciones.js";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Revise el archivo .env.");
  process.exit(1);
}
const db = crearPool(process.env.DATABASE_URL);
try {
  await migrar(db);
  console.log("Base de datos al día.");
} finally {
  await db.end();
}
