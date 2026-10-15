// Catálogo público: lo ve cualquier cliente, sin iniciar sesión.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { IDS, prepararEntorno } from "./apoyo.js";

let entorno;
before(async () => {
  entorno = await prepararEntorno();
});
after(() => entorno.cerrar());

const nombres = (pagina) => pagina.datos.map((p) => p.nombre);

test("lista el catálogo paginado y ordenado por nombre", async () => {
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?por_pagina=2&pagina=2" }, 200);
  assert.deepEqual(cuerpo.paginacion, { pagina: 2, por_pagina: 2, total: 19 });
  assert.deepEqual(nombres(cuerpo), ["Crisantemo amarillo en matera", "Croto"]);
});

test("el catálogo no expone datos internos del vivero", async () => {
  const { cuerpo } = await entorno.llamar("verProductoCatalogo", { url: `/catalogo/productos/${IDS.anturio}` }, 200);
  for (const campo of ["proveedor_id", "stock_minimo", "visible_en_catalogo", "creado_en"]) {
    assert.equal(campo in cuerpo, false, `el catálogo público no debe mostrar ${campo}`);
  }
});

test("la búsqueda no distingue tildes ni mayúsculas", async () => {
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?q=ORQUIDEA" }, 200);
  assert.deepEqual(nombres(cuerpo), ["Orquídea Cattleya"]);
});

test("filtra por luz y por disponibilidad", async () => {
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?luz=media&solo_disponibles=true" }, 200);
  assert.ok(cuerpo.datos.length > 0);
  assert.ok(cuerpo.datos.every((p) => p.luz === "media" && p.stock > 0));
  assert.equal(nombres(cuerpo).includes("Orquídea Cattleya"), false, "la orquídea está agotada");
});

test("filtra por categoría", async () => {
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: `/catalogo/productos?categoria_id=${IDS.interior}` }, 200);
  assert.ok(cuerpo.datos.length > 0);
  assert.ok(cuerpo.datos.every((p) => p.categoria_id === IDS.interior));
});

test("un parámetro mal escrito responde 400 con el campo y el problema", async () => {
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?luz=muchisima" }, 400);
  assert.equal(cuerpo.codigo, "SOLICITUD_INVALIDA");
  assert.deepEqual(cuerpo.detalles, [{ campo: "luz", problema: "debe ser uno de: baja, media, alta" }]);
  await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?por_pagina=500" }, 400);
  await entorno.llamar("verProductoCatalogo", { url: "/catalogo/productos/no-es-un-uuid" }, 400);
});

test("un producto que no existe responde 404", async () => {
  const { cuerpo } = await entorno.llamar("verProductoCatalogo", { url: `/catalogo/productos/${IDS.inexistente}` }, 404);
  assert.equal(cuerpo.codigo, "NO_ENCONTRADO");
});

test("un producto oculto no aparece en el catálogo", async () => {
  await entorno.llamar(
    "actualizarProducto",
    { metodo: "PATCH", url: `/productos/${IDS.cactus}`, cuerpo: { visible_en_catalogo: false }, token: entorno.tokenEmpleado },
    200,
  );
  await entorno.llamar("verProductoCatalogo", { url: `/catalogo/productos/${IDS.cactus}` }, 404);
  const { cuerpo } = await entorno.llamar("listarCatalogo", { url: "/catalogo/productos?q=cactus" }, 200);
  assert.equal(cuerpo.paginacion.total, 0);
});

test("categorías y temporadas son públicas", async () => {
  const categorias = await entorno.llamar("listarCategorias", { url: "/categorias" }, 200);
  assert.ok(categorias.cuerpo.length >= 7);
  const temporadas = await entorno.llamar("listarTemporadas", { url: "/temporadas" }, 200);
  const fechas = temporadas.cuerpo.map((t) => t.fecha);
  assert.deepEqual(fechas, [...fechas].sort(), "las temporadas vienen ordenadas por fecha");
  const { cuerpo } = await entorno.llamar("verTemporada", { url: `/temporadas/${IDS.difuntos}` }, 200);
  assert.equal(cuerpo.fecha, "2026-11-02");
});
