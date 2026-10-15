// Arma la aplicación Fastify. No abre puertos ni se conecta a nada por su cuenta:
// recibe la configuración y la base de datos, así las pruebas la pueden usar igual.
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { manejarErrores } from "./errores.js";
import { crearContrato, traducirValidacion } from "./contrato.js";
import autenticacion from "./plugins/autenticacion.js";
import rutasSalud from "./rutas/salud.js";
import rutasSesiones from "./rutas/sesiones.js";
import rutasCatalogo from "./rutas/catalogo.js";
import rutasGestion from "./rutas/gestion.js";

export async function construirApp({ config, db, contratoDoc, registro = true }) {
  const app = Fastify({
    // El token nunca queda en los registros.
    logger: registro ? { level: "info", redact: ["req.headers.authorization"] } : false,
    trustProxy: true, // detrás de nginx, para registrar la IP real
  });

  // Validación con los esquemas del contrato (api/openapi.yaml).
  const contrato = crearContrato(contratoDoc);
  app.decorate("contrato", contrato); // las pruebas lo usan para validar respuestas
  app.setValidatorCompiler(contrato.compilador);
  manejarErrores(app, traducirValidacion);

  await app.register(helmet);
  await app.register(cors, {
    origin: config.origenesPermitidos,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    exposedHeaders: ["Location"],
  });
  await app.register(autenticacion, { secreto: config.jwtSecreto, expiraEn: config.jwtExpiraEn });

  const opciones = { db, contrato, version: contrato.version };
  await app.register(rutasSalud, opciones);
  await app.register(rutasSesiones, opciones);
  await app.register(rutasCatalogo, opciones);
  await app.register(rutasGestion, opciones);
  return app;
}
