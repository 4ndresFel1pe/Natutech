// Arma la aplicación Fastify. No abre puertos ni se conecta a nada por su cuenta:
// recibe la configuración y la base de datos, así las pruebas la pueden usar igual.
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { manejarErrores } from "./errores.js";
import rutasSalud from "./rutas/salud.js";

export async function construirApp({ config, db, contratoDoc, registro = true }) {
  const app = Fastify({
    // El token nunca queda en los registros.
    logger: registro ? { level: "info", redact: ["req.headers.authorization"] } : false,
    trustProxy: true, // detrás de nginx, para registrar la IP real
  });

  manejarErrores(app);

  await app.register(helmet);
  await app.register(cors, {
    origin: config.origenesPermitidos,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    exposedHeaders: ["Location"],
  });

  const opciones = { db, version: contratoDoc.info.version };
  await app.register(rutasSalud, opciones);
  return app;
}
