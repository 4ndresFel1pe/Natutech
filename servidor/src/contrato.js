// La validación sale del contrato, no de esquemas escritos a mano: cada ruta pide
// los esquemas de su operación (operationId) en api/openapi.yaml. Si el contrato
// cambia, la validación cambia con él (decisión D10).
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const ID = "contrato";

export function cargarContrato(ruta) {
  return parse(readFileSync(ruta, "utf8"));
}

function nuevoAjv(opciones) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateSchema: false, ...opciones });
  addFormats(ajv);
  return ajv;
}

function resolver(doc, nodo) {
  if (!nodo?.$ref) return nodo;
  const partes = nodo.$ref.replace(/^#\//, "").split("/");
  return partes.reduce((actual, parte) => actual[parte.replace(/~1/g, "/").replace(/~0/g, "~")], doc);
}

// Copia un esquema del contrato cambiando sus $ref locales ("#/components/...")
// por referencias al documento registrado en Ajv ("contrato#/components/...").
function anclar(esquema) {
  if (Array.isArray(esquema)) return esquema.map(anclar);
  if (!esquema || typeof esquema !== "object") return esquema;
  return Object.fromEntries(
    Object.entries(esquema).map(([clave, valor]) =>
      clave === "$ref" && typeof valor === "string" && valor.startsWith("#/") ? [clave, `${ID}${valor}`] : [clave, anclar(valor)],
    ),
  );
}

function buscarOperacion(doc, operationId) {
  for (const [ruta, item] of Object.entries(doc.paths)) {
    for (const metodo of ["get", "post", "put", "patch", "delete"]) {
      if (item[metodo]?.operationId === operationId) return { ruta, item, metodo, operacion: item[metodo] };
    }
  }
  throw new Error(`El contrato no tiene la operación «${operationId}».`);
}

export function crearContrato(doc) {
  // Cuerpos: sin conversión de tipos (un "12" no es un número). Parámetros de ruta y
  // de consulta: llegan como texto, así que sí se convierten ("2" → 2, "true" → true).
  const ajvCuerpo = nuevoAjv({});
  const ajvParametros = nuevoAjv({ coerceTypes: true, useDefaults: true });
  const ajvRespuesta = nuevoAjv({});
  for (const ajv of [ajvCuerpo, ajvParametros, ajvRespuesta]) ajv.addSchema(doc, ID);

  // Esquemas de Fastify (params, querystring, body) para una operación del contrato.
  function esquemas(operationId) {
    const { item, operacion } = buscarOperacion(doc, operationId);
    const parametros = [...(item.parameters || []), ...(operacion.parameters || [])].map((p) => resolver(doc, p));
    const resultado = {};
    for (const [lugar, clave] of [["path", "params"], ["query", "querystring"]]) {
      const propios = parametros.filter((p) => p.in === lugar);
      if (!propios.length) continue;
      resultado[clave] = {
        type: "object",
        properties: Object.fromEntries(propios.map((p) => [p.name, anclar(p.schema)])),
        required: propios.filter((p) => p.required).map((p) => p.name),
      };
    }
    const cuerpo = operacion.requestBody?.content?.["application/json"]?.schema;
    if (cuerpo) resultado.body = anclar(cuerpo);
    return resultado;
  }

  // Compilador que Fastify usa para cada parte de la petición.
  function compilador({ schema, httpPart }) {
    return (httpPart === "body" ? ajvCuerpo : ajvParametros).compile(schema);
  }

  // Para las pruebas: ¿esta respuesta cumple el esquema que el contrato declara?
  function validarRespuesta(operationId, estado, cuerpoRespuesta) {
    const { operacion } = buscarOperacion(doc, operationId);
    const respuesta = resolver(doc, operacion.responses[String(estado)]);
    if (!respuesta) return [`el contrato no declara la respuesta ${estado} para ${operationId}`];
    const esquema = respuesta.content?.["application/json"]?.schema;
    if (!esquema) return cuerpoRespuesta ? [`la respuesta ${estado} no debería tener cuerpo`] : null;
    const validar = ajvRespuesta.compile(anclar(esquema));
    return validar(cuerpoRespuesta) ? null : validar.errors;
  }

  return { doc, version: doc.info.version, esquemas, compilador, validarRespuesta };
}

// ---- Traducción de los errores de Ajv a { campo, problema } en español ----

function nombreCampo(error) {
  const ruta = error.instancePath
    .split("/")
    .filter(Boolean)
    .map((parte) => (/^\d+$/.test(parte) ? `[${parte}]` : `.${parte}`))
    .join("")
    .replace(/^\./, "");
  const hijo = error.params?.missingProperty || error.params?.additionalProperty || error.params?.unevaluatedProperty;
  if (hijo) return ruta ? `${ruta}.${hijo}` : hijo;
  return ruta || "cuerpo";
}

const FORMATOS = {
  uuid: "debe ser un identificador UUID",
  date: "debe ser una fecha con el formato AAAA-MM-DD",
  "date-time": "debe ser una fecha y hora ISO 8601",
  email: "debe ser un correo electrónico válido",
  "uri-reference": "debe ser una ruta o una URL válida",
};

const TIPOS = { integer: "un número entero", number: "un número", string: "texto", boolean: "verdadero o falso", object: "un objeto", array: "una lista", null: "nulo" };

function problema(error) {
  const p = error.params || {};
  switch (error.keyword) {
    case "required":
      return "es obligatorio";
    case "additionalProperties":
    case "unevaluatedProperties":
      return "no es un campo permitido";
    case "type": {
      const tipos = [].concat(p.type).map((t) => TIPOS[t] || t);
      return `debe ser ${tipos.join(" o ")}`;
    }
    case "minimum":
      return `debe ser mayor o igual a ${p.limit}`;
    case "maximum":
      return `debe ser menor o igual a ${p.limit}`;
    case "minLength":
      return p.limit === 1 ? "no puede estar vacío" : `debe tener al menos ${p.limit} caracteres`;
    case "maxLength":
      return `debe tener como máximo ${p.limit} caracteres`;
    case "minItems":
      return `debe tener al menos ${p.limit} elemento${p.limit === 1 ? "" : "s"}`;
    case "maxItems":
      return `debe tener como máximo ${p.limit} elementos`;
    case "minProperties":
      return "envíe al menos un campo para cambiar";
    case "enum":
      return `debe ser uno de: ${p.allowedValues.filter((v) => v !== null).join(", ")}`;
    case "format":
      return FORMATOS[p.format] || `no tiene el formato ${p.format}`;
    case "pattern":
      return p.pattern.includes("+57") ? "debe tener el formato +57 300 000 0000" : "no tiene el formato esperado";
    case "not":
      return "no puede tener ese valor";
    default:
      return "no cumple las reglas";
  }
}

export function traducirValidacion(errores) {
  const vistos = new Set();
  const detalles = [];
  for (const error of errores) {
    // Los errores de los esquemas compuestos (allOf, anyOf) repiten a los de sus partes.
    if (["allOf", "anyOf", "oneOf", "if", "then", "else"].includes(error.keyword)) continue;
    const detalle = { campo: nombreCampo(error), problema: problema(error) };
    const clave = `${detalle.campo}|${detalle.problema}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      detalles.push(detalle);
    }
  }
  return detalles;
}
