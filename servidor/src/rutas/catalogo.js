// Catálogo público: lo que ve cualquier cliente, sin iniciar sesión.
import * as productos from "../servicios/productos.js";
import * as categorias from "../servicios/categorias.js";
import * as temporadas from "../servicios/temporadas.js";

export default async function rutasCatalogo(app, { db, contrato }) {
  app.get("/catalogo/productos", { schema: contrato.esquemas("listarCatalogo") }, (request) =>
    productos.listarCatalogo(db, request.query),
  );

  app.get("/catalogo/productos/:producto_id", { schema: contrato.esquemas("verProductoCatalogo") }, (request) =>
    productos.verPublico(db, request.params.producto_id),
  );

  app.get("/categorias", { schema: contrato.esquemas("listarCategorias") }, () => categorias.listar(db));

  // Públicas porque el catálogo muestra la cuenta regresiva a la próxima temporada.
  app.get("/temporadas", { schema: contrato.esquemas("listarTemporadas") }, () => temporadas.listar(db));
  app.get("/temporadas/:temporada_id", { schema: contrato.esquemas("verTemporada") }, (request) =>
    temporadas.ver(db, request.params.temporada_id),
  );
}
