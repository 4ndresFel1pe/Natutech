// Rutas del panel del vivero. Todas exigen token (app.autenticar); las que borran
// datos o cambian precios en bloque exigen además el rol administrador.
import * as alertas from "../servicios/alertas.js";
import * as categorias from "../servicios/categorias.js";
import * as pedidos from "../servicios/pedidos.js";
import * as productos from "../servicios/productos.js";
import * as proveedores from "../servicios/proveedores.js";
import * as temporadas from "../servicios/temporadas.js";

export default async function rutasGestion(app, { db, contrato }) {
  const conSesion = (operacion) => ({ schema: contrato.esquemas(operacion), preHandler: [app.autenticar] });
  const soloAdministrador = (operacion) => ({
    schema: contrato.esquemas(operacion),
    preHandler: [app.autenticar, app.soloAdministrador],
  });
  const creado = (reply, ruta, recurso) => {
    reply.code(201).header("Location", `${ruta}/${recurso.id}`);
    return recurso;
  };

  // ---- Categorías ----
  app.post("/categorias", soloAdministrador("crearCategoria"), async (request, reply) =>
    creado(reply, "/categorias", await categorias.crear(db, request.body)),
  );
  app.patch("/categorias/:categoria_id", soloAdministrador("actualizarCategoria"), (request) =>
    categorias.cambiar(db, request.params.categoria_id, request.body),
  );
  app.delete("/categorias/:categoria_id", soloAdministrador("eliminarCategoria"), async (request, reply) => {
    await categorias.eliminar(db, request.params.categoria_id);
    reply.code(204).send();
  });
  app.post("/categorias/:categoria_id/ajuste-precios", soloAdministrador("ajustarPreciosCategoria"), (request) =>
    categorias.ajustarPrecios(db, request.params.categoria_id, request.body.porcentaje),
  );

  // ---- Productos ----
  app.get("/productos", conSesion("listarProductos"), (request) => productos.listarInventario(db, request.query));
  app.post("/productos", conSesion("crearProducto"), async (request, reply) => {
    const producto = await productos.crear(db, request.body);
    await alertas.revisarStockMinimo(db, [producto.id]);
    return creado(reply, "/productos", producto);
  });
  app.get("/productos/:producto_id", conSesion("verProducto"), (request) =>
    productos.ver(db, request.params.producto_id),
  );
  app.patch("/productos/:producto_id", conSesion("actualizarProducto"), async (request) => {
    const producto = await productos.cambiar(db, request.params.producto_id, request.body);
    await alertas.revisarStockMinimo(db, [producto.id]);
    return producto;
  });
  app.delete("/productos/:producto_id", soloAdministrador("eliminarProducto"), async (request, reply) => {
    await productos.eliminar(db, request.params.producto_id);
    reply.code(204).send();
  });

  // ---- Proveedores ----
  app.get("/proveedores", conSesion("listarProveedores"), () => proveedores.listar(db));
  app.post("/proveedores", conSesion("crearProveedor"), async (request, reply) =>
    creado(reply, "/proveedores", await proveedores.crear(db, request.body)),
  );
  app.get("/proveedores/:proveedor_id", conSesion("verProveedor"), (request) =>
    proveedores.ver(db, request.params.proveedor_id),
  );
  app.patch("/proveedores/:proveedor_id", conSesion("actualizarProveedor"), (request) =>
    proveedores.cambiar(db, request.params.proveedor_id, request.body),
  );

  // ---- Pedidos ----
  app.get("/pedidos", conSesion("listarPedidos"), (request) => pedidos.listar(db, request.query));
  app.post("/pedidos", conSesion("crearPedido"), async (request, reply) => {
    const pedido = await pedidos.crear(db, request.body);
    await alertas.revisarStockMinimo(db, pedidos.productosDe(pedido));
    return creado(reply, "/pedidos", pedido);
  });
  app.get("/pedidos/:pedido_id", conSesion("verPedido"), (request) => pedidos.ver(db, request.params.pedido_id));
  app.patch("/pedidos/:pedido_id", conSesion("actualizarPedido"), (request) =>
    pedidos.cambiar(db, request.params.pedido_id, request.body),
  );

  // ---- Temporadas (las de lectura son públicas y están en catalogo.js) ----
  app.post("/temporadas", conSesion("crearTemporada"), async (request, reply) =>
    creado(reply, "/temporadas", await temporadas.crear(db, request.body)),
  );
  app.patch("/temporadas/:temporada_id", conSesion("actualizarTemporada"), (request) =>
    temporadas.cambiar(db, request.params.temporada_id, request.body),
  );
  app.delete("/temporadas/:temporada_id", soloAdministrador("eliminarTemporada"), async (request, reply) => {
    await temporadas.eliminar(db, request.params.temporada_id);
    reply.code(204).send();
  });

  // ---- Alertas ----
  app.get("/alertas", conSesion("listarAlertas"), (request) => alertas.listar(db, request.query));
  app.patch("/alertas/:alerta_id", conSesion("actualizarAlerta"), (request) =>
    alertas.cambiarEstado(db, request.params.alerta_id, request.body.estado),
  );
}
