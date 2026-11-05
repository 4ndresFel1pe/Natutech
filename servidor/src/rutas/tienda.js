// Tienda en línea (decisión D18): el carrito del catálogo público crea el pedido y lleva
// al cliente a pagar con Wompi. Es pública, así que tiene un límite por conexión.
import { ErrorApi } from "../errores.js";
import * as alertas from "../servicios/alertas.js";
import * as tienda from "../servicios/tienda.js";

// Límite sencillo en memoria: cada dirección IP puede crear config.tienda.pedidosPorVentana
// pedidos cada config.tienda.minutosVentana minutos. Basta porque hay un solo contenedor de
// la API; detrás de Caddy y nginx, request.ip es la IP real del cliente (trustProxy).
function limitePorConexion(config) {
  const vistas = new Map();
  return async (request) => {
    const { pedidosPorVentana, minutosVentana } = config.tienda;
    const ahora = Date.now();
    const recientes = (vistas.get(request.ip) || []).filter((momento) => ahora - momento < minutosVentana * 60_000);
    if (recientes.length >= pedidosPorVentana) {
      throw new ErrorApi(
        429,
        "DEMASIADAS_SOLICITUDES",
        "Se hicieron muchos pedidos seguidos desde esta conexión. Espere unos minutos o escríbanos por WhatsApp.",
      );
    }
    recientes.push(ahora);
    if (vistas.size > 5000) vistas.clear(); // no crece sin límite
    vistas.set(request.ip, recientes);
  };
}

export default async function rutasTienda(app, { db, contrato, config }) {
  app.post(
    "/catalogo/pedidos",
    { schema: contrato.esquemas("crearPedidoTienda"), preHandler: [limitePorConexion(config)] },
    async (request, reply) => {
      const resultado = await tienda.crearPedido(db, config, request.body);
      await alertas.revisarStockMinimo(db, request.body.detalles.map((detalle) => detalle.producto_id));
      reply.code(201);
      return resultado;
    },
  );
}
