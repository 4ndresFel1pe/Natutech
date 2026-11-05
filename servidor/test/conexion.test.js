// Tiempos de espera de la conexión con PostgreSQL (src/db.js). Si la base no
// responde, la API debe contestar con un error controlado en pocos segundos, no
// quedarse esperando sin límite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearPool } from "../src/db.js";
import { cargarContrato } from "../src/contrato.js";
import { construirApp } from "../src/app.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));

test("PostgreSQL corta cualquier consulta que pase de 15 segundos", async () => {
  const db = crearPool(process.env.DATABASE_URL);
  try {
    const { rows } = await db.query("SHOW statement_timeout");
    assert.equal(rows[0].statement_timeout, "15s");
  } finally {
    await db.end();
  }
});

test("si PostgreSQL cierra una conexión inactiva, la API sigue funcionando", async () => {
  const db = crearPool(process.env.DATABASE_URL);
  const otra = crearPool(process.env.DATABASE_URL);
  try {
    const { rows } = await db.query("SELECT pg_backend_pid() AS pid");
    // La conexión queda inactiva en el pool. Desde otra conexión se cierra a la fuerza,
    // que es lo mismo que le pasa cuando PostgreSQL se reinicia o se detiene.
    await otra.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
    await new Promise((listo) => setTimeout(listo, 300)); // deja llegar el aviso de cierre
    const despues = await db.query("SELECT 1 AS uno");
    assert.equal(despues.rows[0].uno, 1);
  } finally {
    await db.end();
    await otra.end();
  }
});

test("sin base de datos, GET /salud responde 503 en pocos segundos", async () => {
  // 10.255.255.1 es una dirección privada sin servidor: sin tiempo de espera, la
  // conexión quedaría colgada.
  const db = crearPool("postgres://natutech@10.255.255.1:5432/natutech");
  const app = await construirApp({
    config: { jwtSecreto: randomBytes(32).toString("hex"), jwtExpiraEn: "1h", origenesPermitidos: [] },
    db,
    contratoDoc: cargarContrato(path.resolve(aqui, "../../api/openapi.yaml")),
    registro: false,
  });
  try {
    const inicio = Date.now();
    const respuesta = await app.inject({ method: "GET", url: "/salud" });
    const segundos = (Date.now() - inicio) / 1000;

    assert.equal(respuesta.statusCode, 503);
    assert.deepEqual(respuesta.json(), { estado: "degradado", base_de_datos: "sin_conexion", version: app.contrato.version });
    assert.equal(app.contrato.validarRespuesta("verSalud", 503, respuesta.json()), null);
    assert.ok(segundos < 7, `tardó ${segundos} s; el límite para conectarse es de 5 s`);
  } finally {
    await app.close();
    await db.end();
  }
});
