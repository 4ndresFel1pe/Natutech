# Auditoría de dependencias de la API (Entrega 4)

Fecha: 4 de noviembre de 2026, 11:09 p. m. (hora de Colombia). Carpeta: `servidor/`. Herramienta: `npm audit` (npm 10.9), que compara las versiones de `package-lock.json` con la base de avisos de seguridad de GitHub.

```bash
cd servidor
npm audit --omit=dev   # solo las dependencias que van a producción
```

## Antes (versión 0.3.0)

```
fast-uri  3.0.0 - 3.1.8 || 4.0.0 - 4.2.2
Severity: moderate
fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding - https://github.com/advisories/GHSA-w74x-v6f9-j3xg
fast-uri vulnerable to improper path equivalence in relative reference normalization - https://github.com/advisories/GHSA-xhq7-xmqj-769h
fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization - https://github.com/advisories/GHSA-wjr9-j795-jxcr
fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references - https://github.com/advisories/GHSA-333x-w4r6-6crp
fix available via `npm audit fix`
node_modules/@fastify/ajv-compiler/node_modules/fast-uri
node_modules/fast-json-stringify/node_modules/fast-uri
node_modules/fast-uri
1 moderate severity vulnerability
```

`fast-uri` no la instala el proyecto directamente: llega con `fastify` y `ajv`, que la usan para interpretar direcciones (URI) en la validación de esquemas.

## Corrección

```bash
npm audit fix
```

Solo cambió `package-lock.json`: `fast-uri` pasó de 3.1.8 a 3.1.9 y de 4.2.2 a 4.2.3, versiones de corrección dentro del mismo rango que piden `fastify` y `ajv`. No se cambió ninguna dependencia directa de `package.json`. Las pruebas de la API pasan igual después del cambio (61 de 61, con `TZ=UTC` y con `TZ=America/Bogota`).

## Después (versión 0.4.0)

```
found 0 vulnerabilities
```

El resultado es el mismo con `npm audit` sin `--omit=dev`: el proyecto no tiene dependencias de desarrollo.
