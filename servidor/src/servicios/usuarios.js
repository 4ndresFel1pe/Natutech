// Usuarios del panel. La contraseña nunca se guarda: solo su hash bcrypt.
import bcrypt from "bcryptjs";

const COSTO_BCRYPT = 12;
const COLUMNAS = "id, nombre, correo, rol, activo, creado_en, actualizado_en";
// Hash de relleno: si el correo no existe se compara igual, para que la respuesta
// tarde lo mismo y no delate qué correos están registrados.
const HASH_DE_RELLENO = "$2b$12$OlehFPfPGh2AOMJhrmznBuIOGSoMLpJ9IYuRNvWPKtngKse28QGKC";

export async function crearUsuario(db, { nombre, correo, contrasena, rol = "empleado" }) {
  if (!contrasena || contrasena.length < 8 || contrasena.length > 72) {
    throw new Error("La contraseña debe tener entre 8 y 72 caracteres.");
  }
  const hash = await bcrypt.hash(contrasena, COSTO_BCRYPT);
  const { rows } = await db.query(
    `INSERT INTO usuario (nombre, correo, contrasena_hash, rol) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
    [nombre, correo.trim().toLowerCase(), hash, rol],
  );
  return rows[0];
}

// Devuelve el usuario si el correo y la contraseña coinciden y está activo; si no, null.
export async function verificarCredenciales(db, correo, contrasena) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}, contrasena_hash FROM usuario WHERE lower(correo) = lower($1)`,
    [correo],
  );
  const usuario = rows[0];
  const coincide = await bcrypt.compare(contrasena, usuario?.contrasena_hash ?? HASH_DE_RELLENO);
  if (!usuario || !coincide || !usuario.activo) return null;
  delete usuario.contrasena_hash;
  return usuario;
}

// Al arrancar: si no hay ningún usuario y el .env trae ADMIN_CORREO y ADMIN_CONTRASENA,
// crea el administrador inicial. Así nadie escribe contraseñas en el código.
export async function crearAdministradorInicial(db, { nombre, correo, contrasena }, registro = console) {
  const { rows } = await db.query("SELECT count(*) AS total FROM usuario");
  if (rows[0].total > 0) return null;
  if (!correo || !contrasena) {
    registro.warn?.("No hay usuarios. Defina ADMIN_CORREO y ADMIN_CONTRASENA en .env para crear el administrador inicial.");
    return null;
  }
  const usuario = await crearUsuario(db, { nombre, correo, contrasena, rol: "administrador" });
  registro.info?.(`Administrador inicial creado: ${usuario.correo}`);
  return usuario;
}
