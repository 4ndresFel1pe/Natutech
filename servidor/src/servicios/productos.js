// Reglas de negocio de productos: catálogo público e inventario del vivero.
import { conflicto, noEncontrado, validacionFallida } from "../errores.js";
import { actualizar, esUnicoRepetido, insertar, paginacion } from "./sql.js";

export const COLUMNAS_PRODUCTO = `id, categoria_id, proveedor_id, nombre, nombre_cientifico, descripcion,
  presentacion, precio, stock, stock_minimo, luz, riego, cuidado, imagen_url, visible_en_catalogo,
  creado_en, actualizado_en`;
// El catálogo público no expone proveedor, stock mínimo ni si el producto está oculto (decisión D5).
const COLUMNAS_PUBLICAS = `id, categoria_id, nombre, nombre_cientifico, descripcion, presentacion,
  precio, stock, luz, riego, cuidado, imagen_url`;
const EDITABLES = [
  "categoria_id", "proveedor_id", "nombre", "nombre_cientifico", "descripcion", "presentacion",
  "precio", "stock", "stock_minimo", "luz", "riego", "cuidado", "imagen_url", "visible_en_catalogo",
];

// Filtros comunes. La búsqueda ignora tildes y mayúsculas: «orquidea» encuentra «Orquídea».
function filtros({ q, categoria_id, luz, solo_disponibles, bajo_stock }, publico) {
  const condiciones = [];
  const valores = [];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replace("?", `$${valores.length}`));
  };
  if (publico) condiciones.push("visible_en_catalogo");
  if (q) {
    valores.push(`%${q}%`);
    const n = valores.length;
    condiciones.push(
      `(unaccent(nombre) ILIKE unaccent($${n}) OR unaccent(coalesce(nombre_cientifico, '')) ILIKE unaccent($${n}))`,
    );
  }
  if (categoria_id) agregar("categoria_id = ?", categoria_id);
  if (luz) agregar("luz = ?", luz);
  if (solo_disponibles) condiciones.push("stock > 0");
  if (bajo_stock) condiciones.push("stock < stock_minimo");
  return { donde: condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "", valores };
}

async function pagina(db, columnas, consulta, publico) {
  const { limite, desplazamiento } = paginacion(consulta.pagina, consulta.por_pagina);
  const { donde, valores } = filtros(consulta, publico);
  const n = valores.length;
  const { rows } = await db.query(
    `SELECT ${columnas}, count(*) OVER () AS total_filas FROM producto ${donde}
     ORDER BY nombre LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...valores, limite, desplazamiento],
  );
  let total = rows[0]?.total_filas ?? 0;
  if (!rows.length && desplazamiento > 0) {
    const conteo = await db.query(`SELECT count(*) AS total FROM producto ${donde}`, valores);
    total = conteo.rows[0].total;
  }
  for (const fila of rows) delete fila.total_filas;
  return { datos: rows, paginacion: { pagina: consulta.pagina, por_pagina: consulta.por_pagina, total } };
}

export const listarCatalogo = (db, consulta) => pagina(db, COLUMNAS_PUBLICAS, consulta, true);
export const listarInventario = (db, consulta) => pagina(db, COLUMNAS_PRODUCTO, consulta, false);

export async function verPublico(db, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM producto WHERE id = $1 AND visible_en_catalogo`,
    [id],
  );
  if (!rows[0]) throw noEncontrado(id);
  return rows[0];
}

export async function ver(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS_PRODUCTO} FROM producto WHERE id = $1`, [id]);
  if (!rows[0]) throw noEncontrado(id);
  return rows[0];
}

// La categoría y el proveedor deben existir; se avisa con un 422 claro en vez de
// dejar que la llave foránea falle.
async function revisarReferencias(db, datos) {
  const detalles = [];
  if (datos.categoria_id) {
    const { rowCount } = await db.query("SELECT 1 FROM categoria WHERE id = $1", [datos.categoria_id]);
    if (!rowCount) detalles.push({ campo: "categoria_id", problema: "no existe una categoría con ese identificador" });
  }
  if (datos.proveedor_id) {
    const { rowCount } = await db.query("SELECT 1 FROM proveedor WHERE id = $1", [datos.proveedor_id]);
    if (!rowCount) detalles.push({ campo: "proveedor_id", problema: "no existe un proveedor con ese identificador" });
  }
  if (detalles.length) throw validacionFallida("Revise los campos marcados.", detalles);
}

function nombreRepetido(nombre) {
  return conflicto(`Ya existe un producto llamado «${nombre}». Edite ese producto en lugar de crear otro.`, [
    { campo: "nombre", problema: "ya está en uso" },
  ]);
}

export async function crear(db, datos) {
  await revisarReferencias(db, datos);
  try {
    return await insertar(db, "producto", datos, EDITABLES, COLUMNAS_PRODUCTO);
  } catch (error) {
    if (esUnicoRepetido(error, "uq_producto_nombre")) throw nombreRepetido(datos.nombre);
    throw error;
  }
}

export async function cambiar(db, id, cambios) {
  await revisarReferencias(db, cambios);
  try {
    const producto = await actualizar(db, "producto", id, cambios, EDITABLES, COLUMNAS_PRODUCTO);
    if (!producto) throw noEncontrado(id);
    return producto;
  } catch (error) {
    if (esUnicoRepetido(error, "uq_producto_nombre")) throw nombreRepetido(cambios.nombre);
    throw error;
  }
}

// Un producto que ya se vendió no se borra: su historial alimenta las alertas de temporada.
export async function eliminar(db, id) {
  const producto = await ver(db, id);
  const { rows } = await db.query(
    "SELECT count(DISTINCT pedido_id) AS pedidos FROM detalle_pedido WHERE producto_id = $1",
    [id],
  );
  if (rows[0].pedidos > 0) {
    throw conflicto(
      `«${producto.nombre}» aparece en ${rows[0].pedidos} pedido${rows[0].pedidos === 1 ? "" : "s"}. Ocúltelo del catálogo en lugar de eliminarlo.`,
      [{ campo: "visible_en_catalogo", problema: "cambie este campo a false para retirarlo del catálogo" }],
    );
  }
  await db.query("DELETE FROM producto WHERE id = $1", [id]);
}
