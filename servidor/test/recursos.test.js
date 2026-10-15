// CRUD de los recursos de gestión: categorías, productos, proveedores y temporadas.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { IDS, prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

// Atajos: la mayoría de las pruebas trabaja como administrador.
const admin = (operacion, peticion, estado) => entorno.llamar(operacion, { ...peticion, token: entorno.tokenAdmin }, estado);
const campos = (cuerpo) => cuerpo.detalles.map((d) => d.campo).sort();

describe("categorías", () => {
  let id;

  test("crea una categoría y responde 201 con Location", async () => {
    const { cuerpo, cabeceras } = await admin("crearCategoria", { metodo: "POST", url: "/categorias", cuerpo: { nombre: "Bonsáis", descripcion: "Árboles en miniatura" } }, 201);
    id = cuerpo.id;
    assert.equal(cabeceras.location, `/categorias/${id}`);
  });

  test("no repite un nombre aunque cambien las mayúsculas (409)", async () => {
    const { cuerpo } = await admin("crearCategoria", { metodo: "POST", url: "/categorias", cuerpo: { nombre: "BONSÁIS" } }, 409);
    assert.equal(cuerpo.codigo, "CONFLICTO");
  });

  test("rechaza campos que el contrato no define (422)", async () => {
    const { cuerpo } = await admin("crearCategoria", { metodo: "POST", url: "/categorias", cuerpo: { nombre: "Cactus grandes", color: "verde" } }, 422);
    assert.deepEqual(cuerpo.detalles, [{ campo: "color", problema: "no es un campo permitido" }]);
  });

  test("un PATCH vacío no cambia nada y responde 422", async () => {
    await admin("actualizarCategoria", { metodo: "PATCH", url: `/categorias/${id}`, cuerpo: {} }, 422);
  });

  test("cambia solo los campos enviados", async () => {
    const { cuerpo } = await admin("actualizarCategoria", { metodo: "PATCH", url: `/categorias/${id}`, cuerpo: { descripcion: "Árboles pequeños en bandeja" } }, 200);
    assert.equal(cuerpo.nombre, "Bonsáis");
    assert.equal(cuerpo.descripcion, "Árboles pequeños en bandeja");
  });

  test("no elimina una categoría con productos (409)", async () => {
    const { cuerpo } = await admin("eliminarCategoria", { metodo: "DELETE", url: `/categorias/${IDS.interior}` }, 409);
    assert.match(cuerpo.mensaje, /tiene \d+ productos/);
  });

  test("elimina una categoría vacía (204) y luego ya no existe (404)", async () => {
    await admin("eliminarCategoria", { metodo: "DELETE", url: `/categorias/${id}` }, 204);
    await admin("eliminarCategoria", { metodo: "DELETE", url: `/categorias/${id}` }, 404);
  });
});

describe("ajuste de precios por categoría", () => {
  test("sube los precios de la categoría y redondea a la centena", async () => {
    const antes = await admin("listarProductos", { url: `/productos?categoria_id=${IDS.interior}&por_pagina=50` }, 200);
    const { cuerpo } = await admin("ajustarPreciosCategoria", { metodo: "POST", url: `/categorias/${IDS.interior}/ajuste-precios`, cuerpo: { porcentaje: 7 } }, 200);
    assert.equal(cuerpo.productos_actualizados, antes.cuerpo.datos.length);
    const despues = await admin("listarProductos", { url: `/productos?categoria_id=${IDS.interior}&por_pagina=50` }, 200);
    for (const producto of despues.cuerpo.datos) {
      const anterior = antes.cuerpo.datos.find((p) => p.id === producto.id);
      assert.equal(producto.precio, Math.round((anterior.precio * 1.07) / 100) * 100);
    }
  });

  test("rechaza un porcentaje de 0 o fuera del rango", async () => {
    for (const porcentaje of [0, -60, 150, 2.5]) {
      await admin("ajustarPreciosCategoria", { metodo: "POST", url: `/categorias/${IDS.interior}/ajuste-precios`, cuerpo: { porcentaje } }, 422);
    }
  });

  test("una categoría que no existe responde 404", async () => {
    await admin("ajustarPreciosCategoria", { metodo: "POST", url: `/categorias/${IDS.inexistente}/ajuste-precios`, cuerpo: { porcentaje: 5 } }, 404);
  });
});

describe("productos", () => {
  let id;
  const nuevo = {
    nombre: "Bonsái de ficus",
    categoria_id: IDS.interior,
    presentacion: "Bandeja de 20 cm",
    precio: 80000,
    stock: 4,
    stock_minimo: 2,
    luz: "media",
    cuidado: "avanzado",
  };

  test("un empleado crea un producto (201)", async () => {
    const { cuerpo, cabeceras } = await entorno.llamar("crearProducto", { metodo: "POST", url: "/productos", cuerpo: nuevo, token: entorno.tokenEmpleado }, 201);
    id = cuerpo.id;
    assert.equal(cabeceras.location, `/productos/${id}`);
    assert.equal(cuerpo.visible_en_catalogo, true, "el valor por defecto lo pone la base de datos");
  });

  test("no repite un nombre (409) y explica qué hacer", async () => {
    const { cuerpo } = await admin("crearProducto", { metodo: "POST", url: "/productos", cuerpo: { ...nuevo, nombre: "bonsái DE FICUS" } }, 409);
    assert.match(cuerpo.mensaje, /Edite ese producto/);
  });

  test("valida tipos, rangos y obligatorios sin convertir texto a número (422)", async () => {
    const { cuerpo } = await admin("crearProducto", { metodo: "POST", url: "/productos", cuerpo: { nombre: "X", precio: "80000", stock: -1, luz: "toda" } }, 422);
    assert.deepEqual(campos(cuerpo), ["categoria_id", "luz", "nombre", "precio", "presentacion", "stock", "stock_minimo"]);
  });

  test("una categoría o un proveedor que no existen responden 422", async () => {
    const sinCategoria = await admin("crearProducto", { metodo: "POST", url: "/productos", cuerpo: { ...nuevo, nombre: "Otro", categoria_id: IDS.inexistente } }, 422);
    assert.deepEqual(campos(sinCategoria.cuerpo), ["categoria_id"]);
    const sinProveedor = await admin("actualizarProducto", { metodo: "PATCH", url: `/productos/${id}`, cuerpo: { proveedor_id: IDS.inexistente } }, 422);
    assert.deepEqual(campos(sinProveedor.cuerpo), ["proveedor_id"]);
  });

  test("actualiza solo lo enviado y renueva actualizado_en", async () => {
    const antes = await admin("verProducto", { url: `/productos/${id}` }, 200);
    await new Promise((listo) => setTimeout(listo, 1100)); // el formato tiene resolución de segundos
    const { cuerpo } = await admin("actualizarProducto", { metodo: "PATCH", url: `/productos/${id}`, cuerpo: { stock: 9 } }, 200);
    assert.equal(cuerpo.stock, 9);
    assert.equal(cuerpo.precio, nuevo.precio);
    assert.notEqual(cuerpo.actualizado_en, antes.cuerpo.actualizado_en);
  });

  test("el inventario filtra los productos bajo el stock mínimo", async () => {
    const { cuerpo } = await admin("listarProductos", { url: "/productos?bajo_stock=true&por_pagina=50" }, 200);
    assert.ok(cuerpo.datos.length > 0);
    assert.ok(cuerpo.datos.every((p) => p.stock < p.stock_minimo));
  });

  test("no elimina un producto que aparece en pedidos (409)", async () => {
    const { cuerpo } = await admin("eliminarProducto", { metodo: "DELETE", url: `/productos/${IDS.anturio}` }, 409);
    assert.deepEqual(campos(cuerpo), ["visible_en_catalogo"]);
  });

  test("elimina un producto sin pedidos (204)", async () => {
    await admin("eliminarProducto", { metodo: "DELETE", url: `/productos/${id}` }, 204);
    await admin("verProducto", { url: `/productos/${id}` }, 404);
  });
});

describe("proveedores", () => {
  let id;

  test("crea un proveedor y valida el teléfono colombiano", async () => {
    const malo = await admin("crearProveedor", { metodo: "POST", url: "/proveedores", cuerpo: { nombre: "Vivero La Ceiba", telefono: "3001234567", municipio: "Aguazul" } }, 422);
    assert.deepEqual(malo.cuerpo.detalles, [{ campo: "telefono", problema: "debe tener el formato +57 300 000 0000" }]);
    const { cuerpo } = await admin("crearProveedor", { metodo: "POST", url: "/proveedores", cuerpo: { nombre: "Vivero La Ceiba", telefono: "+57 300 000 1111", municipio: "Aguazul" } }, 201);
    id = cuerpo.id;
    assert.equal(cuerpo.dias_entrega, 3, "valor por defecto de la base de datos");
  });

  test("se desactiva en lugar de eliminarse", async () => {
    const { cuerpo } = await admin("actualizarProveedor", { metodo: "PATCH", url: `/proveedores/${id}`, cuerpo: { activo: false } }, 200);
    assert.equal(cuerpo.activo, false);
    await admin("verProveedor", { url: `/proveedores/${id}` }, 200);
    const lista = await admin("listarProveedores", { url: "/proveedores" }, 200);
    assert.ok(lista.cuerpo.some((p) => p.id === id));
  });

  test("un proveedor que no existe responde 404", async () => {
    await admin("verProveedor", { url: `/proveedores/${IDS.inexistente}` }, 404);
  });
});

describe("temporadas", () => {
  let id;

  test("crea una temporada (201)", async () => {
    const { cuerpo } = await admin("crearTemporada", { metodo: "POST", url: "/temporadas", cuerpo: { nombre: "Navidad", fecha: "2026-12-24", dias_anticipacion: 30 } }, 201);
    id = cuerpo.id;
  });

  test("no registra dos veces el mismo nombre en la misma fecha (409)", async () => {
    await admin("crearTemporada", { metodo: "POST", url: "/temporadas", cuerpo: { nombre: "NAVIDAD", fecha: "2026-12-24" } }, 409);
  });

  test("valida la fecha y la anticipación (422)", async () => {
    const { cuerpo } = await admin("crearTemporada", { metodo: "POST", url: "/temporadas", cuerpo: { nombre: "Fin de año", fecha: "31/12/2026", dias_anticipacion: 200 } }, 422);
    assert.deepEqual(campos(cuerpo), ["dias_anticipacion", "fecha"]);
  });

  test("actualiza y elimina una temporada", async () => {
    const { cuerpo } = await admin("actualizarTemporada", { metodo: "PATCH", url: `/temporadas/${id}`, cuerpo: { dias_anticipacion: 20 } }, 200);
    assert.equal(cuerpo.dias_anticipacion, 20);
    await admin("eliminarTemporada", { metodo: "DELETE", url: `/temporadas/${id}` }, 204);
    await entorno.llamar("verTemporada", { url: `/temporadas/${id}` }, 404);
  });
});
