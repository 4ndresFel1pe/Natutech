// npm run crear-usuario -- --nombre "Ana" --correo ana@vivero.test --rol empleado
// La contraseña se pide por la variable NUEVA_CONTRASENA para que no quede en el
// historial de la terminal ni en ningún archivo:
//   NUEVA_CONTRASENA='una-clave-larga' npm run crear-usuario -- --nombre ... --correo ...
import { parseArgs } from "node:util";
import { crearPool } from "../src/db.js";
import { crearUsuario } from "../src/servicios/usuarios.js";

const { values } = parseArgs({
  options: {
    nombre: { type: "string" },
    correo: { type: "string" },
    rol: { type: "string", default: "empleado" },
  },
});

const contrasena = process.env.NUEVA_CONTRASENA;
if (!values.nombre || !values.correo || !contrasena) {
  console.error('Uso: NUEVA_CONTRASENA=... npm run crear-usuario -- --nombre "Nombre" --correo correo@vivero.test [--rol administrador|empleado]');
  process.exit(1);
}
if (!["administrador", "empleado"].includes(values.rol)) {
  console.error("El rol debe ser administrador o empleado.");
  process.exit(1);
}

const db = crearPool(process.env.DATABASE_URL);
try {
  const usuario = await crearUsuario(db, { nombre: values.nombre, correo: values.correo, contrasena, rol: values.rol });
  console.log(`Usuario creado: ${usuario.correo} (${usuario.rol})`);
} catch (error) {
  console.error(error.code === "23505" ? "Ya existe un usuario con ese correo." : error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
