// Fechas de alta demanda (Día de la Madre, Amor y Amistad, Difuntos, Navidad).
import { conflicto, noEncontrado } from "../errores.js";
import { actualizar, esUnicoRepetido, insertar } from "./sql.js";

const COLUMNAS = "id, nombre, fecha, dias_anticipacion, creado_en, actualizado_en";
const EDITABLES = ["nombre", "fecha", "dias_anticipacion"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaEnPalabras = (fecha) => {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
};

const repetida = ({ nombre, fecha }) =>
  conflicto(`${nombre} del ${fechaEnPalabras(fecha)} ya está registrado.`, [
    { campo: "fecha", problema: "ya existe una temporada con ese nombre y esa fecha" },
  ]);

export async function listar(db) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM temporada ORDER BY fecha`);
  return rows;
}

export async function ver(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM temporada WHERE id = $1`, [id]);
  if (!rows[0]) throw noEncontrado(id);
  return rows[0];
}

export async function crear(db, datos) {
  try {
    return await insertar(db, "temporada", datos, EDITABLES, COLUMNAS);
  } catch (error) {
    if (esUnicoRepetido(error, "uq_temporada")) throw repetida(datos);
    throw error;
  }
}

export async function cambiar(db, id, cambios) {
  const actual = await ver(db, id);
  try {
    return await actualizar(db, "temporada", id, cambios, EDITABLES, COLUMNAS);
  } catch (error) {
    if (esUnicoRepetido(error, "uq_temporada")) throw repetida({ ...actual, ...cambios });
    throw error;
  }
}

export async function eliminar(db, id) {
  const { rowCount } = await db.query("DELETE FROM temporada WHERE id = $1", [id]);
  if (!rowCount) throw noEncontrado(id);
}
