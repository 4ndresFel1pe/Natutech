# Decisiones de arquitectura

Registro de las decisiones que condicionan el proyecto. Cada una dice qué se decidió, por qué y qué se dejó de lado. Si una decisión cambia, no se borra: se marca como reemplazada y se agrega la nueva.

| # | Decisión | Estado | Fecha |
|---|---|---|---|
| D1 | Ruta A: contenerización y DevOps | Vigente | 17 sep 2026 |
| D2 | La venta se cierra por WhatsApp, sin pasarela de pago | Vigente | 17 sep 2026 |
| D3 | PostgreSQL como base de datos | Vigente | 1 oct 2026 |
| D4 | Contrato primero (OpenAPI 3.1) | Vigente | 1 oct 2026 |
| D5 | Catálogo público separado de la gestión | Vigente | 1 oct 2026 |
| D6 | Precio congelado en cada línea del pedido | Vigente | 1 oct 2026 |
| D7 | Alertas guardadas en una tabla, no calculadas al vuelo | Vigente | 1 oct 2026 |
| D8 | Prototipo en HTML, CSS y JavaScript sin framework | Vigente | 1 oct 2026 |
| D9 | Publicación del prototipo con GitHub Actions | Vigente | 1 oct 2026 |
| D10 | Framework del backend | Pendiente | antes del 8 oct 2026 |

---

## D1. Ruta A: contenerización y DevOps

**Contexto.** El Vivero Las Acacias lleva nueve años funcionando, tiene de cuatro a seis trabajadores y nadie con formación técnica. Hoy maneja el inventario en Excel y lo actualiza una vez por semana.

**Decisión.** El peso técnico del proyecto está en que el sistema siga funcionando y se pueda recuperar sin el equipo: contenedores, integración continua, HTTPS, respaldos restaurados y reversión de versiones.

**Alternativas descartadas.** Las demás rutas resuelven problemas que este negocio no tiene: no hay pagos en línea (F), ni varias personas editando lo mismo en tiempo real (B), ni datos externos que integrar (D), ni lenguaje natural (E), ni sensores (I).

## D2. La venta se cierra por WhatsApp, sin pasarela de pago

**Contexto.** En la encuesta, el dueño dijo que hoy vende solo en la tienda física, que le interesa que los clientes vean el catálogo en línea y que le gustaría recibir pedidos por la página.

**Decisión.** El catálogo es público y cada producto tiene un botón que abre WhatsApp con un mensaje ya escrito ("Me interesa: Monstera deliciosa, $45.000"). El personal registra el pedido en el panel después de acordarlo.

**Consecuencias.** No se manejan datos de pago ni cuentas de cliente. El pedido lo crea siempre alguien autenticado del vivero, lo que reduce la superficie de ataque.

## D3. PostgreSQL como base de datos

**Decisión.** PostgreSQL 16.

**Por qué.** Un pedido descuenta el stock de varios productos al mismo tiempo y debe hacerlo completo o no hacerlo (transacción). Reglas como "el stock nunca es negativo" o "no puede haber dos alertas activas iguales" se garantizan en la base con `CHECK` e índices únicos parciales. Y la ruta A exige restaurar respaldos de verdad, cosa que `pg_dump` y `pg_restore` hacen sin herramientas adicionales.

**Alternativa descartada.** MongoDB: obligaría a programar esas garantías en la aplicación, que es donde más fácil se rompen.

## D4. Contrato primero (OpenAPI 3.1)

**Decisión.** El archivo `api/openapi.yaml` se escribe antes que el backend y manda: en la Entrega 3 se implementa exactamente lo que diga. Si la implementación necesita cambiarlo, primero se cambia el contrato en un pull request.

**Cómo se comprueba.** Se valida con Redocly CLI, que además revisa que cada ejemplo cumpla su esquema. Con Prism se levanta un servidor simulado desde el mismo archivo. Un flujo de GitHub Actions valida el contrato en cada pull request que lo toque.

## D5. Catálogo público separado de la gestión

**Decisión.** Hay dos grupos de rutas:

- `/catalogo/productos` y `/categorias`: sin sesión. Devuelven `ProductoPublico`, que no incluye proveedor, stock mínimo ni si el producto está oculto.
- `/productos`, `/pedidos`, `/proveedores`, `/temporadas`, `/alertas`: exigen token JWT.

**Por qué.** El cliente necesita ver precio y disponibilidad, no de dónde compra el vivero ni a qué precio le conviene reabastecerse. Separar las rutas evita que un cambio en la gestión exponga datos internos por accidente.

## D6. Precio congelado en cada línea del pedido

**Contexto.** En la encuesta, el dueño dijo que cambia los precios según la temporada.

**Decisión.** `detalle_pedido.precio_unitario` copia el precio del producto al registrar el pedido. Si después el crisantemo sube de $15.000 a $17.000 para el Día de los Difuntos, los encargos ya registrados conservan su precio.

## D7. Alertas guardadas en una tabla

**Decisión.** Las alertas se guardan en `alerta` y las crea un proceso del servidor, en lugar de calcularse cada vez que se abre el panel.

**Por qué.** El personal tiene que poder marcarlas como atendidas ("ya le pedí al proveedor") y debe quedar registro de cuándo se avisó. Un índice único parcial impide que el proceso diario cree la misma alerta activa dos veces.

**Cómo se calcula la alerta de temporada.** Cuando una temporada entra en su ventana (`dias_anticipacion`, 21 días por defecto), se suman las unidades vendidas de cada producto en la misma ventana del año anterior (`demanda_estimada`). Si el stock actual no alcanza, se crea la alerta.

## D8. Prototipo en HTML, CSS y JavaScript sin framework

**Decisión.** Para la Entrega 2 el prototipo es HTML semántico, un solo archivo de estilos con variables en `:root` y un solo `app.js` que lee `datos/ejemplo.json`.

**Por qué.** Lo que se evalúa ahora es la interfaz, la accesibilidad y las decisiones, no la herramienta. Sin framework no hay paso de compilación y GitHub Pages lo sirve tal cual.

**Detalle importante.** `ejemplo.json` usa exactamente los mismos nombres de campo que el contrato y el modelo. En la Entrega 3 el frontend cambia la lectura del archivo por la llamada a la API y el resto del código sigue igual.

**Tipografía.** Atkinson Hyperlegible, diseñada por el Braille Institute para personas con baja visión, porque el panel se va a usar desde el celular en el mostrador. Se sirve desde `web/fuentes/` (licencia SIL OFL) y no desde Google Fonts: el sitio no hace peticiones a terceros y no depende de otro servicio para verse bien.

**Resultado.** Lighthouse da 100 en accesibilidad, buenas prácticas, SEO y rendimiento en las cuatro pantallas, en celular y en escritorio (medido en local el 30 de septiembre; las capturas oficiales sobre la URL publicada están en `docs/evidencias/`).

## D9. Publicación del prototipo con GitHub Actions

**Contexto.** La guía de la entrega propone publicar desde *Settings → Pages → rama main, carpeta /web*. GitHub Pages, cuando publica desde una rama, solo permite la raíz del repositorio o la carpeta `/docs`.

**Decisión.** El flujo `.github/workflows/pages.yml` publica la carpeta `web/` cada vez que cambia en `main`. Es el primer paso de despliegue automático del proyecto, coherente con la ruta A.

## D10. Framework del backend (pendiente)

**Opciones.** Express o Fastify, ambos sobre Node.js 22.

**Criterio para decidir.** Cuál permite validar las peticiones con los mismos esquemas del contrato con menos código propio. Fastify valida con JSON Schema de forma nativa; Express necesita una librería adicional.

**Responsable y plazo.** Andres Felipe Gomez (backend y datos), antes del jueves 8 de octubre, para empezar la Entrega 3.

---

## Pendientes que vienen de la encuesta

- **Actualización masiva de precios.** El dueño la calificó con 5 de 5 ("¿Le gustaría poder actualizar precios masivamente desde un solo lugar?"). Se especifica en la versión 0.3.0 del contrato como una operación que sube o baja un porcentaje los precios de una categoría.
- **Capacitación.** El dueño aceptó recibir una capacitación corta. Se planea para la semana 13, con la versión candidata.
