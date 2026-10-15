// El contrato y el servidor no se pueden separar: cada operación de api/openapi.yaml
// tiene que existir en el servidor, con el mismo método y la misma ruta.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

test("cada operación del contrato está implementada en el servidor", () => {
  const faltantes = [];
  for (const [ruta, item] of Object.entries(entorno.contrato.doc.paths)) {
    for (const metodo of ["get", "post", "patch", "delete"]) {
      if (!item[metodo]) continue;
      const url = ruta.replace(/\{(\w+)\}/g, ":$1"); // /productos/{producto_id} → /productos/:producto_id
      if (!entorno.app.hasRoute({ method: metodo.toUpperCase(), url })) faltantes.push(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
  assert.deepEqual(faltantes, [], `Operaciones del contrato sin implementar: ${faltantes.join(", ")}`);
});

test("GET /salud informa la versión del contrato y el estado de la base", async () => {
  const { cuerpo } = await entorno.llamar("verSalud", { url: "/salud" }, 200);
  assert.deepEqual(cuerpo, { estado: "ok", base_de_datos: "ok", version: entorno.contrato.version });
});

test("una ruta que no existe responde 404 con el formato de error del contrato", async () => {
  const respuesta = await entorno.app.inject({ method: "GET", url: "/no-existe" });
  assert.equal(respuesta.statusCode, 404);
  assert.equal(respuesta.json().codigo, "NO_ENCONTRADO");
});

test("las respuestas llevan las cabeceras de seguridad", async () => {
  const respuesta = await entorno.app.inject({ method: "GET", url: "/salud" });
  assert.equal(respuesta.headers["x-content-type-options"], "nosniff");
  assert.ok(respuesta.headers["content-security-policy"]);
});

test("CORS solo acepta los orígenes configurados", async () => {
  const preflight = (origen) =>
    entorno.app.inject({ method: "OPTIONS", url: "/productos", headers: { origin: origen, "access-control-request-method": "PATCH" } });
  assert.equal((await preflight("http://localhost:8080")).headers["access-control-allow-origin"], "http://localhost:8080");
  assert.equal((await preflight("https://otro-sitio.example")).headers["access-control-allow-origin"], undefined);
});
