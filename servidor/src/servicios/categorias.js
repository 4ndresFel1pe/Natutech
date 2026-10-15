// Categorías del catálogo y ajuste masivo de precios por categoría.
import { enTransaccion } from "../db.js";
import { conflicto, noEncontrado } from "../errores.js";
import { actualizar, esUnicoRepetido, insertar } from "./sql.js";

const COLUMNAS = "id, nombre, descripcion, creado_en, actualizado_en";
const EDITABLES = ["nombre", "descripcion"];

const repetida = (nombre) =>
  conflicto(`Ya existe una categoría llamada «${nombre}».`, [{ campo: "nombre", problema: "ya está en uso" }]);

export async function listar(db) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM categoria ORDER BY nombre`);
  return rows;
}

export async function ver(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM categoria WHERE id = $1`, [id]);
  if (!rows[0]) throw noEncontrado(id);
  return rows[0];
}

export async function crear(db, datos) {
  try {
    return await insertar(db, "categoria", datos, EDITABLES, COLUMNAS);
  } catch (error) {
    if (esUnicoRepetido(error, "uq_categoria_nombre")) throw repetida(datos.nombre);
    throw error;
  }
}

export async function cambiar(db, id, cambios) {
  try {
    const categoria = await actualizar(db, "categoria", id, cambios, EDITABLES, COLUMNAS);
    if (!categoria) throw noEncontrado(id);
    return categoria;
  } catch (error) {
    if (esUnicoRepetido(error, "uq_categoria_nombre")) throw repetida(cambios.nombre);
    throw error;
  }
}

// La llave foránea es RESTRICT: una categoría con productos no se borra.
export async function eliminar(db, id) {
  const categoria = await ver(db, id);
  const { rows } = await db.query("SELECT count(*) AS total FROM producto WHERE categoria_id = $1", [id]);
  if (rows[0].total > 0) {
    throw conflicto(
      `La categoría «${categoria.nombre}» tiene ${rows[0].total} producto${rows[0].total === 1 ? "" : "s"}. Muévalos a otra categoría antes de eliminarla.`,
      [{ campo: "categoria_id", problema: "tiene productos asociados" }],
    );
  }
  await db.query("DELETE FROM categoria WHERE id = $1", [id]);
}

// Sube o baja un porcentaje todos los precios de la categoría, en una sola
// transacción, redondeando a la centena. Los pedidos viejos no cambian porque
// cada línea guarda su precio_unitario.
export async function ajustarPrecios(pool, id, porcentaje) {
  await ver(pool, id);
  return enTransaccion(pool, async (cliente) => {
    const { rowCount } = await cliente.query(
      `UPDATE producto
          SET precio = LEAST(5000000, GREATEST(0, round(precio * (100 + $2) / 100.0 / 100) * 100))
        WHERE categoria_id = $1`,
      [id, porcentaje],
    );
    return { categoria_id: id, porcentaje, productos_actualizados: rowCount };
  });
}
