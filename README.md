# Natutech

Catálogo en línea, inventario y alertas de reabastecimiento por temporada para el Vivero Las Acacias, en Yopal (Casanare).

**Prototipo publicado (modo demostración):** https://4ndresfel1pe.github.io/Natutech/
**Documentación de la API:** https://4ndresfel1pe.github.io/Natutech/documentacion-api.html (se genera desde [`api/openapi.yaml`](api/openapi.yaml))
**Modelo de datos:** [`docs/modelo-datos.md`](docs/modelo-datos.md) · **Decisiones:** [`docs/decisiones.md`](docs/decisiones.md)

## El problema

El Vivero Las Acacias lleva nueve años en Yopal y maneja su inventario en Excel, actualizado una vez por semana. Su dueño ha perdido ventas por no saber con exactitud qué tiene en existencia, y el riesgo crece en las fechas de mayor demanda: Día de la Madre, Amor y Amistad y, sobre todo, el Día de los Difuntos (2 de noviembre). En sus palabras, lo más importante es "saber en cualquier momento qué plantas tengo disponibles y cuántas". Ver la [encuesta al vivero](docs/entrevista/formulario/README.md).

## Ruta y equipo

**Ruta A: contenerización y DevOps.** El vivero no tiene personal técnico, así que el peso del proyecto está en que el sistema se pueda desplegar, respaldar y recuperar sin nosotros. La justificación completa está en [`docs/decisiones.md`](docs/decisiones.md#d1-ruta-a-contenerización-y-devops).

**Grupo 4 · Tecnologías Web 2026-B · Unitrópico**

| Integrante | Rol | GitHub |
|---|---|---|
| Brayan David Roa Vega | Líder técnico | [@BrayanRoa87](https://github.com/BrayanRoa87) |
| Andres Felipe Gomez Gutierrez | Backend y datos | [@4ndresFel1pe](https://github.com/4ndresFel1pe) |
| Andres Felipe Abril Lopez | Frontend y experiencia | [@AndresAbril2005](https://github.com/AndresAbril2005) |
| Joan Sebastián Berbesi Burgos | DevOps y calidad | [@joanberbesies-art](https://github.com/joanberbesies-art) |

## Cómo ejecutarlo

### Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | 2.40 o superior | Clonar el repositorio. En Windows, Git Bash trae también `openssl` |
| Docker Desktop (Windows y macOS) o Docker Engine con Compose v2 (Linux) | Docker 24 o superior | Levantar la base de datos, la API y el prototipo |
| Node.js | 22 LTS | Solo para trabajar en la API sin Docker o correr las pruebas |

Compruebe las versiones con `git --version`, `docker --version`, `docker compose version` y `node --version`.

### Todo el sistema con Docker Compose

1. Clone el repositorio y entre a la carpeta:
   ```bash
   git clone https://github.com/4ndresFel1pe/Natutech.git
   cd Natutech
   ```
2. Cree su archivo `.env` a partir del ejemplo. **Nunca lo suba al repositorio** (ya está en `.gitignore`):
   ```bash
   cp .env.example .env
   ```
3. Abra `.env` y llene estos valores:

   | Variable | Qué poner |
   |---|---|
   | `POSTGRES_PASSWORD` | Una contraseña inventada para la base de datos, solo con letras, números y guiones |
   | `JWT_SECRETO` | El resultado de `openssl rand -hex 32` (64 caracteres) |
   | `ADMIN_CORREO` | El correo con el que va a ingresar al panel |
   | `ADMIN_CONTRASENA` | Su contraseña para el panel, de 8 a 72 caracteres |

4. Levante el conjunto (la primera vez descarga las imágenes y tarda unos minutos):
   ```bash
   docker compose up --build
   ```
   Al arrancar, la API aplica las migraciones, carga los datos de ejemplo y crea el administrador. Está listo cuando `docker compose ps` muestra los tres servicios como `healthy`.
5. Abra http://localhost:8080. Para el panel, entre a **Panel del vivero** e ingrese con `ADMIN_CORREO` y `ADMIN_CONTRASENA`.
6. Para detenerlo: `Ctrl + C`, o `docker compose down` si lo levantó con `-d`. Los datos quedan guardados en el volumen `datos_postgres`; `docker compose down -v` los borra y el siguiente arranque vuelve a cargar los datos de ejemplo.

Comprobación rápida desde otra terminal:
```bash
curl http://localhost:8080/api/salud
# {"estado":"ok","base_de_datos":"ok","version":"0.3.0"}
```

**Si sale `port is already allocated`:** otro programa usa ese puerto (por ejemplo, un PostgreSQL instalado en el computador usa el 5432). En `.env`, quite el `#` de `DB_PUERTO_LOCAL=5432` o de `WEB_PUERTO=8080`, cambie el número (por ejemplo, `5433` u `8081`) y vuelva a ejecutar `docker compose up -d`.

### La API sin Docker (para desarrollar)

1. Levante solo la base de datos: `docker compose up -d db` (queda en el puerto 5432 de su computador, solo para él).
2. En `.env`, ponga `DATABASE_URL=postgres://natutech:SU_POSTGRES_PASSWORD@localhost:5432/natutech`.
3. Instale y arranque la API, que se reinicia sola al guardar cambios:
   ```bash
   cd servidor
   npm ci
   npm run dev
   ```
   La API queda en http://localhost:3000 (sin el prefijo `/api`).
4. Corra las pruebas (usan un esquema aparte, `pruebas`, y no tocan sus datos):
   ```bash
   npm test
   ```

Otros comandos: `npm run migrar`, `npm run sembrar` y `NUEVA_CONTRASENA='...' npm run crear-usuario -- --nombre "Ana" --correo ana@vivero.co --rol empleado`.

### Solo el prototipo, sin servidor (modo demostración)

```bash
python -m http.server 8080 --directory web
```

Abra http://localhost:8080. Sin API, el prototipo lee `web/datos/ejemplo.json` y avisa que los cambios no se guardan; así funciona también en GitHub Pages.

### El contrato

```bash
npx @redocly/cli@2 lint api/openapi.yaml           # validarlo
npx @stoplight/prism-cli@5 mock api/openapi.yaml   # servidor simulado en http://127.0.0.1:4010
```

## La API

Base: `http://localhost:8080/api` con Docker Compose. El contrato completo, con ejemplos de cada respuesta, está en [`api/openapi.yaml`](api/openapi.yaml) y en la [documentación navegable](https://4ndresfel1pe.github.io/Natutech/documentacion-api.html).

**Ingresar y usar el token:**
```bash
curl -X POST http://localhost:8080/api/sesiones \
  -H "Content-Type: application/json" \
  -d '{"correo":"su-correo@vivero.co","contrasena":"su-contraseña"}'
# Copie el "token" de la respuesta y envíelo en cada ruta del panel:
curl http://localhost:8080/api/alertas -H "Authorization: Bearer EL_TOKEN"
```

| Recurso | Operaciones | Quién |
|---|---|---|
| Catálogo | `GET /catalogo/productos` (búsqueda sin tildes, filtros, páginas) · `GET /catalogo/productos/{id}` | Público |
| Categorías | `GET /categorias` | Público |
| | `POST` · `PATCH /{id}` · `DELETE /{id}` · `POST /{id}/ajuste-precios` | Administrador |
| Temporadas | `GET /temporadas` · `GET /temporadas/{id}` | Público |
| | `POST` · `PATCH /{id}` | Con sesión |
| | `DELETE /{id}` | Administrador |
| Productos | `GET /productos` · `POST` · `GET /{id}` · `PATCH /{id}` | Con sesión |
| | `DELETE /{id}` (si nunca se ha vendido; si no, se oculta del catálogo) | Administrador |
| Proveedores | `GET` · `POST` · `GET /{id}` · `PATCH /{id}` (se desactivan, no se borran) | Con sesión |
| Pedidos | `GET` (por estado y fechas) · `POST` (descuenta el stock en una transacción) · `GET /{id}` · `PATCH /{id}` (confirmar, entregar, cancelar) | Con sesión |
| Alertas | `GET` (por estado y tipo) · `PATCH /{id}` (atender o descartar) | Con sesión |
| Sesión | `POST /sesiones` | Público |
| Salud | `GET /salud` | Público |

**Errores.** Todos tienen la misma forma:
```json
{ "codigo": "VALIDACION_FALLIDA", "mensaje": "Revise los campos marcados.",
  "detalles": [{ "campo": "precio", "problema": "debe ser un número entero" }] }
```
`400` dirección o JSON mal formado · `401` sin sesión · `403` solo administrador · `404` no existe · `409` nombre repetido o algo que todavía se usa · `422` datos que no cumplen las reglas · `500` error interno. Detalle en [D12](docs/decisiones.md#d12-la-validación-sale-del-contrato).

## Pantallas

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Catálogo público (principal) | [`web/index.html`](web/index.html) | Productos con buscador, filtros por categoría, luz y existencia, cuenta regresiva a la próxima temporada y botón de WhatsApp |
| Detalle del producto | [`web/detalle.html`](web/detalle.html) | Precio, disponibilidad, cuidados y productos de la misma categoría |
| Ingreso | [`web/ingresar.html`](web/ingresar.html) | Inicio de sesión del personal |
| Inventario | [`web/inventario.html`](web/inventario.html) | Resumen de existencias, próxima temporada, alertas de reabastecimiento (se atienden desde aquí) y tabla de productos |
| Formulario de producto | [`web/producto-form.html`](web/producto-form.html) | Crear o editar un producto; muestra en cada campo los errores del navegador y los de la API |
| Pedidos | [`web/pedidos.html`](web/pedidos.html) | Registrar un pedido con varios productos y cambiar su estado; cancelar devuelve las unidades al inventario |

Los estados de carga, vacío y error se ven desde el pie de cada página o agregando `?estado=cargando`, `?estado=vacio` o `?estado=error` a la dirección.

## Pruebas e integración continua

| Flujo | Cuándo corre | Qué revisa |
|---|---|---|
| [`validar-contrato.yml`](.github/workflows/validar-contrato.yml) | Pull request que cambie `api/` | El contrato con Redocly |
| [`pruebas-api.yml`](.github/workflows/pruebas-api.yml) | Pull request que cambie `servidor/`, `api/` o los datos de ejemplo | Las pruebas de la API contra PostgreSQL 16, con `TZ=UTC` y con `TZ=America/Bogota` |
| [`contenedores.yml`](.github/workflows/contenedores.yml) | Pull request que cambie el servidor, el prototipo o los archivos de Docker | Que `docker compose up` levante los tres servicios y la API responda a través de nginx |
| [`pages.yml`](.github/workflows/pages.yml) | Cambios en `main` | Publica el prototipo y la documentación de la API |

## Estado del proyecto

| Entrega | Fecha | Estado | Qué hay |
|---|---|---|---|
| E1 Anteproyecto | 17 sep | Entregada | Problema validado con el vivero, repositorio, wireframes, ruta y plan de trabajo |
| E2 Prototipo y contrato | 1 oct | Entregada (v0.2.0) | Prototipo navegable publicado, contrato OpenAPI 3.1 validado con servidor simulado, modelo de datos y tablero de tareas |
| E3 MVP del backend | 15 oct | **En esta versión (v0.3.0)** | API en Fastify con PostgreSQL: CRUD de productos, categorías, temporadas, proveedores y pedidos; autenticación JWT con roles; validación desde el contrato; alertas automáticas; pruebas en CI; todo levanta con `docker compose up`; prototipo conectado |
| E4 Despliegue contenerizado | 12 nov | Pendiente | Servidor en la nube, CI/CD, HTTPS y dominio propio, respaldos |
| E5 Versión candidata | 26 nov | Pendiente | Funcionalidades congeladas, pruebas, auditorías, respaldo restaurado |
| E6 Sustentación EXIS | 4 dic | Pendiente | |

## Estructura del repositorio

```
Natutech/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example              Nombres de las variables, sin valores reales
├── .dockerignore             Lo único que entra a la imagen de la API
├── docker-compose.yml        Base de datos, API y prototipo
├── .redocly.lint-ignore.yaml Advertencias del contrato aceptadas, con su razón
├── .github/workflows/        Contrato, pruebas, contenedores y publicación (ver arriba)
├── api/
│   └── openapi.yaml          Contrato de la API (OpenAPI 3.1, versión 0.3.0)
├── servidor/                 API en Node.js 22 con Fastify
│   ├── Dockerfile            Imagen de dos etapas, usuario sin privilegios
│   ├── db/migraciones/       Esquema de PostgreSQL en SQL
│   ├── scripts/              migrar, sembrar y crear-usuario
│   ├── src/
│   │   ├── servidor.js       Arranque: base de datos, migraciones, alertas y puerto
│   │   ├── app.js            Arma la aplicación (sin abrir puertos)
│   │   ├── contrato.js       Validación a partir de api/openapi.yaml
│   │   ├── errores.js        Formato único de errores
│   │   ├── plugins/          Autenticación con JWT
│   │   ├── rutas/            Catálogo público, sesiones, gestión y salud
│   │   └── servicios/        Reglas del negocio y consultas SQL por recurso
│   └── test/                 Pruebas contra el contrato
├── infra/nginx/default.conf  Sirve web/ y reenvía /api a la API
├── docs/
│   ├── modelo-datos.md       Entidades, atributos, relaciones e índices
│   ├── modelo-datos.png      Diagrama entidad-relación
│   ├── decisiones.md         Decisiones de arquitectura y su porqué
│   ├── wireframes/           Wireframes de la Entrega 1 y capturas del prototipo
│   ├── entrevista/           Encuesta aplicada al vivero y sus resultados
│   ├── evidencias/           Capturas de Lighthouse, pruebas y recorridos
│   └── Diagrama-Gantt.xlsx   Cronograma del semestre
└── web/
    ├── index.html, detalle.html                     Catálogo público
    ├── ingresar.html                                Ingreso del personal
    ├── inventario.html, producto-form.html, pedidos.html   Panel del vivero
    ├── css/estilos.css       Un solo archivo de estilos, variables en :root
    ├── js/api.js             Conexión con la API, sesión y modo demostración
    ├── js/app.js             Lógica de las pantallas
    ├── datos/ejemplo.json    Datos de ejemplo (también siembran la base)
    ├── img/                  Logo e ilustraciones por categoría
    └── fuentes/              Tipografía Atkinson Hyperlegible (licencia OFL)
```

## Cómo trabajamos

- Cada cambio va en una rama propia (`feat/...`, `docs/...`, `chore/...`, `ci/...`) y entra a `main` por pull request revisado por otro integrante.
- Los mensajes de commit siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y dicen qué cambió y por qué.
- Ningún `.env`, token ni contraseña se sube al repositorio; solo `.env.example` con los nombres de las variables.
- Las tareas están en el tablero del proyecto en GitHub, con responsable asignado.

## Uso de inteligencia artificial

| Herramienta | Entrega | Para qué | Alcance |
|---|---|---|---|
| Claude (Anthropic) | E2 | Proponer la estructura del repositorio y redactar borradores del contrato OpenAPI, del modelo de datos y de la documentación. Revisar la coherencia entre contrato, modelo y datos de ejemplo. | El problema, la encuesta al vivero, la elección de ruta y las decisiones son del equipo. |
| Claude (Anthropic) | E3 | Generar el código del servidor (Fastify, migraciones, autenticación, recursos y alertas), las pruebas, los archivos de Docker y de los flujos de GitHub Actions, la conexión del prototipo con la API y los borradores de esta documentación y de las decisiones D10 a D15. | El equipo definió qué debía hacer el sistema y sus reglas (encuesta y decisiones D1 a D9), aprobó la elección de Fastify y repartió el trabajo. Cada integrante revisó, probó y subió su parte, y responde por ella en la sustentación. |

Los datos de ejemplo son sintéticos: los productos son del tipo que vende el vivero, pero precios, existencias, proveedores, clientes y teléfonos son inventados.

## Licencia

Código bajo licencia [MIT](LICENSE). La tipografía Atkinson Hyperlegible es del Braille Institute y se distribuye con la licencia [SIL OFL 1.1](web/fuentes/OFL.txt).
