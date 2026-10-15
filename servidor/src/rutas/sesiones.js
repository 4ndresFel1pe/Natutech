// POST /sesiones: inicia sesión y entrega un token JWT.
import { noAutenticado } from "../errores.js";
import { fechaHoraColombia } from "../formato.js";
import { verificarCredenciales } from "../servicios/usuarios.js";

export default async function rutasSesiones(app, { db, contrato }) {
  app.post("/sesiones", { schema: contrato.esquemas("iniciarSesion") }, async (request, reply) => {
    const { correo, contrasena } = request.body;
    const usuario = await verificarCredenciales(db, correo, contrasena);
    // Mismo mensaje si falla el correo o la contraseña: no se dice cuál de los dos.
    if (!usuario) throw noAutenticado("El correo o la contraseña no coinciden.");

    const token = app.jwt.sign({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    const { exp } = app.jwt.decode(token);
    reply.code(201);
    return { token, expira_en: fechaHoraColombia(new Date(exp * 1000)), usuario };
  });
}
