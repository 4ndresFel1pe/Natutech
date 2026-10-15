// Configuración leída del entorno. Nada de credenciales escritas en el código:
// los valores reales viven en el archivo .env (que no se versiona) o en las
// variables del contenedor. Si falta algo obligatorio, el servidor no arranca.
import { fileURLToPath } from "node:url";
import path from "node:path";

const aqui = path.dirname(fileURLToPath(import.meta.url));

function obligatoria(nombre) {
  const valor = process.env[nombre];
  if (!valor || !valor.trim()) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revise el archivo .env (copie .env.example).`);
  }
  return valor.trim();
}

function entero(nombre, porDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === "") return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`La variable ${nombre} debe ser un número entero positivo y vale «${valor}».`);
  }
  return numero;
}

export function leerConfiguracion() {
  const jwtSecreto = obligatoria("JWT_SECRETO");
  if (jwtSecreto.length < 32) {
    throw new Error("JWT_SECRETO debe tener al menos 32 caracteres. Genere uno con: openssl rand -hex 32");
  }

  return {
    puerto: entero("PUERTO", 3000),
    baseDeDatos: obligatoria("DATABASE_URL"),
    jwtSecreto,
    jwtExpiraEn: process.env.JWT_EXPIRA_EN?.trim() || "8h",
    origenesPermitidos: (process.env.CORS_ORIGENES || "http://localhost:8080,http://127.0.0.1:8080")
      .split(",")
      .map((origen) => origen.trim())
      .filter(Boolean),
    // Ruta del contrato: en el repositorio está en ../api; en la imagen Docker se copia a /app/contrato.
    contrato: process.env.CONTRATO_RUTA || path.resolve(aqui, "../../api/openapi.yaml"),
    datosEjemplo: process.env.DATOS_EJEMPLO_RUTA || path.resolve(aqui, "../../web/datos/ejemplo.json"),
    sembrarDatosEjemplo: (process.env.SEMBRAR_DATOS_EJEMPLO || "no").toLowerCase() === "si",
    // Cada cuántas horas se recalculan las alertas de reabastecimiento.
    horasEntreAlertas: entero("HORAS_ENTRE_ALERTAS", 6),
    administradorInicial: {
      nombre: process.env.ADMIN_NOMBRE?.trim() || "Administración del vivero",
      correo: process.env.ADMIN_CORREO?.trim() || "",
      contrasena: process.env.ADMIN_CONTRASENA || "",
    },
  };
}
