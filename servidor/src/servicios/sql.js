// Ayudas para armar INSERT y UPDATE con solo los campos que llegaron.
// Los nombres de columna vienen siempre de listas fijas del código, nunca del
// usuario; los valores van como parámetros ($1, $2...), sin concatenar texto.

export async function insertar(db, tabla, datos, columnasPermitidas, retorno) {
  const columnas = columnasPermitidas.filter((columna) => datos[columna] !== undefined);
  const valores = columnas.map((columna) => datos[columna]);
  const marcas = columnas.map((_, i) => `$${i + 1}`);
  const { rows } = await db.query(
    `INSERT INTO ${tabla} (${columnas.join(", ")}) VALUES (${marcas.join(", ")}) RETURNING ${retorno}`,
    valores,
  );
  return rows[0];
}

export async function actualizar(db, tabla, id, cambios, columnasPermitidas, retorno) {
  const columnas = columnasPermitidas.filter((columna) => cambios[columna] !== undefined);
  const valores = columnas.map((columna) => cambios[columna]);
  const asignaciones = columnas.map((columna, i) => `${columna} = $${i + 2}`);
  const { rows } = await db.query(
    `UPDATE ${tabla} SET ${asignaciones.join(", ")} WHERE id = $1 RETURNING ${retorno}`,
    [id, ...valores],
  );
  return rows[0] ?? null;
}

export function paginacion(pagina = 1, porPagina = 20) {
  return { limite: porPagina, desplazamiento: (pagina - 1) * porPagina };
}

// ¿Este error de PostgreSQL es la violación del índice único indicado?
export function esUnicoRepetido(error, indice) {
  return error?.code === "23505" && error.constraint === indice;
}
