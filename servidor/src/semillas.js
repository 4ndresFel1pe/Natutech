// Datos de ejemplo para demostrar el sistema. Salen de web/datos/ejemplo.json, el
// mismo archivo del prototipo, así que el catálogo de la API y el del prototipo
// son idénticos. Los pedidos del año pasado se generan aquí: son los que permiten
// que el servidor calcule las alertas de temporada. Todo es sintético.
import { readFile } from "node:fs/promises";
import { enTransaccion } from "./db.js";

const NOMBRES = [
  "Luz Marina Pérez", "Jorge Iván Cárdenas", "Yolanda Rincón", "Héctor Fabio Sánchez",
  "Doris Amaya", "Wilson Barrera", "Nubia Esperanza Cruz", "Orlando Chaparro",
  "Martha Lucía Vargas", "Fredy Alexander Niño", "Gladys Moreno", "Ramiro Pinzón",
];

// Ventas del año pasado en la ventana de cada temporada: [temporada, producto, unidades, pedidos].
// La del Día de los Difuntos reproduce las alertas del prototipo: 60 crisantemos y 18 espatifilos.
const VENTAS_ANIO_PASADO = [
  ["Día de los Difuntos", "3da94211-90a8-48a3-b787-059be5559766", 60, 12],
  ["Día de los Difuntos", "d1d37c83-b213-4a63-80f9-1ecf63628ff7", 18, 6],
  ["Día de los Difuntos", "94aa71c6-abc2-4062-b12b-e2a9703585e3", 12, 4],
  ["Día de los Difuntos", "a1e30e16-2d74-4416-b274-f1a76c5fe71b", 8, 4],
  ["Día de la Madre", "1f491554-7cdd-48dd-a438-47ce97802716", 14, 7],
  ["Día de la Madre", "ea26f008-ad4f-43b9-9437-df601b91e6b0", 6, 3],
  ["Día de la Madre", "43562f72-bf9b-4438-bf98-f1bb8c9e51d5", 5, 5],
  ["Amor y Amistad", "5c31d441-2f63-4fdf-b3df-01f87ad93428", 9, 6],
  ["Amor y Amistad", "44edb74d-faf2-4793-bbd2-aef0794c6dcc", 6, 4],
  ["Temporada navideña", "f57cb482-042a-49bb-b1a3-49917c41c41a", 7, 4],
  ["Temporada navideña", "34efde92-c254-4b95-94eb-2a6291a89407", 15, 5],
];

function telefono(i) {
  return `+57 300 000 ${String(2201 + i).padStart(4, "0")}`;
}

// Día (AAAA-MM-DD) que queda "dias" antes de "fecha".
function restarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function haceUnAnio(fecha) {
  const [anio, resto] = [Number(fecha.slice(0, 4)), fecha.slice(4)];
  return `${anio - 1}${resto}`;
}

export async function sembrarDatosEjemplo(pool, rutaDatos, registro = console) {
  const { rows } = await pool.query("SELECT count(*) AS total FROM categoria");
  if (rows[0].total > 0) {
    registro.info?.("La base ya tiene datos: no se siembran los de ejemplo.");
    return false;
  }
  const datos = JSON.parse(await readFile(rutaDatos, "utf8"));
  const productosPorId = new Map(datos.productos.map((producto) => [producto.id, producto]));

  await enTransaccion(pool, async (db) => {
    for (const c of datos.categorias) {
      await db.query(
        "INSERT INTO categoria (id, nombre, descripcion, creado_en, actualizado_en) VALUES ($1, $2, $3, $4, $5)",
        [c.id, c.nombre, c.descripcion, c.creado_en, c.actualizado_en],
      );
    }
    for (const p of datos.proveedores) {
      await db.query(
        `INSERT INTO proveedor (id, nombre, telefono, municipio, suministra, dias_entrega, activo, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.id, p.nombre, p.telefono, p.municipio, p.suministra, p.dias_entrega, p.activo, p.creado_en, p.actualizado_en],
      );
    }
    for (const p of datos.productos) {
      await db.query(
        `INSERT INTO producto (id, categoria_id, proveedor_id, nombre, nombre_cientifico, descripcion, presentacion,
           precio, stock, stock_minimo, luz, riego, cuidado, imagen_url, visible_en_catalogo, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [p.id, p.categoria_id, p.proveedor_id, p.nombre, p.nombre_cientifico, p.descripcion, p.presentacion,
          p.precio, p.stock, p.stock_minimo, p.luz, p.riego, p.cuidado, p.imagen_url, p.visible_en_catalogo,
          p.creado_en, p.actualizado_en],
      );
    }
    for (const t of datos.temporadas) {
      await db.query(
        "INSERT INTO temporada (id, nombre, fecha, dias_anticipacion, creado_en, actualizado_en) VALUES ($1, $2, $3, $4, $5, $6)",
        [t.id, t.nombre, t.fecha, t.dias_anticipacion, t.creado_en, t.actualizado_en],
      );
    }

    // Pedidos entregados el año pasado, repartidos en la ventana de cada temporada.
    // El precio de entonces era un 10 % menor: cada línea guarda su propio precio.
    const temporadas = new Map(datos.temporadas.map((t) => [t.nombre, t]));
    let cliente = 0;
    for (const [nombreTemporada, productoId, unidades, cantidadPedidos] of VENTAS_ANIO_PASADO) {
      const temporada = temporadas.get(nombreTemporada);
      const producto = productosPorId.get(productoId);
      if (!temporada || !producto) throw new Error(`Semilla inválida: ${nombreTemporada} / ${productoId}`);
      const fin = haceUnAnio(temporada.fecha);
      const precio = Math.round((producto.precio * 0.9) / 100) * 100;
      for (let i = 0; i < cantidadPedidos; i++) {
        const cantidad = Math.floor(unidades / cantidadPedidos) + (i < unidades % cantidadPedidos ? 1 : 0);
        const dia = restarDias(fin, Math.floor((i * temporada.dias_anticipacion) / cantidadPedidos));
        const creado = `${dia}T${String(9 + (i % 8)).padStart(2, "0")}:15:00-05:00`;
        const { rows: pedido } = await db.query(
          `INSERT INTO pedido (cliente_nombre, cliente_telefono, canal, estado, total, creado_en, actualizado_en)
           VALUES ($1, $2, $3, 'entregado', $4, $5, $5) RETURNING id`,
          [NOMBRES[cliente % NOMBRES.length], telefono(cliente % 40), i % 3 === 0 ? "tienda" : "whatsapp", precio * cantidad, creado],
        );
        await db.query(
          `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, creado_en, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [pedido[0].id, productoId, cantidad, precio, creado],
        );
        cliente++;
      }
    }

    // Tres pedidos de esta temporada en distintos estados, para el panel. Ya están
    // descontados del stock del archivo de ejemplo.
    const recientes = [
      { id: "fdec65fe-7212-4737-b222-d7283ab5a383", nombre: "Luz Marina Pérez", tel: "+57 300 000 2201", estado: "pendiente",
        entrega: "2026-10-31", nota: "Arreglo para llevar al cementerio el 1 de noviembre. Recoge en el vivero.",
        creado: "2026-09-29T10:12:00-05:00", lineas: [["3da94211-90a8-48a3-b787-059be5559766", 6], ["d1d37c83-b213-4a63-80f9-1ecf63628ff7", 2]] },
      { id: null, nombre: "Orlando Chaparro", tel: "+57 300 000 2208", estado: "confirmado", entrega: "2026-10-20",
        nota: "Para la finca en Aguazul.", creado: "2026-10-06T15:40:00-05:00",
        lineas: [["178d1501-3f49-496b-b907-7d6a94fc0f4a", 2], ["5ec490ff-1d67-4adb-bf67-a2f07025e6b3", 3]] },
      { id: null, nombre: "Gladys Moreno", tel: "+57 300 000 2211", estado: "entregado", entrega: null, nota: null,
        creado: "2026-10-09T11:05:00-05:00", lineas: [["43562f72-bf9b-4438-bf98-f1bb8c9e51d5", 1]] },
    ];
    for (const r of recientes) {
      const lineas = r.lineas;
      for (const [productoId] of lineas) {
        if (!productosPorId.has(productoId)) throw new Error(`Semilla inválida: producto ${productoId}`);
      }
      const total = lineas.reduce((suma, [productoId, cantidad]) => suma + productosPorId.get(productoId).precio * cantidad, 0);
      const { rows: pedido } = await db.query(
        `INSERT INTO pedido (id, cliente_nombre, cliente_telefono, estado, fecha_entrega, nota, total, creado_en, actualizado_en)
         VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
        [r.id, r.nombre, r.tel, r.estado, r.entrega, r.nota, total, r.creado],
      );
      for (const [productoId, cantidad] of lineas) {
        await db.query(
          `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, creado_en, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [pedido[0].id, productoId, cantidad, productosPorId.get(productoId).precio, r.creado],
        );
      }
    }
  });

  registro.info?.("Datos de ejemplo sembrados.");
  return true;
}
