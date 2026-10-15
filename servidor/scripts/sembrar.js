// npm run sembrar: carga los datos de ejemplo si la base está vacía y revisa las alertas.
import { leerConfiguracion } from "../src/config.js";
import { crearPool } from "../src/db.js";
import { migrar } from "../src/migraciones.js";
import { sembrarDatosEjemplo } from "../src/semillas.js";
import { revisarTodo } from "../src/servicios/alertas.js";

const config = leerConfiguracion();
const db = crearPool(config.baseDeDatos);
try {
  await migrar(db);
  await sembrarDatosEjemplo(db, config.datosEjemplo);
  console.log("Alertas creadas:", await revisarTodo(db));
} finally {
  await db.end();
}
