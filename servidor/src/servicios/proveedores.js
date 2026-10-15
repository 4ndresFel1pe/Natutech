// Proveedores del vivero. No se borran: se desactivan con activo = false.
import { noEncontrado } from "../errores.js";
import { actualizar, insertar } from "./sql.js";

const COLUMNAS = "id, nombre, telefono, municipio, suministra, dias_entrega, activo, creado_en, actualizado_en";
const EDITABLES = ["nombre", "telefono", "municipio", "suministra", "dias_entrega", "activo"];

export async function listar(db) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM proveedor ORDER BY nombre`);
  return rows;
}

export async function ver(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM proveedor WHERE id = $1`, [id]);
  if (!rows[0]) throw noEncontrado(id);
  return rows[0];
}

export const crear = (db, datos) => insertar(db, "proveedor", datos, EDITABLES, COLUMNAS);

export async function cambiar(db, id, cambios) {
  const proveedor = await actualizar(db, "proveedor", id, cambios, EDITABLES, COLUMNAS);
  if (!proveedor) throw noEncontrado(id);
  return proveedor;
}
