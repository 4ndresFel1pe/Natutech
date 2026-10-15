# Imagen de la API de Natutech.
# Se construye desde la raíz del repositorio (docker compose lo hace solo), porque
# además del servidor necesita el contrato (api/openapi.yaml) y los datos de ejemplo
# (web/datos/ejemplo.json).
#
# Dos etapas:
#   1. "dependencias": instala con npm exactamente lo que dice package-lock.json.
#   2. "final": solo Node.js, las dependencias de producción y el código. No lleva
#      la caché de npm, ni las pruebas, ni ningún archivo .env (ver .dockerignore).

# ---- Etapa 1: dependencias ----
FROM node:22-alpine AS dependencias
WORKDIR /app
COPY servidor/package.json servidor/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Etapa 2: imagen final ----
FROM node:22-alpine AS final
ENV NODE_ENV=production \
    PUERTO=3000 \
    CONTRATO_RUTA=/app/contrato/openapi.yaml \
    DATOS_EJEMPLO_RUTA=/app/datos/ejemplo.json
WORKDIR /app

COPY --from=dependencias /app/node_modules ./node_modules
COPY servidor/package.json ./
COPY servidor/src ./src
COPY servidor/db ./db
COPY servidor/scripts ./scripts
COPY api/openapi.yaml ./contrato/openapi.yaml
COPY web/datos/ejemplo.json ./datos/ejemplo.json

# El proceso no corre como root: usa el usuario "node" que trae la imagen oficial.
USER node
EXPOSE 3000

# Docker marca el contenedor como "healthy" cuando GET /salud responde 200,
# es decir, cuando la API ya está conectada a la base de datos.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/salud > /dev/null || exit 1

CMD ["node", "src/servidor.js"]
