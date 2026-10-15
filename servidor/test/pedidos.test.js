// Pedidos: se registran en una transacción que descuenta el stock. Si una línea
// falla, no se guarda nada. Cancelar devuelve el stock.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { IDS, prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const llamar = (operacion, peticion, estado) => entorno.llamar(operacion, { ...peticion, token: entorno.tokenEmpleado }, estado);
const stock = async (id) => (await llamar("verProducto", { url: `/productos/${id}` }, 200)).cuerpo.stock;
const pedido = (detalles, extra = {}) => ({
  cliente_nombre: "Cliente de prueba",
  cliente_telefono: "+57 300 000 9999",
  canal: "whatsapp",
  detalles,
  ...extra,
});
const crear = (cuerpo, estado) => llamar("crearPedido", { metodo: "POST", url: "/pedidos", cuerpo }, estado);
const cambiar = (id, cuerpo, estado) => llamar("actualizarPedido", { metodo: "PATCH", url: `/pedidos/${id}`, cuerpo }, estado);

test("registra el pedido, calcula el total y descuenta el stock", async () => {
  const [anturio, cactus] = [await stock(IDS.anturio), await stock(IDS.cactus)];
  const { cuerpo, cabeceras } = await crear(
    pedido([{ producto_id: IDS.anturio, cantidad: 2 }, { producto_id: IDS.cactus, cantidad: 3 }], { fecha_entrega: "2026-10-20" }),
    201,
  );
  assert.equal(cabeceras.location, `/pedidos/${cuerpo.id}`);
  assert.equal(cuerpo.estado, "pendiente");
  assert.equal(cuerpo.total, 2 * 38000 + 3 * 15000, "el precio sale del producto, no del cliente");
  assert.equal(cuerpo.detalles.length, 2);
  assert.equal(await stock(IDS.anturio), anturio - 2);
  assert.equal(await stock(IDS.cactus), cactus - 3);
});

test("si falta stock en una línea no se guarda ninguna (transacción)", async () => {
  const cactus = await stock(IDS.cactus);
  const { cuerpo } = await crear(pedido([{ producto_id: IDS.cactus, cantidad: 1 }, { producto_id: IDS.orquidea, cantidad: 1 }]), 422);
  assert.equal(cuerpo.detalles[0].campo, "detalles[1].cantidad");
  assert.match(cuerpo.detalles[0].problema, /hay 0 en stock/);
  assert.equal(await stock(IDS.cactus), cactus, "el cactus no se descontó");
});

test("rechaza productos repetidos, cantidades en cero y productos inexistentes", async () => {
  await crear(pedido([{ producto_id: IDS.cactus, cantidad: 1 }, { producto_id: IDS.cactus, cantidad: 1 }]), 422);
  await crear(pedido([{ producto_id: IDS.cactus, cantidad: 0 }]), 422);
  await crear(pedido([]), 422);
  const { cuerpo } = await crear(pedido([{ producto_id: IDS.inexistente, cantidad: 1 }]), 422);
  assert.equal(cuerpo.detalles[0].campo, "detalles[0].producto_id");
});

test("pedidos simultáneos no venden más de lo que hay", async () => {
  await llamar("actualizarProducto", { metodo: "PATCH", url: `/productos/${IDS.cactus}`, cuerpo: { stock: 3 } }, 200);
  const intentos = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      entorno.app.inject({
        method: "POST",
        url: "/pedidos",
        headers: { authorization: `Bearer ${entorno.tokenEmpleado}` },
        payload: pedido([{ producto_id: IDS.cactus, cantidad: 1 }], { cliente_nombre: `Cliente simultáneo ${i + 1}` }),
      }),
    ),
  );
  const codigos = intentos.map((r) => r.statusCode).sort();
  assert.deepEqual(codigos, [201, 201, 201, 422, 422, 422]);
  assert.equal(await stock(IDS.cactus), 0);
});

test("sigue el flujo pendiente → confirmado → entregado", async () => {
  const { cuerpo } = await crear(pedido([{ producto_id: IDS.espatifilo, cantidad: 1 }]), 201);
  await cambiar(cuerpo.id, { estado: "entregado" }, 422); // no puede saltarse la confirmación
  await cambiar(cuerpo.id, { estado: "confirmado", fecha_entrega: "2026-10-30" }, 200);
  const entregado = await cambiar(cuerpo.id, { estado: "entregado" }, 200);
  assert.equal(entregado.cuerpo.estado, "entregado");
  await cambiar(cuerpo.id, { estado: "cancelado" }, 422); // un pedido entregado ya no se cancela
  await cambiar(cuerpo.id, { fecha_entrega: "2026-11-01" }, 422);
});

test("cancelar devuelve el stock", async () => {
  const antes = await stock(IDS.espatifilo);
  const { cuerpo } = await crear(pedido([{ producto_id: IDS.espatifilo, cantidad: 2 }]), 201);
  assert.equal(await stock(IDS.espatifilo), antes - 2);
  await cambiar(cuerpo.id, { estado: "cancelado" }, 200);
  assert.equal(await stock(IDS.espatifilo), antes);
  await cambiar(cuerpo.id, { estado: "confirmado" }, 422);
});

test("lista los pedidos por estado y por fecha, y ve uno con sus detalles", async () => {
  const { cuerpo } = await llamar("listarPedidos", { url: "/pedidos?estado=cancelado" }, 200);
  assert.ok(cuerpo.datos.length > 0);
  assert.ok(cuerpo.datos.every((p) => p.estado === "cancelado"));
  const fechas = await llamar("listarPedidos", { url: "/pedidos?desde=2026-10-01&hasta=2026-10-02" }, 200);
  assert.ok(fechas.cuerpo.datos.every((p) => p.creado_en.slice(0, 10) >= "2026-10-01" && p.creado_en.slice(0, 10) <= "2026-10-02"));
  const uno = await llamar("verPedido", { url: `/pedidos/${cuerpo.datos[0].id}` }, 200);
  assert.ok(uno.cuerpo.detalles.length > 0);
  await llamar("verPedido", { url: `/pedidos/${IDS.inexistente}` }, 404);
  await llamar("listarPedidos", { url: "/pedidos?desde=ayer" }, 400);
});
