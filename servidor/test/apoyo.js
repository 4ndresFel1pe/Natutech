// Apoyo común de las pruebas.
// - La base de datos: cada archivo de pruebas empieza con un esquema "pruebas" limpio,
//   con las migraciones y los datos de ejemplo. El esquema public (el de desarrollo)
//   no se toca.
// - La aplicación: se usa sin abrir puertos, con app.inject().
// - El contrato: cada respuesta se compara con lo que declara api/openapi.yaml para
//   esa operación y ese código de estado. Si la API y el contrato no coinciden, la
//   prueba falla aunque el código de estado sea el correcto.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearPool } from "../src/db.js";
import { migrar } from "../src/migraciones.js";
import { cargarContrato } from "../src/contrato.js";
import { construirApp } from "../src/app.js";
import { sembrarDatosEjemplo } from "../src/semillas.js";
import { crearUsuario } from "../src/servicios/usuarios.js";
import { revisarTodo } from "../src/servicios/alertas.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ESQUEMA = "pruebas";
const silencio = { log() {}, info() {}, warn() {} };

// Fecha fija para las alertas de temporada: queda dentro de la ventana del
// Día de los Difuntos (2 de noviembre, 21 días de anticipación).
export const HOY = "2026-10-14";

export const ADMIN = { correo: "admin@prueba.test", contrasena: "clave-admin-prueba" };
export const EMPLEADO = { correo: "empleado@prueba.test", contrasena: "clave-empleado-prueba" };

// Identificadores de web/datos/ejemplo.json que usan varias pruebas.
export const IDS = {
  anturio: "1f491554-7cdd-48dd-a438-47ce97802716", // stock 3
  cactus: "2215207b-73ad-46d2-86b2-6213df17d4c3", // stock 10
  orquidea: "ea26f008-ad4f-43b9-9437-df601b91e6b0", // stock 0
  crisantemo: "3da94211-90a8-48a3-b787-059be5559766",
  espatifilo: "d1d37c83-b213-4a63-80f9-1ecf63628ff7",
  interior: "d75df7ee-5c1f-4a9f-9213-5cb13ccc38b7", // categoría con productos
  difuntos: "7fca59fa-5f46-4048-855f-87627cdb7487",
  inexistente: "00000000-0000-4000-8000-000000000000",
};

export async function prepararEntorno() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Las pruebas necesitan DATABASE_URL (vea .env.example). Con Docker: docker compose up -d db");
  }
  const db = crearPool(process.env.DATABASE_URL, { esquema: ESQUEMA });
  await db.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
  await db.query(`CREATE SCHEMA ${ESQUEMA}`);
  await migrar(db, silencio);
  await sembrarDatosEjemplo(db, path.resolve(aqui, "../../web/datos/ejemplo.json"), silencio);
  await revisarTodo(db, HOY);
  await crearUsuario(db, { nombre: "Administración de prueba", ...ADMIN, rol: "administrador" });
  await crearUsuario(db, { nombre: "Empleado de prueba", ...EMPLEADO, rol: "empleado" });

  const config = {
    jwtSecreto: randomBytes(32).toString("hex"), // un secreto nuevo en cada ejecución
    jwtExpiraEn: "1h",
    origenesPermitidos: ["http://localhost:8080"],
  };
  const app = await construirApp({ config, db, contratoDoc: cargarContrato(path.resolve(aqui, "../../api/openapi.yaml")), registro: false });
  const { contrato } = app;

  // Hace la petición, comprueba el código de estado y valida el cuerpo contra el contrato.
  async function llamar(operationId, { metodo = "GET", url, cuerpo, token, cabeceras = {} }, estadoEsperado) {
    const respuesta = await app.inject({
      method: metodo,
      url,
      payload: cuerpo,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...cabeceras },
    });
    assert.equal(respuesta.statusCode, estadoEsperado, `${operationId}: se esperaba ${estadoEsperado} y llegó ${respuesta.statusCode}: ${respuesta.body}`);
    const json = respuesta.body ? respuesta.json() : undefined;
    const errores = contrato.validarRespuesta(operationId, estadoEsperado, json);
    assert.equal(errores, null, `${operationId} ${estadoEsperado} no cumple el contrato: ${JSON.stringify(errores)}`);
    return { cuerpo: json, cabeceras: respuesta.headers };
  }

  async function iniciarSesion({ correo, contrasena }) {
    const { cuerpo } = await llamar("iniciarSesion", { metodo: "POST", url: "/sesiones", cuerpo: { correo, contrasena } }, 201);
    return cuerpo.token;
  }

  return {
    app,
    db,
    contrato,
    llamar,
    tokenAdmin: await iniciarSesion(ADMIN),
    tokenEmpleado: await iniciarSesion(EMPLEADO),
    async cerrar() {
      await app.close();
      await db.end();
    },
  };
}
