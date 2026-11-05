// Pagos en línea con Wompi (decisión D17).
// - Generar y ver los enlaces de pago de un pedido: personal del vivero, con sesión.
// - Recibir los eventos de Wompi y consultar el resultado de una transacción: públicas,
//   porque las llaman Wompi y el navegador del cliente. Los eventos se aceptan solo con
//   la firma correcta; la consulta no devuelve datos del cliente.
import * as pagos from "../servicios/pagos.js";

export default async function rutasPagos(app, { db, contrato, config }) {
  const conSesion = (operacion) => ({ schema: contrato.esquemas(operacion), preHandler: [app.autenticar] });

  app.post("/pedidos/:pedido_id/pagos", conSesion("crearPago"), async (request, reply) => {
    reply.code(201);
    return pagos.crear(db, config.pagos, request.params.pedido_id);
  });

  app.get("/pedidos/:pedido_id/pagos", conSesion("listarPagos"), (request) =>
    pagos.listar(db, config.pagos, request.params.pedido_id),
  );

  app.post("/pagos/eventos", { schema: contrato.esquemas("recibirEventoPago") }, (request) =>
    pagos.registrarEvento(db, config.pagos, request.body),
  );

  app.get("/pagos/transacciones/:transaccion_id", { schema: contrato.esquemas("verTransaccionPago") }, (request) =>
    pagos.verTransaccion(db, config.pagos, request.params.transaccion_id),
  );
}
