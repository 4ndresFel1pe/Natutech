// Alertas de reabastecimiento (decisión D7). Las genera el servidor:
// - stock_minimo: el stock de un producto bajó de su mínimo.
// - temporada: una temporada entró en su ventana de anticipación y el stock no
//   alcanza lo que se vendió en esa misma ventana el año anterior.
import { hoyColombia } from "../formato.js";
import { noEncontrado, validacionFallida } from "../errores.js";

const COLUMNAS = `id, producto_id, temporada_id, tipo, stock_actual, demanda_estimada, estado,
  creado_en, actualizado_en`;

export async function listar(db, { estado, tipo }) {
  const condiciones = [];
  const valores = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
  }
  if (tipo) {
    valores.push(tipo);
    condiciones.push(`tipo = $${valores.length}`);
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM alerta ${donde} ORDER BY creado_en DESC`, valores);
  return rows;
}

// Solo una alerta activa se puede marcar como atendida o descartada.
export async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query("SELECT estado FROM alerta WHERE id = $1", [id]);
  if (!rows[0]) throw noEncontrado(id);
  if (rows[0].estado !== "activa") {
    throw validacionFallida(`La alerta ya está ${rows[0].estado}.`, [
      { campo: "estado", problema: `solo se cambia una alerta activa, y esta está ${rows[0].estado}` },
    ]);
  }
  const resultado = await db.query(`UPDATE alerta SET estado = $2 WHERE id = $1 RETURNING ${COLUMNAS}`, [id, estado]);
  return resultado.rows[0];
}

// Crea alertas de stock mínimo. No repite una alerta si ya hay una activa, ni si
// el personal ya atendió una después del último cambio del producto.
export async function revisarStockMinimo(db, productos = null) {
  const { rowCount } = await db.query(
    `INSERT INTO alerta (producto_id, tipo, stock_actual)
     SELECT p.id, 'stock_minimo', p.stock FROM producto p
      WHERE p.stock < p.stock_minimo
        AND ($1::uuid[] IS NULL OR p.id = ANY($1))
        AND NOT EXISTS (
          SELECT 1 FROM alerta a
           WHERE a.producto_id = p.id AND a.tipo = 'stock_minimo'
             AND (a.estado = 'activa' OR a.creado_en >= p.actualizado_en))
     ON CONFLICT DO NOTHING`,
    [productos],
  );
  return rowCount;
}

// Crea alertas de temporada para las temporadas cuya ventana incluye «hoy».
// La demanda estimada son las unidades vendidas (pedidos no cancelados) de cada
// producto en la misma ventana del año anterior. Una alerta de temporada no se
// vuelve a crear si el personal ya la atendió o la descartó.
export async function revisarTemporadas(db, hoy = hoyColombia()) {
  const { rowCount } = await db.query(
    `WITH proximas AS (
        SELECT id, fecha, dias_anticipacion FROM temporada
         WHERE $1::date BETWEEN fecha - dias_anticipacion AND fecha),
      demanda AS (
        SELECT t.id AS temporada_id, d.producto_id, sum(d.cantidad) AS unidades
          FROM proximas t
          JOIN pedido pe
            ON (pe.creado_en AT TIME ZONE 'America/Bogota')::date
               BETWEEN (t.fecha - interval '1 year')::date - t.dias_anticipacion
                   AND (t.fecha - interval '1 year')::date
          JOIN detalle_pedido d ON d.pedido_id = pe.id
         WHERE pe.estado <> 'cancelado'
         GROUP BY t.id, d.producto_id)
     INSERT INTO alerta (producto_id, temporada_id, tipo, stock_actual, demanda_estimada)
     SELECT p.id, dm.temporada_id, 'temporada', p.stock, dm.unidades
       FROM demanda dm JOIN producto p ON p.id = dm.producto_id
      WHERE p.stock < dm.unidades
        AND NOT EXISTS (SELECT 1 FROM alerta a WHERE a.producto_id = p.id AND a.temporada_id = dm.temporada_id)
     ON CONFLICT DO NOTHING`,
    [hoy],
  );
  return rowCount;
}

export async function revisarTodo(db, hoy) {
  const minimo = await revisarStockMinimo(db);
  const temporada = await revisarTemporadas(db, hoy);
  return { stock_minimo: minimo, temporada };
}
