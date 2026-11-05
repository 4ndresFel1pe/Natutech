// Pagos en línea con Wompi (decisión D17). La venta se sigue cerrando por WhatsApp (D2):
// el vivero genera un enlace de pago para un pedido y se lo manda al cliente. Mientras el
// vivero no abra su propia cuenta de comercio, se usan las llaves de pruebas de Wompi
// (pub_test_...): las transacciones son de prueba y no mueven dinero real.
//
// Dos mecanismos oficiales de Wompi protegen el flujo:
// - Firma de integridad: SHA-256 de referencia + monto en centavos + moneda + secreto de
//   integridad. Va en el enlace; si alguien cambia el monto, Wompi rechaza el pago.
// - Firma de los eventos: SHA-256 de los valores de signature.properties + timestamp +
//   secreto de eventos. Sin ella, cualquiera podría avisar un pago aprobado falso.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { enTransaccion } from "../db.js";
import { ErrorApi, conflicto, noAutenticado, noEncontrado } from "../errores.js";

const COLUMNAS = "id, pedido_id, referencia, monto, estado, transaccion_id, metodo, creado_en, actualizado_en";
const MONEDA = "COP";

// Estados de una transacción en Wompi → estados de un pago en Natutech.
const ESTADOS = { PENDING: "pendiente", APPROVED: "aprobado", DECLINED: "rechazado", VOIDED: "anulado", ERROR: "error" };

const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");

function sinConfigurar() {
  return new ErrorApi(
    503,
    "SERVICIO_NO_DISPONIBLE",
    "El cobro en línea no está configurado en este servidor. Faltan las llaves de Wompi en el archivo .env.",
  );
}

export function firmaIntegridad(referencia, montoEnCentavos, moneda, secreto) {
  return sha256(`${referencia}${montoEnCentavos}${moneda}${secreto}`);
}

// Enlace al Web Checkout de Wompi con el monto, la referencia y la firma de integridad.
export function enlaceDePago(config, pago) {
  const centavos = pago.monto * 100;
  const parametros = new URLSearchParams({
    "public-key": config.llavePublica,
    currency: MONEDA,
    "amount-in-cents": String(centavos),
    reference: pago.referencia,
    "signature:integrity": firmaIntegridad(pago.referencia, centavos, MONEDA, config.secretoIntegridad),
    "redirect-url": `${config.urlPublica}/pago-resultado.html`,
  });
  return `${config.urlCheckout}?${parametros}`;
}

// Solo un pago pendiente tiene enlace: uno ya cerrado no se puede volver a pagar.
const conEnlace = (config, pago) => ({ ...pago, enlace_pago: pago.estado === "pendiente" ? enlaceDePago(config, pago) : null });

async function verPedido(db, pedidoId, bloquear = false) {
  const { rows } = await db.query(`SELECT id, estado, total FROM pedido WHERE id = $1${bloquear ? " FOR UPDATE" : ""}`, [pedidoId]);
  if (!rows[0]) throw noEncontrado(pedidoId);
  return rows[0];
}

export async function listar(pool, config, pedidoId) {
  await verPedido(pool, pedidoId);
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM pago WHERE pedido_id = $1 ORDER BY creado_en DESC`, [pedidoId]);
  return rows.map((pago) => conEnlace(config, pago));
}

export async function crear(pool, config, pedidoId) {
  if (!config.activo) throw sinConfigurar();
  const pago = await enTransaccion(pool, async (cliente) => {
    const pedido = await verPedido(cliente, pedidoId, true);
    if (pedido.estado === "cancelado") {
      throw conflicto("El pedido está cancelado: no se puede cobrar.", [{ campo: "pedido_id", problema: "el pedido está cancelado" }]);
    }
    const aprobado = await cliente.query("SELECT 1 FROM pago WHERE pedido_id = $1 AND estado = 'aprobado'", [pedidoId]);
    if (aprobado.rowCount) {
      throw conflicto("Este pedido ya tiene un pago aprobado.", [{ campo: "pedido_id", problema: "el pedido ya está pagado" }]);
    }
    const referencia = `NAT-${randomBytes(6).toString("hex").toUpperCase()}`;
    const { rows } = await cliente.query(
      `INSERT INTO pago (pedido_id, referencia, monto) VALUES ($1, $2, $3) RETURNING ${COLUMNAS}`,
      [pedidoId, referencia, pedido.total],
    );
    return rows[0];
  });
  return conEnlace(config, pago);
}

// Aplica el estado de una transacción de Wompi al pago con esa referencia. Devuelve true
// si cambió algo. Es idempotente: el mismo aviso repetido no cambia nada.
async function aplicarTransaccion(pool, transaccion) {
  const estado = ESTADOS[transaccion?.status];
  if (!estado || !transaccion.reference) return false;
  return enTransaccion(pool, async (cliente) => {
    const { rows } = await cliente.query(`SELECT ${COLUMNAS} FROM pago WHERE referencia = $1 FOR UPDATE`, [transaccion.reference]);
    const pago = rows[0];
    if (!pago) return false; // referencia que no generó este sistema
    // El monto y la moneda tienen que ser los del enlace que generó el vivero.
    if (transaccion.amount_in_cents !== pago.monto * 100 || transaccion.currency !== MONEDA) return false;
    if (pago.estado === estado && pago.transaccion_id === transaccion.id) return false;
    // Un pago cerrado no vuelve atrás; lo único posible después de aprobado es la anulación.
    const permitido = pago.estado === "pendiente" || (pago.estado === "aprobado" && estado === "anulado");
    if (!permitido) return false;
    await cliente.query("UPDATE pago SET estado = $2, transaccion_id = $3, metodo = $4 WHERE id = $1", [
      pago.id,
      estado,
      transaccion.id ?? null,
      transaccion.payment_method_type ?? null,
    ]);
    // Un pago aprobado confirma el pedido si todavía estaba pendiente.
    if (estado === "aprobado") {
      await cliente.query("UPDATE pedido SET estado = 'confirmado' WHERE id = $1 AND estado = 'pendiente'", [pago.pedido_id]);
    }
    return true;
  });
}

const valorEn = (objeto, ruta) => ruta.split(".").reduce((valor, clave) => valor?.[clave], objeto);

function verificarFirma(config, evento) {
  const propiedades = evento?.signature?.properties;
  const recibida = String(evento?.signature?.checksum ?? "").toLowerCase();
  const invalida = noAutenticado("La firma del evento no es válida.");
  if (!Array.isArray(propiedades) || !recibida || evento.timestamp === undefined) throw invalida;
  const cadena = propiedades.map((propiedad) => String(valorEn(evento.data, propiedad) ?? "")).join("");
  const esperada = sha256(`${cadena}${evento.timestamp}${config.secretoEventos}`);
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw invalida;
}

// POST /pagos/eventos: lo llama Wompi, no una persona. Primero se valida la firma.
export async function registrarEvento(pool, config, evento) {
  if (!config.activo) throw sinConfigurar();
  verificarFirma(config, evento);
  if (evento.event !== "transaction.updated") return { recibido: true, actualizado: false };
  return { recibido: true, actualizado: await aplicarTransaccion(pool, evento.data?.transaction) };
}

// Consulta oficial a Wompi: GET /transactions/{id} es público y no necesita llave.
async function consultarWompi(config, transaccionId) {
  try {
    const respuesta = await fetch(`${config.urlApi}/transactions/${encodeURIComponent(transaccionId)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json())?.data ?? null;
  } catch {
    return null; // Wompi no respondió: se queda con lo que ya se sabe
  }
}

// GET /pagos/transacciones/{id}: lo consulta la página a la que Wompi devuelve al cliente.
// Si el aviso de Wompi todavía no ha llegado, se le pregunta directamente a Wompi.
export async function verTransaccion(pool, config, transaccionId) {
  if (!config.activo) throw sinConfigurar();
  const buscar = async (columna, valor) =>
    (await pool.query(`SELECT ${COLUMNAS} FROM pago WHERE ${columna} = $1`, [valor])).rows[0];

  let pago = await buscar("transaccion_id", transaccionId);
  if (!pago || pago.estado === "pendiente") {
    const transaccion = await consultarWompi(config, transaccionId);
    if (transaccion?.reference) {
      await aplicarTransaccion(pool, transaccion);
      const porReferencia = await buscar("referencia", transaccion.reference);
      if (porReferencia && (porReferencia.transaccion_id === transaccionId || porReferencia.transaccion_id === null)) {
        pago = porReferencia;
      }
    }
  }
  if (!pago) throw noEncontrado(transaccionId);
  // Respuesta pública: sin datos del cliente.
  return { referencia: pago.referencia, estado: pago.estado, monto: pago.monto, metodo: pago.metodo, ambiente: config.ambiente };
}
