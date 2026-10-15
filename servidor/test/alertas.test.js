// Alertas de reabastecimiento (decisión D7): por stock mínimo y por temporada.
// Con los datos de ejemplo y la fecha HOY (14 de octubre), el servidor debe generar
// las mismas 6 alertas que muestra el prototipo.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { HOY, IDS, prepararEntorno } from "./apoyo.js";
import { revisarTodo } from "../src/servicios/alertas.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const llamar = (operacion, peticion, estado) => entorno.llamar(operacion, { ...peticion, token: entorno.tokenEmpleado }, estado);
const activas = async (tipo) => (await llamar("listarAlertas", { url: `/alertas?estado=activa${tipo ? `&tipo=${tipo}` : ""}` }, 200)).cuerpo;

test("los datos de ejemplo generan 4 alertas de stock mínimo y 2 de temporada", async () => {
  const stockMinimo = await activas("stock_minimo");
  const temporada = await activas("temporada");
  assert.equal(stockMinimo.length, 4);
  assert.equal(temporada.length, 2);
  const porProducto = Object.fromEntries(temporada.map((a) => [a.producto_id, a]));
  assert.equal(porProducto[IDS.crisantemo].demanda_estimada, 60, "60 crisantemos vendidos el año pasado");
  assert.equal(porProducto[IDS.espatifilo].demanda_estimada, 18);
  assert.ok(temporada.every((a) => a.temporada_id === IDS.difuntos));
});

test("revisar otra vez no repite alertas", async () => {
  assert.deepEqual(await revisarTodo(entorno.db, HOY), { stock_minimo: 0, temporada: 0 });
});

test("fuera de la ventana de una temporada no hay alertas de temporada nuevas", async () => {
  assert.equal((await revisarTodo(entorno.db, "2026-07-01")).temporada, 0);
});

test("bajar el stock de un producto por debajo del mínimo crea la alerta al momento", async () => {
  const { cuerpo } = await llamar("verProducto", { url: `/productos/${IDS.cactus}` }, 200);
  await llamar("actualizarProducto", { metodo: "PATCH", url: `/productos/${IDS.cactus}`, cuerpo: { stock: cuerpo.stock_minimo - 1 } }, 200);
  const alerta = (await activas("stock_minimo")).find((a) => a.producto_id === IDS.cactus);
  assert.ok(alerta, "se creó la alerta del cactus");
  assert.equal(alerta.stock_actual, cuerpo.stock_minimo - 1);
});

test("atender una alerta la cierra y no se puede volver a cambiar", async () => {
  const [alerta] = await activas("temporada");
  const { cuerpo } = await llamar("actualizarAlerta", { metodo: "PATCH", url: `/alertas/${alerta.id}`, cuerpo: { estado: "atendida" } }, 200);
  assert.equal(cuerpo.estado, "atendida");
  await llamar("actualizarAlerta", { metodo: "PATCH", url: `/alertas/${alerta.id}`, cuerpo: { estado: "descartada" } }, 422);
  await llamar("actualizarAlerta", { metodo: "PATCH", url: `/alertas/${alerta.id}`, cuerpo: { estado: "activa" } }, 422);
  assert.equal((await revisarTodo(entorno.db, HOY)).temporada, 0, "una alerta de temporada atendida no se vuelve a crear");
});

test("filtros con valores fuera del contrato responden 400", async () => {
  await llamar("listarAlertas", { url: "/alertas?tipo=urgente" }, 400);
  await llamar("actualizarAlerta", { metodo: "PATCH", url: `/alertas/${IDS.inexistente}`, cuerpo: { estado: "atendida" } }, 404);
});
