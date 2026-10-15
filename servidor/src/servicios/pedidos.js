// Pedidos cerrados por WhatsApp o en la tienda. Crear un pedido descuenta el stock
// de varios productos a la vez: todo pasa dentro de una transacción (decisión D3).
import { enTransaccion } from "../db.js";
import { noEncontrado, validacionFallida } from "../errores.js";
import { paginacion } from "./sql.js";

const COLUMNAS_PEDIDO = `p.id, p.cliente_nombre, p.cliente_telefono, p.canal, p.estado, p.fecha_entrega,
  p.nota, p.total, p.creado_en, p.actualizado_en`;
const COLUMNAS_DETALLE = "id, pedido_id, producto_id, cantidad, precio_unitario, creado_en, actualizado_en";

// Transiciones permitidas (el contrato las declara en PATCH /pedidos/{id}).
const SIGUIENTES = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
};

async function conDetalles(db, pedidos) {
  if (!pedidos.length) return pedidos;
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_DETALLE} FROM detalle_pedido WHERE pedido_id = ANY($1) ORDER BY creado_en, id`,
    [pedidos.map((pedido) => pedido.id)],
  );
  for (const pedido of pedidos) pedido.detalles = rows.filter((detalle) => detalle.pedido_id === pedido.id);
  return pedidos;
}

export async function listar(db, { estado, desde, hasta, pagina, por_pagina }) {
  const { limite, desplazamiento } = paginacion(pagina, por_pagina);
  const condiciones = [];
  const valores = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`p.estado = $${valores.length}`);
  }
  // desde y hasta son días completos en hora de Colombia.
  if (desde) {
    valores.push(desde);
    condiciones.push(`(p.creado_en AT TIME ZONE 'America/Bogota')::date >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`(p.creado_en AT TIME ZONE 'America/Bogota')::date <= $${valores.length}`);
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const n = valores.length;
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_PEDIDO}, count(*) OVER () AS total_filas FROM pedido p ${donde}
     ORDER BY p.creado_en DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...valores, limite, desplazamiento],
  );
  const total = rows[0]?.total_filas ?? 0;
  for (const fila of rows) delete fila.total_filas;
  return { datos: await conDetalles(db, rows), paginacion: { pagina, por_pagina, total } };
}

export async function ver(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS_PEDIDO} FROM pedido p WHERE p.id = $1`, [id]);
  if (!rows[0]) throw noEncontrado(id);
  return (await conDetalles(db, rows))[0];
}

export async function crear(pool, entrada) {
  const repetidos = entrada.detalles
    .map((detalle, i) => ({ ...detalle, i }))
    .filter((detalle, _, todos) => todos.findIndex((otro) => otro.producto_id === detalle.producto_id) !== detalle.i);
  if (repetidos.length) {
    throw validacionFallida(
      "Un producto aparece en dos líneas del pedido. Sume las cantidades en una sola línea.",
      repetidos.map((detalle) => ({ campo: `detalles[${detalle.i}].producto_id`, problema: "se repite en el pedido" })),
    );
  }

  const id = await enTransaccion(pool, async (cliente) => {
    // FOR UPDATE bloquea las filas de esos productos hasta el final de la transacción:
    // dos pedidos simultáneos no pueden vender la misma unidad. Se bloquean en orden
    // de id para que dos transacciones nunca se esperen la una a la otra.
    const ids = entrada.detalles.map((detalle) => detalle.producto_id);
    const { rows: productos } = await cliente.query(
      "SELECT id, nombre, precio, stock FROM producto WHERE id = ANY($1) ORDER BY id FOR UPDATE",
      [ids],
    );
    const porId = new Map(productos.map((producto) => [producto.id, producto]));

    const problemas = [];
    entrada.detalles.forEach((detalle, i) => {
      const producto = porId.get(detalle.producto_id);
      if (!producto) {
        problemas.push({ campo: `detalles[${i}].producto_id`, problema: "no existe un producto con ese identificador" });
      } else if (producto.stock < detalle.cantidad) {
        problemas.push({
          campo: `detalles[${i}].cantidad`,
          problema: `se piden ${detalle.cantidad} de «${producto.nombre}» y hay ${producto.stock} en stock`,
        });
      }
    });
    if (problemas.length) {
      const sinStock = problemas.some((p) => p.campo.endsWith("cantidad"));
      throw validacionFallida(
        sinStock ? "No hay stock suficiente para registrar el pedido." : "Revise los productos del pedido.",
        problemas,
      );
    }

    const total = entrada.detalles.reduce(
      (suma, detalle) => suma + porId.get(detalle.producto_id).precio * detalle.cantidad,
      0,
    );
    const { rows } = await cliente.query(
      `INSERT INTO pedido (cliente_nombre, cliente_telefono, canal, fecha_entrega, nota, total)
       VALUES ($1, $2, coalesce($3::canal_pedido, 'whatsapp'), $4, $5, $6) RETURNING id`,
      [entrada.cliente_nombre, entrada.cliente_telefono, entrada.canal ?? null, entrada.fecha_entrega ?? null, entrada.nota ?? null, total],
    );
    const pedidoId = rows[0].id;

    for (const detalle of entrada.detalles) {
      const producto = porId.get(detalle.producto_id);
      // precio_unitario copia el precio de hoy: una subida posterior no cambia este pedido (D6).
      await cliente.query(
        "INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)",
        [pedidoId, producto.id, detalle.cantidad, producto.precio],
      );
      await cliente.query("UPDATE producto SET stock = stock - $2 WHERE id = $1", [producto.id, detalle.cantidad]);
    }
    return pedidoId;
  });

  return ver(pool, id);
}

export async function cambiar(pool, id, cambios) {
  await enTransaccion(pool, async (cliente) => {
    const { rows } = await cliente.query("SELECT id, estado FROM pedido WHERE id = $1 FOR UPDATE", [id]);
    const actual = rows[0];
    if (!actual) throw noEncontrado(id);

    const cerrado = ["entregado", "cancelado"].includes(actual.estado);
    if (cambios.estado && cambios.estado !== actual.estado && !SIGUIENTES[actual.estado].includes(cambios.estado)) {
      throw validacionFallida(`Un pedido ${actual.estado} no puede pasar a ${cambios.estado}.`, [
        { campo: "estado", problema: `transición de ${actual.estado} a ${cambios.estado} no permitida` },
      ]);
    }
    if (cambios.fecha_entrega !== undefined && cerrado) {
      throw validacionFallida(`No se puede cambiar la fecha de entrega de un pedido ${actual.estado}.`, [
        { campo: "fecha_entrega", problema: `el pedido ya está ${actual.estado}` },
      ]);
    }

    // Cancelar devuelve las unidades al stock.
    if (cambios.estado === "cancelado" && actual.estado !== "cancelado") {
      await cliente.query(
        `UPDATE producto p SET stock = p.stock + d.cantidad
           FROM detalle_pedido d WHERE d.pedido_id = $1 AND d.producto_id = p.id`,
        [id],
      );
    }

    const asignaciones = [];
    const valores = [id];
    for (const campo of ["estado", "fecha_entrega", "nota"]) {
      if (cambios[campo] === undefined) continue;
      valores.push(cambios[campo]);
      asignaciones.push(`${campo} = $${valores.length}`);
    }
    await cliente.query(`UPDATE pedido SET ${asignaciones.join(", ")} WHERE id = $1`, valores);
  });
  return ver(pool, id);
}

// Productos de un pedido, para revisar si alguno quedó por debajo del mínimo.
export function productosDe(pedido) {
  return pedido.detalles.map((detalle) => detalle.producto_id);
}
