// Punto de entrada: lee la configuración, prepara la base de datos y abre el puerto.
// Con Docker Compose basta "docker compose up": las migraciones, los datos de
// ejemplo y el administrador inicial se crean solos al arrancar.
import { leerConfiguracion } from "./config.js";
import { crearPool } from "./db.js";
import { migrar } from "./migraciones.js";
import { cargarContrato } from "./contrato.js";
import { construirApp } from "./app.js";
import { sembrarDatosEjemplo } from "./semillas.js";
import { crearAdministradorInicial } from "./servicios/usuarios.js";
import { revisarTodo } from "./servicios/alertas.js";
import { liberarReservasVencidas } from "./servicios/tienda.js";

let config;
try {
  config = leerConfiguracion();
} catch (error) {
  console.error(`No se pudo iniciar: ${error.message}`);
  process.exit(1);
}

const db = crearPool(config.baseDeDatos);

// PostgreSQL puede tardar unos segundos en aceptar conexiones al arrancar el conjunto.
async function esperarBaseDeDatos(intentos = 15) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await db.query("SELECT 1");
      return;
    } catch (error) {
      if (i === intentos) throw error;
      console.warn(`La base de datos todavía no responde (intento ${i} de ${intentos}).`);
      await new Promise((listo) => setTimeout(listo, 2000));
    }
  }
}

await esperarBaseDeDatos();
await migrar(db);
if (config.sembrarDatosEjemplo) await sembrarDatosEjemplo(db, config.datosEjemplo);
await crearAdministradorInicial(db, config.administradorInicial);

const app = await construirApp({ config, db, contratoDoc: cargarContrato(config.contrato) });

// Revisión de alertas al arrancar y luego cada HORAS_ENTRE_ALERTAS horas.
async function revisarAlertas() {
  try {
    const creadas = await revisarTodo(db);
    app.log.info(creadas, "revisión de alertas");
  } catch (error) {
    app.log.error({ err: error }, "falló la revisión de alertas");
  }
}
await revisarAlertas();
setInterval(revisarAlertas, config.horasEntreAlertas * 60 * 60 * 1000).unref();

// Tienda en línea (D18): cada 5 minutos se cancelan los pedidos que vencieron sin pagar y
// sus unidades vuelven al inventario.
async function liberarReservas() {
  try {
    const canceladas = await liberarReservasVencidas(db);
    if (canceladas) app.log.info({ canceladas }, "reservas vencidas de la tienda en línea");
  } catch (error) {
    app.log.error({ err: error }, "falló la liberación de reservas");
  }
}
await liberarReservas();
setInterval(liberarReservas, 5 * 60 * 1000).unref();

// Apagado ordenado: termina las peticiones en curso y cierra las conexiones.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.once(senal, async () => {
    app.log.info(`Recibida ${senal}: cerrando.`);
    await app.close();
    await db.end();
    process.exit(0);
  });
}

await app.listen({ port: config.puerto, host: "0.0.0.0" });
