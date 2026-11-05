// Tienda en línea (decisión D18): el carrito crea el pedido sin sesión, con precios del
// servidor, aparta el stock 30 minutos con un enlace de Wompi que vence a la misma hora,
// y cancela solo lo que no se pagó.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { IDS, PAGOS, TIENDA, prepararEntorno } from "./apoyo.js";
import { liberarReservasVencidas } from "../src/servicios/tienda.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");
const llamar = (...argumentos) => entorno.llamar(...argumentos);

const carrito = (detalles, extra = {}) => ({ cliente_nombre: "Paola Rincón", cliente_telefono: "+57 300 000 0301", detalles, ...extra });
const comprar = (cuerpo, estado = 201) => llamar("crearPedidoTienda", { metodo: "POST", url: "/catalogo/pedidos", cuerpo }, estado);

async function stock(id) {
  const { rows } = await entorno.db.query("SELECT stock, precio FROM producto WHERE id = $1", [id]);
  return rows[0];
}
const verPedido = async (id) => (await llamar("verPedido", { url: `/pedidos/${id}`, token: entorno.tokenEmpleado }, 200)).cuerpo;

test("el carrito crea un pedido con precios del servidor, aparta el stock y da un enlace que vence", async () => {
  const antes = await stock(IDS.cactus);
  const inicio = Date.now();
  const { cuerpo } = await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 2 }]));

  assert.equal(cuerpo.total, antes.precio * 2);
  assert.equal((await stock(IDS.cactus)).stock, antes.stock - 2);

  const pedido = await verPedido(cuerpo.pedido_id);
  assert.equal(pedido.canal, "web");
  assert.equal(pedido.estado, "pendiente");
  assert.equal(pedido.estado_pago, "pendiente");
  const minutos = (Date.parse(pedido.reservado_hasta) - inicio) / 60_000;
  assert.ok(minutos > 29 && minutos <= 31, `aparta ${minutos} minutos`);

  // El enlace vence a la misma hora y la firma de integridad incluye esa fecha.
  const enlace = new URL(cuerpo.enlace_pago);
  const vence = enlace.searchParams.get("expiration-time");
  assert.equal(Date.parse(vence), Date.parse(pedido.reservado_hasta));
  const centavos = enlace.searchParams.get("amount-in-cents");
  assert.equal(centavos, String(cuerpo.total * 100));
  assert.equal(enlace.searchParams.get("signature:integrity"), sha256(`${cuerpo.referencia}${centavos}COP${vence}${PAGOS.secretoIntegridad}`));
});

test("no acepta precios del navegador, productos ocultos ni más unidades de las que hay", async () => {
  // El esquema no admite campos de más: el precio no lo pone el cliente.
  await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 1, precio_unitario: 1 }]), 422);

  // Un producto oculto del catálogo no se puede comprar desde la tienda.
  await entorno.db.query("UPDATE producto SET visible_en_catalogo = false WHERE id = $1", [IDS.espatifilo]);
  const { cuerpo: oculto } = await comprar(carrito([{ producto_id: IDS.espatifilo, cantidad: 1 }]), 422);
  assert.equal(oculto.detalles[0].campo, "detalles[0].producto_id");
  await entorno.db.query("UPDATE producto SET visible_en_catalogo = true WHERE id = $1", [IDS.espatifilo]);

  const { cuerpo: sinStock } = await comprar(carrito([{ producto_id: IDS.orquidea, cantidad: 1 }]), 422);
  assert.equal(sinStock.detalles[0].campo, "detalles[0].cantidad");
  await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 51 }]), 422);
});

test("si no se paga, el pedido vence solo: se cancela, el stock vuelve y el enlace queda vencido", async () => {
  const antes = (await stock(IDS.anturio)).stock;
  const { cuerpo: sinPagar } = await comprar(carrito([{ producto_id: IDS.anturio, cantidad: 1 }]));
  const { cuerpo: pagado } = await comprar(carrito([{ producto_id: IDS.anturio, cantidad: 1 }], { cliente_nombre: "Cliente que sí pagó" }));
  assert.equal((await stock(IDS.anturio)).stock, antes - 2);

  // El que sí pagó: Wompi lo aprueba antes de vencer.
  const [pago] = (await llamar("listarPagos", { url: `/pedidos/${pagado.pedido_id}/pagos`, token: entorno.tokenEmpleado }, 200)).cuerpo;
  const tx = { id: "01-1793860000-90001", amount_in_cents: pago.monto * 100, reference: pago.referencia, currency: "COP", payment_method_type: "CARD", status: "APPROVED" };
  const checksum = sha256(`${tx.id}${tx.status}${tx.amount_in_cents}1793860000${PAGOS.secretoEventos}`);
  await llamar("recibirEventoPago", { metodo: "POST", url: "/pagos/eventos", cuerpo: { event: "transaction.updated", data: { transaction: tx }, signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum }, timestamp: 1793860000 } }, 200);

  // Antes de vencer no se toca nada.
  assert.equal(await liberarReservasVencidas(entorno.db), 0);

  // Pasa el tiempo: los dos quedan vencidos hace una hora.
  await entorno.db.query("UPDATE pedido SET reservado_hasta = now() - interval '1 hour' WHERE id = ANY($1)", [[sinPagar.pedido_id, pagado.pedido_id]]);
  assert.equal(await liberarReservasVencidas(entorno.db), 1);

  const cancelado = await verPedido(sinPagar.pedido_id);
  assert.equal(cancelado.estado, "cancelado");
  assert.equal(cancelado.estado_pago, "vencido");
  const confirmado = await verPedido(pagado.pedido_id);
  assert.equal(confirmado.estado, "confirmado");
  assert.equal(confirmado.estado_pago, "aprobado");
  // Solo volvió la unidad del pedido sin pagar.
  assert.equal((await stock(IDS.anturio)).stock, antes - 1);

  // El enlace vencido ya no se ofrece.
  const [vencido] = (await llamar("listarPagos", { url: `/pedidos/${sinPagar.pedido_id}/pagos`, token: entorno.tokenEmpleado }, 200)).cuerpo;
  assert.equal(vencido.estado, "vencido");
  assert.equal(vencido.enlace_pago, null);
});

test("si el personal genera otro enlace para un pedido de la tienda, el pedido deja de vencer", async () => {
  const { cuerpo } = await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 1 }]));
  await llamar("crearPago", { metodo: "POST", url: `/pedidos/${cuerpo.pedido_id}/pagos`, token: entorno.tokenEmpleado }, 201);
  assert.equal((await verPedido(cuerpo.pedido_id)).reservado_hasta, null);
  await entorno.db.query("UPDATE pago SET vence_en = now() - interval '1 hour' WHERE pedido_id = $1 AND vence_en IS NOT NULL", [cuerpo.pedido_id]);
  assert.equal(await liberarReservasVencidas(entorno.db), 0);
  assert.equal((await verPedido(cuerpo.pedido_id)).estado, "pendiente");
});

test("sin llaves de Wompi no se crea nada, y una misma conexión tiene un límite de pedidos", async () => {
  const antes = (await stock(IDS.cactus)).stock;
  PAGOS.activo = false;
  try {
    const { cuerpo } = await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 1 }]), 503);
    assert.equal(cuerpo.codigo, "SERVICIO_NO_DISPONIBLE");
    assert.equal((await stock(IDS.cactus)).stock, antes);
  } finally {
    PAGOS.activo = true;
  }

  const limite = TIENDA.pedidosPorVentana;
  TIENDA.pedidosPorVentana = 0;
  try {
    const { cuerpo } = await comprar(carrito([{ producto_id: IDS.cactus, cantidad: 1 }]), 429);
    assert.equal(cuerpo.codigo, "DEMASIADAS_SOLICITUDES");
  } finally {
    TIENDA.pedidosPorVentana = limite;
  }
});
