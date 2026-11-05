// Tienda en línea (decisión D18): el cliente arma su carrito en el catálogo público y paga
// con Wompi. Es la única forma de crear un pedido sin sesión, así que se protege así:
// - Los precios y el total los calcula el servidor; del navegador solo llegan ids y cantidades.
// - Solo se pueden comprar productos visibles en el catálogo, con stock suficiente.
// - Las unidades quedan apartadas un tiempo (config.tienda.minutosReserva). El enlace de
//   Wompi vence a esa misma hora; si el cliente no paga, el pedido se cancela solo y el
//   stock vuelve al inventario (liberarReservasVencidas).
// - Cada conexión puede crear pocos pedidos por ventana de tiempo (rutas/tienda.js).
import * as pagos from "./pagos.js";
import * as pedidos from "./pedidos.js";

// Minutos de espera después del vencimiento antes de cancelar: deja llegar un aviso de
// Wompi que se haya demorado.
const MINUTOS_DE_GRACIA = 10;

export async function crearPedido(pool, config, entrada) {
  if (!config.pagos.activo) throw pagos.sinConfigurar();
  await liberarReservasVencidas(pool);

  // Al segundo exacto: la misma hora va en el enlace y en la firma de integridad.
  const vence = new Date(Math.ceil(Date.now() / 1000) * 1000 + config.tienda.minutosReserva * 60_000).toISOString();
  const pedido = await pedidos.crear(pool, { ...entrada, canal: "web" }, { soloVisibles: true, reservadoHasta: vence });
  const pago = await pagos.crear(pool, config.pagos, pedido.id, { venceEn: vence });

  // Respuesta pública: lo justo para llevar al cliente a pagar.
  return {
    pedido_id: pedido.id,
    referencia: pago.referencia,
    total: pedido.total,
    enlace_pago: pago.enlace_pago,
    reservado_hasta: pedido.reservado_hasta,
  };
}

// Cancela los pedidos de la tienda en línea que vencieron sin un pago aprobado. Cancelar
// devuelve las unidades al inventario (pedidos.cambiar) y el enlace queda «vencido».
// Corre al arrancar, cada 5 minutos (servidor.js) y antes de cada pedido nuevo.
export async function liberarReservasVencidas(pool, minutosDeGracia = MINUTOS_DE_GRACIA) {
  const { rows } = await pool.query(
    `SELECT p.id FROM pedido p
      WHERE p.canal = 'web' AND p.estado = 'pendiente'
        AND p.reservado_hasta < now() - make_interval(mins => $1)
        AND NOT EXISTS (SELECT 1 FROM pago pg WHERE pg.pedido_id = p.id AND pg.estado = 'aprobado')`,
    [minutosDeGracia],
  );
  for (const { id } of rows) {
    await pedidos.cambiar(pool, id, { estado: "cancelado" });
    await pool.query("UPDATE pago SET estado = 'vencido' WHERE pedido_id = $1 AND estado = 'pendiente'", [id]);
  }
  return rows.length;
}
