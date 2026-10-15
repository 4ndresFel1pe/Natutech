// Autenticación y permisos: inicio de sesión con JWT, contraseñas con bcrypt,
// rutas protegidas (401) y operaciones solo para administradores (403).
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, IDS, prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const iniciar = (cuerpo, estado) => entorno.llamar("iniciarSesion", { metodo: "POST", url: "/sesiones", cuerpo }, estado);

test("inicia sesión sin importar las mayúsculas del correo y entrega un token", async () => {
  const { cuerpo } = await iniciar({ correo: ADMIN.correo.toUpperCase(), contrasena: ADMIN.contrasena }, 201);
  assert.match(cuerpo.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(cuerpo.usuario.rol, "administrador");
  assert.match(cuerpo.expira_en, /-05:00$/);
  assert.equal("contrasena_hash" in cuerpo.usuario, false, "el hash nunca sale de la base de datos");
});

test("la contraseña se guarda cifrada con bcrypt", async () => {
  const { rows } = await entorno.db.query("SELECT contrasena_hash FROM usuario WHERE correo = $1", [ADMIN.correo]);
  assert.match(rows[0].contrasena_hash, /^\$2[aby]\$12\$/);
  assert.notEqual(rows[0].contrasena_hash, ADMIN.contrasena);
});

test("una contraseña equivocada y un correo inexistente dan el mismo mensaje", async () => {
  const malaClave = await iniciar({ correo: ADMIN.correo, contrasena: "otra-clave-larga" }, 401);
  const sinCuenta = await iniciar({ correo: "nadie@prueba.test", contrasena: "otra-clave-larga" }, 401);
  assert.equal(malaClave.cuerpo.mensaje, sinCuenta.cuerpo.mensaje);
});

test("campos que faltan o con formato malo responden 422 con detalles", async () => {
  const { cuerpo } = await iniciar({ correo: "no-es-un-correo" }, 422);
  assert.equal(cuerpo.codigo, "VALIDACION_FALLIDA");
  assert.deepEqual(
    cuerpo.detalles.map((d) => d.campo).sort(),
    ["contrasena", "correo"],
  );
});

test("un JSON mal formado responde 400", async () => {
  const respuesta = await entorno.app.inject({
    method: "POST",
    url: "/sesiones",
    payload: '{"correo":',
    headers: { "content-type": "application/json" },
  });
  assert.equal(respuesta.statusCode, 400);
  assert.equal(respuesta.json().codigo, "SOLICITUD_INVALIDA");
});

test("las rutas de gestión piden sesión", async () => {
  const { cuerpo } = await entorno.llamar("listarProductos", { url: "/productos" }, 401);
  assert.equal(cuerpo.codigo, "NO_AUTENTICADO");
  await entorno.llamar("listarPedidos", { url: "/pedidos", token: `${entorno.tokenAdmin}alterado` }, 401);
  await entorno.llamar("listarAlertas", { url: "/alertas", token: "no.es.un-token" }, 401);
});

test("un empleado trabaja con el inventario pero no hace operaciones de administrador", async () => {
  const token = entorno.tokenEmpleado;
  await entorno.llamar("listarProductos", { url: "/productos", token }, 200);
  const prohibidas = [
    ["crearCategoria", { metodo: "POST", url: "/categorias", cuerpo: { nombre: "Bonsáis" } }],
    ["eliminarCategoria", { metodo: "DELETE", url: `/categorias/${IDS.interior}` }],
    ["ajustarPreciosCategoria", { metodo: "POST", url: `/categorias/${IDS.interior}/ajuste-precios`, cuerpo: { porcentaje: 10 } }],
    ["eliminarProducto", { metodo: "DELETE", url: `/productos/${IDS.cactus}` }],
    ["eliminarTemporada", { metodo: "DELETE", url: `/temporadas/${IDS.difuntos}` }],
  ];
  for (const [operacion, peticion] of prohibidas) {
    const { cuerpo } = await entorno.llamar(operacion, { ...peticion, token }, 403);
    assert.equal(cuerpo.codigo, "SIN_PERMISO");
  }
});
