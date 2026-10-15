// Autenticación con JWT (decisión D11). El token se firma con JWT_SECRETO, que
// solo vive en el .env o en las variables del contenedor, y dura JWT_EXPIRA_EN.
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { noAutenticado, sinPermiso } from "../errores.js";

async function autenticacion(app, { secreto, expiraEn }) {
  await app.register(jwt, { secret: secreto, sign: { expiresIn: expiraEn } });

  // preHandler para las rutas del panel: sin token válido, 401.
  app.decorate("autenticar", async (request) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      if (error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
        throw noAutenticado("Su sesión venció. Inicie sesión de nuevo.");
      }
      throw noAutenticado();
    }
  });

  // preHandler adicional para lo que solo puede hacer el administrador: 403.
  app.decorate("soloAdministrador", async (request) => {
    if (request.user?.rol !== "administrador") throw sinPermiso();
  });
}

export default fp(autenticacion, { name: "autenticacion" });
