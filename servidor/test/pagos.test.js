// Pagos en línea con Wompi (decisión D17): enlace firmado con el secreto de integridad,
// eventos aceptados solo con la firma correcta, idempotencia y consulta del resultado.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { IDS, PAGOS, prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");
const llamar = (...argumentos) => entorno.llamar(...argumentos);

async function pedidoNuevo() {
  const cuerpo = {
    cliente_nombre: "Cliente de prueba",
    cliente_telefono: "+57 300 000 0001",
    detalles: [{ producto_id: IDS.cactus, cantidad: 1 }],
  };
  return (await llamar("crearPedido", { metodo: "POST", url: "/pedidos", cuerpo, token: entorno.tokenEmpleado }, 201)).cuerpo;
}

const cobrar = async (pedidoId, estado = 201, token = entorno.tokenEmpleado) =>
  (await llamar("crearPago", { metodo: "POST", url: `/pedidos/${pedidoId}/pagos`, token }, estado)).cuerpo;

const pagosDe = async (pedidoId) =>
  (await llamar("listarPagos", { url: `/pedidos/${pedidoId}/pagos`, token: entorno.tokenEmpleado }, 200)).cuerpo;

let consecutivo = 0;
function transaccion(pago, status, cambios = {}) {
  consecutivo += 1;
  return {
    id: `01-1793860000-${String(consecutivo).padStart(5, "0")}`,
    amount_in_cents: pago.monto * 100,
    reference: pago.referencia,
    currency: "COP",
    payment_method_type: "CARD",
    status,
    ...cambios,
  };
}

// Evento como lo manda Wompi, firmado con SHA-256(valores de las propiedades + timestamp + secreto).
function evento(datosTransaccion, secreto = PAGOS.secretoEventos) {
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const timestamp = 1793860000;
  const t = datosTransaccion;
  const checksum = sha256(`${t.id}${t.status}${t.amount_in_cents}${timestamp}${secreto}`).toUpperCase();
  return {
    event: "transaction.updated",
    data: { transaction: datosTransaccion },
    environment: "test",
    signature: { properties, checksum },
    timestamp,
    sent_at: "2026-11-05T07:00:00.000Z",
  };
}

const recibir = (cuerpo, estado = 200) =>
  llamar("recibirEventoPago", { metodo: "POST", url: "/pagos/eventos", cuerpo }, estado);

test("genera un enlace de pago firmado con el secreto de integridad", async () => {
  const pedido = await pedidoNuevo();
  const pago = await cobrar(pedido.id);
  assert.equal(pago.estado, "pendiente");
  assert.equal(pago.monto, pedido.total);
  assert.match(pago.referencia, /^NAT-[0-9A-F]{12}$/);

  const enlace = new URL(pago.enlace_pago);
  assert.equal(`${enlace.origin}${enlace.pathname}`, "https://checkout.wompi.co/p/");
  const centavos = String(pedido.total * 100);
  assert.equal(enlace.searchParams.get("public-key"), PAGOS.llavePublica);
  assert.equal(enlace.searchParams.get("currency"), "COP");
  assert.equal(enlace.searchParams.get("amount-in-cents"), centavos);
  assert.equal(enlace.searchParams.get("reference"), pago.referencia);
  assert.equal(enlace.searchParams.get("signature:integrity"), sha256(`${pago.referencia}${centavos}COP${PAGOS.secretoIntegridad}`));
  assert.equal(enlace.searchParams.get("redirect-url"), "https://natutech.lat/pago-resultado.html");
  // El secreto nunca sale en el enlace.
  assert.ok(!pago.enlace_pago.includes(PAGOS.secretoIntegridad));

  const { cuerpo: conPago } = await llamar("verPedido", { url: `/pedidos/${pedido.id}`, token: entorno.tokenEmpleado }, 200);
  assert.equal(conPago.estado_pago, "pendiente");
});

test("un evento aprobado con firma válida marca el pago y confirma el pedido; repetirlo no cambia nada", async () => {
  const pedido = await pedidoNuevo();
  const pago = await cobrar(pedido.id);
  const aprobada = transaccion(pago, "APPROVED");

  const { cuerpo } = await recibir(evento(aprobada));
  assert.deepEqual(cuerpo, { recibido: true, actualizado: true });

  const [guardado] = await pagosDe(pedido.id);
  assert.equal(guardado.estado, "aprobado");
  assert.equal(guardado.transaccion_id, aprobada.id);
  assert.equal(guardado.metodo, "CARD");
  assert.equal(guardado.enlace_pago, null);

  const { cuerpo: confirmado } = await llamar("verPedido", { url: `/pedidos/${pedido.id}`, token: entorno.tokenEmpleado }, 200);
  assert.equal(confirmado.estado, "confirmado");
  assert.equal(confirmado.estado_pago, "aprobado");

  // Wompi reintenta los avisos: el mismo evento otra vez no cambia nada.
  const { cuerpo: repetido } = await recibir(evento(aprobada));
  assert.deepEqual(repetido, { recibido: true, actualizado: false });
  assert.equal((await pagosDe(pedido.id)).length, 1);

  // Un pedido pagado no se vuelve a cobrar.
  await cobrar(pedido.id, 409);
});

test("rechaza un evento con firma falsa y no acepta un monto distinto al del enlace", async () => {
  const pedido = await pedidoNuevo();
  const pago = await cobrar(pedido.id);

  await recibir(evento(transaccion(pago, "APPROVED"), "otro_secreto"), 401);
  const sinFirma = evento(transaccion(pago, "APPROVED"));
  delete sinFirma.signature.checksum;
  await recibir(sinFirma, 422);

  // Firma correcta, pero por otro monto: no corresponde al enlace que generó el vivero.
  const { cuerpo } = await recibir(evento(transaccion(pago, "APPROVED", { amount_in_cents: 100 })));
  assert.equal(cuerpo.actualizado, false);
  assert.equal((await pagosDe(pedido.id))[0].estado, "pendiente");
});

test("un pago rechazado no confirma el pedido y se puede generar otro enlace", async () => {
  const pedido = await pedidoNuevo();
  const primero = await cobrar(pedido.id);
  await recibir(evento(transaccion(primero, "DECLINED")));

  const { cuerpo: sigue } = await llamar("verPedido", { url: `/pedidos/${pedido.id}`, token: entorno.tokenEmpleado }, 200);
  assert.equal(sigue.estado, "pendiente");
  assert.equal(sigue.estado_pago, "rechazado");

  const segundo = await cobrar(pedido.id);
  assert.notEqual(segundo.referencia, primero.referencia);
  const lista = await pagosDe(pedido.id);
  assert.deepEqual(lista.map((pago) => pago.estado), ["pendiente", "rechazado"]);
});

test("no cobra un pedido cancelado, uno inexistente ni sin sesión", async () => {
  const pedido = await pedidoNuevo();
  await llamar("actualizarPedido", { metodo: "PATCH", url: `/pedidos/${pedido.id}`, cuerpo: { estado: "cancelado" }, token: entorno.tokenEmpleado }, 200);
  await cobrar(pedido.id, 409);
  await cobrar(IDS.inexistente, 404);
  await llamar("listarPagos", { url: `/pedidos/${IDS.inexistente}/pagos`, token: entorno.tokenEmpleado }, 404);
  await llamar("crearPago", { metodo: "POST", url: `/pedidos/${pedido.id}/pagos` }, 401);
});

test("la página de resultado le pregunta a Wompi si el evento todavía no llegó", async () => {
  const pedido = await pedidoNuevo();
  const pago = await cobrar(pedido.id);
  const aprobada = transaccion(pago, "APPROVED", { payment_method_type: "NEQUI" });

  const fetchOriginal = globalThis.fetch;
  const consultadas = [];
  globalThis.fetch = async (url) => {
    consultadas.push(String(url));
    return new Response(JSON.stringify({ data: aprobada }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const { cuerpo } = await llamar("verTransaccionPago", { url: `/pagos/transacciones/${aprobada.id}` }, 200);
    assert.deepEqual(cuerpo, { referencia: pago.referencia, estado: "aprobado", monto: pago.monto, metodo: "NEQUI", ambiente: "pruebas" });
    assert.deepEqual(consultadas, [`https://sandbox.wompi.co/v1/transactions/${aprobada.id}`]);

    // Ya aprobado: la segunda consulta sale de la base, sin preguntarle a Wompi.
    await llamar("verTransaccionPago", { url: `/pagos/transacciones/${aprobada.id}` }, 200);
    assert.equal(consultadas.length, 1);

    // Una transacción que Wompi no conoce.
    globalThis.fetch = async () => new Response("{}", { status: 404 });
    await llamar("verTransaccionPago", { url: "/pagos/transacciones/01-0000000000-00000" }, 404);
    await llamar("verTransaccionPago", { url: "/pagos/transacciones/no%20valida" }, 400);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("sin las llaves de Wompi, el cobro en línea responde 503 y lo demás sigue igual", async () => {
  const pedido = await pedidoNuevo();
  PAGOS.activo = false;
  try {
    const { cuerpo } = await llamar("crearPago", { metodo: "POST", url: `/pedidos/${pedido.id}/pagos`, token: entorno.tokenEmpleado }, 503);
    assert.equal(cuerpo.codigo, "SERVICIO_NO_DISPONIBLE");
    await recibir(evento(transaccion({ monto: 1000, referencia: "NAT-000000000000" }, "APPROVED")), 503);
  } finally {
    PAGOS.activo = true;
  }
});
