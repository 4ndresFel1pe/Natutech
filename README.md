# Natutech

Catálogo en línea, inventario y alertas de reabastecimiento por temporada para el Vivero Las Acacias, en Yopal (Casanare).

**Prototipo publicado:** https://4ndresfel1pe.github.io/Natutech/
**Contrato de la API:** [`api/openapi.yaml`](api/openapi.yaml) · **Modelo de datos:** [`docs/modelo-datos.md`](docs/modelo-datos.md) · **Decisiones:** [`docs/decisiones.md`](docs/decisiones.md)

## El problema

El Vivero Las Acacias lleva nueve años en Yopal y maneja su inventario en Excel, actualizado una vez por semana. Su dueño ha perdido ventas por no saber con exactitud qué tiene en existencia, y el riesgo crece en las fechas de mayor demanda: Día de la Madre, Amor y Amistad y, sobre todo, el Día de los Difuntos (2 de noviembre). En sus palabras, lo más importante es "saber en cualquier momento qué plantas tengo disponibles y cuántas". Ver la [encuesta al vivero](docs/entrevista/formulario/README.md).

## Ruta y equipo

**Ruta A: contenerización y DevOps.** El vivero no tiene personal técnico, así que el peso del proyecto está en que el sistema se pueda desplegar, respaldar y recuperar sin nosotros. La justificación completa está en [`docs/decisiones.md`](docs/decisiones.md#d1-ruta-a-contenerización-y-devops).

**Equipo 4 · Grupo [1 o 2] · Tecnologías Web 2026-B · Unitrópico**

| Integrante | Rol | GitHub |
|---|---|---|
| Brayan David Roa Vega | Líder técnico | [@BrayanRoa87](https://github.com/BrayanRoa87) |
| Andres Felipe Gomez Gutierrez | Backend y datos | [@4ndresFel1pe](https://github.com/4ndresFel1pe) |
| Andres Felipe Abril Lopez | Frontend y experiencia | [@AndresAbril2005](https://github.com/AndresAbril2005) |
| Joan Sebastián Berbesi Burgos | DevOps y calidad | [@joanberbesies-art](https://github.com/joanberbesies-art) |

## Cómo ejecutarlo en local

### Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | 2.40 o superior | Clonar el repositorio |
| Python | 3.10 o superior | Servir el prototipo (opción A) |
| Node.js | 22 LTS | Servir el prototipo (opción B) y levantar el servidor simulado de la API |

Compruebe las versiones con `git --version`, `python --version` (en macOS y Linux, `python3 --version`) y `node --version`.

### Prototipo

1. Clone el repositorio y entre a la carpeta:
   ```bash
   git clone https://github.com/4ndresFel1pe/Natutech.git
   cd Natutech
   ```
2. Sirva la carpeta `web` con **una** de estas dos opciones (no abra `index.html` con doble clic: el navegador bloquea la lectura de `datos/ejemplo.json` desde un archivo):
   - Opción A, con Python: `python -m http.server 8080 --directory web`
   - Opción B, con Node.js: `npx serve web -l 8080`
3. Abra http://localhost:8080 en el navegador.
4. Para detener el servidor, vuelva a la terminal y presione `Ctrl + C`.

### Servidor simulado de la API

1. Desde la carpeta del repositorio, levante el servidor simulado con Prism (la primera vez tarda unos segundos mientras descarga Prism):
   ```bash
   npx @stoplight/prism-cli@5 mock api/openapi.yaml
   ```
2. En otra terminal, pida el catálogo público:
   ```bash
   curl http://127.0.0.1:4010/catalogo/productos
   ```
3. Las rutas del panel exigen token. Sin él, Prism responde `401`; con cualquier token de prueba responde el ejemplo:
   ```bash
   curl -H "Authorization: Bearer prueba" http://127.0.0.1:4010/alertas
   ```

### Validar el contrato

```bash
npx @redocly/cli@2 lint api/openapi.yaml
```

Debe terminar con `Your API description is valid`. La misma validación corre sola en cada pull request que cambie el contrato.

## Pantallas del prototipo

| Pantalla | Archivo | Qué muestra |
|---|---|---|
| Catálogo público (principal) | [`web/index.html`](web/index.html) | 19 productos con buscador, filtros por categoría, luz y existencia, y botón de WhatsApp en cada uno |
| Detalle del producto | [`web/detalle.html`](web/detalle.html) | Precio, disponibilidad, cuidados y productos de la misma categoría |
| Inventario del vivero | [`web/inventario.html`](web/inventario.html) | Resumen de existencias, cuenta regresiva a la próxima temporada, alertas de reabastecimiento y tabla de productos |
| Formulario de producto | [`web/producto-form.html`](web/producto-form.html) | Crear o editar un producto con todos los campos del modelo y validaciones visibles |

Los estados de carga, vacío y error se ven desde el pie de cada página, en "Estados del prototipo", o agregando `?estado=cargando`, `?estado=vacio` o `?estado=error` a la dirección.

## Estado del proyecto

| Entrega | Fecha | Estado | Qué hay |
|---|---|---|---|
| E1 Anteproyecto | 17 sep | Entregada | Problema validado con el vivero, repositorio, wireframes, ruta y plan de trabajo |
| E2 Prototipo y contrato | 1 oct | **En esta versión (v0.2.0)** | Prototipo navegable publicado, contrato OpenAPI 3.1 validado con servidor simulado, modelo de datos y tablero de tareas |
| E3 MVP del backend | 15 oct | Pendiente | API con PostgreSQL, autenticación y validación según el contrato |
| E4 Despliegue contenerizado | 12 nov | Pendiente | Docker, CI/CD, HTTPS y dominio propio |
| E5 Versión candidata | 26 nov | Pendiente | Funcionalidades congeladas, pruebas, auditorías, respaldo restaurado |
| E6 Sustentación EXIS | 4 dic | Pendiente | |

## Estructura del repositorio

```
Natutech/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example              Variables que usará el backend, sin valores reales
├── .redocly.lint-ignore.yaml Advertencia del contrato aceptada, con su razón
├── .github/workflows/
│   ├── pages.yml             Publica web/ en GitHub Pages
│   └── validar-contrato.yml  Valida api/openapi.yaml en cada pull request
├── api/
│   └── openapi.yaml          Contrato de la API (OpenAPI 3.1)
├── docs/
│   ├── modelo-datos.md       Entidades, atributos, relaciones e índices
│   ├── modelo-datos.png      Diagrama entidad-relación
│   ├── decisiones.md         Decisiones de arquitectura y su porqué
│   ├── wireframes/           Wireframes de la Entrega 1 y capturas del prototipo
│   ├── entrevista/           Encuesta aplicada al vivero y sus resultados
│   ├── evidencias/           Capturas de Lighthouse, validación y servidor simulado
│   └── Diagrama-Gantt.xlsx   Cronograma del semestre
└── web/
    ├── index.html            Catálogo público
    ├── detalle.html          Detalle del producto
    ├── inventario.html       Inventario y alertas del vivero
    ├── producto-form.html    Formulario de producto
    ├── css/estilos.css       Un solo archivo de estilos, variables en :root
    ├── js/app.js             Interacción y carga de los datos de ejemplo
    ├── datos/ejemplo.json    Datos realistas, con los mismos campos del contrato
    ├── img/                  Logo e ilustraciones por categoría
    └── fuentes/              Tipografía Atkinson Hyperlegible (licencia OFL)
```

## Cómo trabajamos

- Cada cambio va en una rama propia (`feat/...`, `docs/...`, `chore/...`, `ci/...`) y entra a `main` por pull request revisado por otro integrante.
- Los mensajes de commit siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y dicen qué cambió y por qué.
- Ningún `.env`, token ni contraseña se sube al repositorio; solo `.env.example` con los nombres de las variables.
- Las tareas están en el tablero del proyecto en GitHub, con responsable asignado.

## Uso de inteligencia artificial

| Herramienta | Para qué | Alcance |
|---|---|---|
| Claude (Anthropic) | Proponer la estructura del repositorio y redactar borradores del contrato OpenAPI, del modelo de datos, del prototipo (HTML, CSS y JavaScript) y de esta documentación. Revisar la coherencia entre contrato, modelo y datos de ejemplo. | El problema, la encuesta al vivero, la elección de ruta y las decisiones son del equipo. Cada integrante revisó, probó y ajustó lo que subió, y puede explicarlo línea por línea. |

Los datos del prototipo son sintéticos: los productos son del tipo que vende el vivero, pero precios, existencias, proveedores, clientes y teléfonos son de ejemplo.

## Licencia

Código bajo licencia [MIT](LICENSE). La tipografía Atkinson Hyperlegible es del Braille Institute y se distribuye con la licencia [SIL OFL 1.1](web/fuentes/OFL.txt).
