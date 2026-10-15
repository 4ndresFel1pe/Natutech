// Un solo formato de error para toda la API: el esquema Error del contrato,
// { codigo, mensaje, detalles? }. Ninguna respuesta lleva trazas internas.

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const solicitudInvalida = (mensaje, detalles) => new ErrorApi(400, "SOLICITUD_INVALIDA", mensaje, detalles);
export const noAutenticado = (mensaje = "Inicie sesión para usar esta operación.") =>
  new ErrorApi(401, "NO_AUTENTICADO", mensaje);
export const sinPermiso = () =>
  new ErrorApi(403, "SIN_PERMISO", "Esta operación solo la puede hacer un administrador.");
export const noEncontrado = (id) =>
  new ErrorApi(404, "NO_ENCONTRADO", `No existe un registro con el identificador ${id}.`);
export const conflicto = (mensaje, detalles) => new ErrorApi(409, "CONFLICTO", mensaje, detalles);
export const validacionFallida = (mensaje, detalles) =>
  new ErrorApi(422, "VALIDACION_FALLIDA", mensaje, detalles);

function cuerpo(error) {
  const respuesta = { codigo: error.codigo, mensaje: error.message };
  if (error.detalles?.length) respuesta.detalles = error.detalles;
  return respuesta;
}

// Traducción mínima de los errores de validación; contrato.js trae una completa en español.
const traduccionBasica = (errores) =>
  errores.map((error) => ({ campo: error.instancePath.replace(/^\//, "") || "cuerpo", problema: error.message }));

// Traduce cualquier error a la forma del contrato. traducirValidacion viene del
// módulo del contrato (validación con los esquemas de api/openapi.yaml).
export function manejarErrores(app, traducirValidacion = traduccionBasica) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ErrorApi) {
      return reply.code(error.estado).send(cuerpo(error));
    }

    // Errores de validación de Fastify: el cuerpo mal formado en sus valores es 422;
    // un parámetro de ruta o de consulta con el tipo equivocado es 400.
    if (error.validation) {
      const detalles = traducirValidacion(error.validation, error.validationContext);
      if (error.validationContext === "body") {
        return reply.code(422).send(cuerpo(validacionFallida("Revise los campos marcados.", detalles)));
      }
      const primero = detalles[0];
      const mensaje = primero
        ? `El parámetro «${primero.campo}» ${primero.problema}.`
        : "Algún parámetro de la petición no es válido.";
      return reply.code(400).send(cuerpo(solicitudInvalida(mensaje, detalles)));
    }

    // JSON que no se puede leer, cuerpo vacío o tipo de contenido equivocado.
    if (error.code?.startsWith("FST_ERR_CTP") || error instanceof SyntaxError) {
      const mensaje =
        error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE"
          ? "Envíe el cuerpo como application/json."
          : error.code === "FST_ERR_CTP_BODY_TOO_LARGE"
            ? "El cuerpo de la petición es demasiado grande."
            : "El cuerpo de la petición no es un JSON válido.";
      return reply.code(400).send(cuerpo(solicitudInvalida(mensaje)));
    }

    // Reglas que la base de datos protege por su cuenta.
    if (error.code === "23505") {
      return reply.code(409).send(cuerpo(conflicto("Ya existe un registro con esos datos.")));
    }
    if (error.code === "23503" || error.code === "23514") {
      return reply
        .code(422)
        .send(cuerpo(validacionFallida("Algún valor no cumple las reglas de la base de datos.")));
    }

    request.log.error({ err: error }, "error no controlado");
    return reply
      .code(500)
      .send({ codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado. Intente de nuevo en un momento." });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      codigo: "NO_ENCONTRADO",
      mensaje: `No existe la ruta ${request.method} ${request.url.split("?")[0]}.`,
    });
  });
}
