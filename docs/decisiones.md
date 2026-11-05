# Decisiones de arquitectura

Registro de las decisiones que condicionan el proyecto. Cada una dice qué se decidió, por qué y qué se dejó de lado. Si una decisión cambia, no se borra: se marca como reemplazada y se agrega la nueva.

| # | Decisión | Estado | Fecha |
|---|---|---|---|
| D1 | Ruta A: contenerización y DevOps | Vigente | 17 sep 2026 |
| D2 | La venta se cierra por WhatsApp, sin pasarela de pago | Vigente, actualizada por D17 y D18 | 17 sep 2026 · 5 nov 2026 |
| D3 | PostgreSQL como base de datos | Vigente | 1 oct 2026 |
| D4 | Contrato primero (OpenAPI 3.1) | Vigente | 1 oct 2026 |
| D5 | Catálogo público separado de la gestión | Vigente, actualizada | 1 oct 2026 · 14 oct 2026 |
| D6 | Precio congelado en cada línea del pedido | Vigente | 1 oct 2026 |
| D7 | Alertas guardadas en una tabla, no calculadas al vuelo | Vigente | 1 oct 2026 |
| D8 | Prototipo en HTML, CSS y JavaScript sin framework | Vigente | 1 oct 2026 |
| D9 | Publicación del prototipo con GitHub Actions | Vigente | 1 oct 2026 |
| D10 | Fastify como framework del backend | Vigente | 14 oct 2026 |
| D11 | Sesiones con JWT, contraseñas con bcrypt y dos roles | Vigente | 14 oct 2026 |
| D12 | La validación sale del contrato | Vigente | 14 oct 2026 |
| D13 | Un solo origen: nginx sirve el prototipo y reenvía /api | Vigente | 14 oct 2026 |
| D14 | El conjunto arranca solo con docker compose up | Vigente | 14 oct 2026 |
| D15 | Pruebas contra el contrato, en dos zonas horarias | Vigente | 14 oct 2026 |
| D16 | Despliegue: una máquina virtual con el mismo Compose y Caddy para HTTPS | Vigente | 4 nov 2026 |
| D17 | Pago en línea opcional con Wompi (modo de pruebas) y número de WhatsApp desde el .env | Vigente | 5 nov 2026 |
| D18 | Tienda en línea: carrito en el catálogo y pedidos sin sesión con stock apartado 30 minutos | Vigente | 5 nov 2026 |

---

## D1. Ruta A: contenerización y DevOps

**Contexto.** El Vivero Las Acacias lleva nueve años funcionando, tiene de cuatro a seis trabajadores y nadie con formación técnica. Hoy maneja el inventario en Excel y lo actualiza una vez por semana.

**Decisión.** El peso técnico del proyecto está en que el sistema siga funcionando y se pueda recuperar sin el equipo: contenedores, integración continua, HTTPS, respaldos restaurados y reversión de versiones.

**Alternativas descartadas.** Las demás rutas resuelven problemas que este negocio no tiene: no hay pagos en línea (F), ni varias personas editando lo mismo en tiempo real (B), ni datos externos que integrar (D), ni lenguaje natural (E), ni sensores (I).

## D2. La venta se cierra por WhatsApp, sin pasarela de pago

**Contexto.** En la encuesta, el dueño dijo que hoy vende solo en la tienda física, que le interesa que los clientes vean el catálogo en línea y que le gustaría recibir pedidos por la página.

**Decisión.** El catálogo es público y cada producto tiene un botón que abre WhatsApp con un mensaje ya escrito ("Me interesa: Monstera deliciosa, $45.000"). El personal registra el pedido en el panel después de acordarlo.

**Consecuencias.** No se manejan datos de pago ni cuentas de cliente. El pedido lo crea siempre alguien autenticado del vivero, lo que reduce la superficie de ataque.

**Actualización del 5 de noviembre (D17).** La venta se sigue cerrando por WhatsApp, pero ahora el vivero puede mandarle al cliente un enlace de pago de Wompi. Natutech sigue sin ver ni guardar datos de tarjetas: el cliente paga en la página de Wompi. Con la D18, el cliente también puede armar su pedido en un carrito y pagarlo él mismo; el pedido por WhatsApp sigue disponible desde el mismo carrito.

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

**Actualización del 14 de octubre (contrato 0.3.0).** `GET /temporadas` y `GET /temporadas/{id}` pasan a ser públicas: el catálogo muestra la cuenta regresiva a la próxima temporada y una fecha comercial no es un dato interno. Crear, cambiar y borrar temporadas sigue exigiendo sesión.

## D6. Precio congelado en cada línea del pedido

**Contexto.** En la encuesta, el dueño dijo que cambia los precios según la temporada.

**Decisión.** `detalle_pedido.precio_unitario` copia el precio del producto al registrar el pedido. Si después el crisantemo sube de $15.000 a $17.000 para el Día de los Difuntos, los encargos ya registrados conservan su precio.

## D7. Alertas guardadas en una tabla

**Decisión.** Las alertas se guardan en `alerta` y las crea un proceso del servidor, en lugar de calcularse cada vez que se abre el panel.

**Por qué.** El personal tiene que poder marcarlas como atendidas ("ya le pedí al proveedor") y debe quedar registro de cuándo se avisó. Un índice único parcial impide que el proceso cree la misma alerta activa dos veces.

**Cuándo corre (Entrega 3).** Al arrancar el servidor y luego cada `HORAS_ENTRE_ALERTAS` horas (6 por defecto). Además, la alerta de stock mínimo se revisa en el momento en que un producto cambia o se registra un pedido, porque es justo cuando el stock baja. Una alerta atendida no se vuelve a crear hasta que el producto cambie otra vez.

**Cómo se calcula la alerta de temporada.** Cuando una temporada entra en su ventana (`dias_anticipacion`, 21 días por defecto), se suman las unidades vendidas de cada producto en la misma ventana del año anterior (`demanda_estimada`). Si el stock actual no alcanza, se crea la alerta.

## D8. Prototipo en HTML, CSS y JavaScript sin framework

**Decisión.** Para la Entrega 2 el prototipo es HTML semántico, un solo archivo de estilos con variables en `:root` y un solo `app.js` que lee `datos/ejemplo.json`.

**Por qué.** Lo que se evalúa ahora es la interfaz, la accesibilidad y las decisiones, no la herramienta. Sin framework no hay paso de compilación y GitHub Pages lo sirve tal cual.

**Detalle importante.** `ejemplo.json` usa exactamente los mismos nombres de campo que el contrato y el modelo. En la Entrega 3 el frontend cambió la lectura del archivo por la llamada a la API (`web/js/api.js`) y las pantallas siguieron igual.

**Tipografía.** Atkinson Hyperlegible, diseñada por el Braille Institute para personas con baja visión, porque el panel se va a usar desde el celular en el mostrador. Se sirve desde `web/fuentes/` (licencia SIL OFL) y no desde Google Fonts: el sitio no hace peticiones a terceros y no depende de otro servicio para verse bien.

**Resultado.** Lighthouse da 100 en accesibilidad, buenas prácticas, SEO y rendimiento en las cuatro pantallas, en celular y en escritorio (medido en local el 30 de septiembre; las capturas oficiales sobre la URL publicada están en `docs/evidencias/`). Esa medición es anterior a las animaciones y videos que se agregaron a la portada después de la Entrega 3, así que debe repetirse antes de volver a citar esas cifras.

## D9. Publicación del prototipo con GitHub Actions

**Contexto.** La guía de la entrega propone publicar desde *Settings → Pages → rama main, carpeta /web*. GitHub Pages, cuando publica desde una rama, solo permite la raíz del repositorio o la carpeta `/docs`.

**Decisión.** El flujo `.github/workflows/pages.yml` publica la carpeta `web/` cada vez que cambia en `main`. Es el primer paso de despliegue automático del proyecto, coherente con la ruta A.

## D10. Fastify como framework del backend

**Opciones que se compararon.** Express o Fastify, ambos sobre Node.js 22.

**Criterio.** Cuál permite validar las peticiones con los mismos esquemas del contrato con menos código propio.

**Decisión.** Fastify 5. Valida con JSON Schema de forma nativa, y el contrato ya está escrito en JSON Schema (OpenAPI 3.1), así que cada ruta usa directamente el esquema de su operación (ver D12). Con Express habría que agregar una librería de validación y conectar cada esquema a mano. Fastify además trae `inject()`, que permite probar la API sin abrir puertos (ver D15).

**Lo que se dejó de lado.** Un ORM. Las consultas son SQL escrito a mano con parámetros (`$1`, `$2`), nunca con texto concatenado, porque las reglas importantes ya están en la base (D3) y un ORM escondería justo lo que la ruta A necesita entender: transacciones, bloqueos e índices.

## D11. Sesiones con JWT, contraseñas con bcrypt y dos roles

**Decisión.**
- `POST /sesiones` recibe correo y contraseña y devuelve un token JWT firmado con `JWT_SECRETO` (mínimo 32 caracteres, solo en `.env`) que dura `JWT_EXPIRA_EN` (8 horas, una jornada).
- Las contraseñas se guardan con bcrypt, costo 12. Si el correo no existe, el servidor compara igual contra un hash de relleno: así la respuesta tarda lo mismo y no revela qué correos están registrados. El mensaje de error también es el mismo en los dos casos.
- Dos roles: `administrador` y `empleado`. El empleado registra productos, pedidos y atiende alertas; solo el administrador crea, cambia o borra categorías, borra productos o temporadas y ajusta precios en bloque. Si un empleado lo intenta, la API responde `403 SIN_PERMISO`.
- El primer administrador se crea solo al arrancar, con `ADMIN_CORREO` y `ADMIN_CONTRASENA` del `.env`, únicamente si no hay ningún usuario. Los demás se crean con `npm run crear-usuario`, que pide la contraseña por variable de entorno. Para que no quede en el historial de la terminal, la contraseña se lee antes con `read -s` y se pasa como `"$CLAVE"` (ver `docs/despliegue.md`): si se escribe directamente en el comando, sí queda en el historial.
- En el navegador, el token se guarda en `sessionStorage`: se borra al cerrar la pestaña.

**Riesgo aceptado.** Un token en `sessionStorage` lo podría leer un script inyectado en la página. Se reduce ese riesgo porque los datos que llegan de la API siempre se insertan como texto (función `crear()` de `js/app.js`, nunca con `innerHTML`) y el prototipo no carga scripts de terceros. Pasar el token a una cookie `HttpOnly` queda anotado para la Entrega 4, junto con HTTPS.

**Corrección del 5 de noviembre.** Las animaciones que se agregaron después de la Entrega 3 (`js/cargas.js` y `js/movil.js`) sí usan `innerHTML`, pero solo con contenido fijo escrito en el propio código, nunca con datos de la API ni con lo que escribe el usuario. HTTPS ya está en producción (D16); la cookie `HttpOnly` sigue pendiente.

## D12. La validación sale del contrato

**Decisión.** El servidor no tiene esquemas escritos a mano: `servidor/src/contrato.js` lee `api/openapi.yaml` y cada ruta pide los esquemas de su `operationId`. Si el contrato cambia, la validación cambia con él.

**Reglas que se aplican.**
- El cuerpo no se convierte: `"precio": "45000"` (texto) se rechaza, porque el contrato dice número entero. Los parámetros de la dirección sí se convierten (`?pagina=2` llega como texto).
- `400 SOLICITUD_INVALIDA`: JSON mal formado o un parámetro de la dirección que no cumple el contrato.
- `422 VALIDACION_FALLIDA`: el cuerpo no cumple las reglas, o una regla del negocio lo impide (no hay stock, transición de estado no permitida). Siempre con `detalles: [{ campo, problema }]` en español, para que el formulario marque el campo exacto.
- `409 CONFLICTO`: nombre repetido, o borrar algo que todavía se usa (una categoría con productos, un producto con pedidos).
- `401 NO_AUTENTICADO`, `403 SIN_PERMISO`, `404 NO_ENCONTRADO` y `500 ERROR_INTERNO` (este último nunca muestra el detalle técnico; queda en el registro del servidor).

**Doble validación.** El prototipo revisa las mismas reglas antes de enviar, para avisar de inmediato, y además muestra en cada campo los errores que devuelve la API.

## D13. Un solo origen: nginx sirve el prototipo y reenvía /api

**Decisión.** En Docker Compose, el servicio `web` (nginx) sirve la carpeta `web/` en `http://localhost:8080` y reenvía todo lo que empiece por `/api/` a la API. La API no se publica en ningún puerto del computador.

**Por qué.** El navegador ve un solo origen, así que el prototipo llama a `/api/...` sin depender de CORS, y solo hay una puerta de entrada que asegurar (en la Entrega 4 ahí se pone HTTPS). El prototipo detecta si hay API: en GitHub Pages no la hay y sigue funcionando en modo demostración con `datos/ejemplo.json`, avisando que los cambios no se guardan.

## D14. El conjunto arranca solo con docker compose up

**Decisión.** Tres servicios: `db` (PostgreSQL 16), `api` (la imagen de `servidor/Dockerfile`) y `web` (nginx). La API espera a que la base esté sana, aplica las migraciones pendientes, carga los datos de ejemplo si la base está vacía (`SEMBRAR_DATOS_EJEMPLO=si`), crea el administrador inicial y revisa las alertas. No hay pasos manuales después de llenar `.env`.

**La imagen.** Dockerfile de dos etapas sobre `node:22-alpine`: la primera instala con `npm ci` exactamente lo de `package-lock.json`; la final lleva solo las dependencias de producción y el código, corre con el usuario `node` (no root) y tiene `HEALTHCHECK` contra `GET /salud`. El `.dockerignore` excluye todo y permite solo lo que la imagen necesita, así que un `.env` nunca puede terminar dentro.

**Secretos.** Ninguna credencial está escrita en el código ni versionada. `docker-compose.yml` lee todo de `.env` y se detiene con un mensaje claro si falta un valor obligatorio. En GitHub Actions, el `.env` de prueba se arma con valores aleatorios en cada ejecución.

## D15. Pruebas contra el contrato, en dos zonas horarias

**Decisión.** Las pruebas (`servidor/test/`, con `node:test`) llaman a la API con `app.inject()` contra un PostgreSQL real y comparan cada respuesta con el esquema que el contrato declara para esa operación y ese código de estado. Una prueba revisa además que cada operación del contrato esté implementada.

**Qué cubren.** Catálogo público y filtros, ingreso, 401 y 403, el CRUD de categorías, productos, proveedores y temporadas, el ajuste de precios, pedidos (total, descuento de stock, transacción, transiciones, cancelación que devuelve el stock y pedidos simultáneos que no venden de más) y la generación de alertas.

**Zonas horarias.** GitHub Actions corre las pruebas dos veces, con `TZ=UTC` y `TZ=America/Bogota`. La base trabaja en hora de Colombia y las fechas salen con `-05:00`, sin depender del reloj de la máquina.

## D16. Despliegue: una máquina virtual con el mismo Compose y Caddy para HTTPS

**Decisión.** La aplicación se publica en https://natutech.lat, en una instancia EC2 de AWS (plan gratuito: 100 US$ de crédito y sin cobros mientras no se cambie a un plan de pago) con Ubuntu 24.04, Docker Engine y el mismo `docker-compose.yml` que se usa en local. En el servidor se le suma `docker-compose.prod.yml`, que agrega Caddy como única entrada desde internet (puertos 80 y 443) y quita los puertos publicados de nginx y de PostgreSQL. Los pasos están en [`despliegue.md`](despliegue.md).

**Por qué AWS y no Azure.** La primera opción fue Azure for Students, que no pide tarjeta. Sin embargo, la suscripción de estudiante rechazó todos los tamaños de máquina virtual que se intentaron, en todas las regiones probadas, con el error `NotAvailableForSubscription`. Por eso se cambió al plan gratuito de AWS.

**Por qué una máquina virtual y no una plataforma como servicio.** Es la ruta A: lo que se evalúa es que el conjunto contenerizado corra igual en el servidor que en el computador del equipo. Las plataformas como servicio no ejecutan un archivo Compose tal cual y llevan la base de datos a otro producto. En la máquina virtual, levantar, actualizar y recuperar el sistema se hace con los mismos comandos de siempre.

**Por qué Caddy delante de nginx.** Caddy obtiene y renueva el certificado de Let's Encrypt sin pasos manuales ni tareas programadas. Con nginx habría que agregar certbot y programar su renovación. nginx sigue haciendo lo mismo que en la D13 (sirve el prototipo y reenvía `/api`), así que la configuración local y la del servidor no se separan.

**Por qué un dominio .lat.** En Porkbun cuesta 1,54 dólares el primer año, frente a 11,81 de un .com y 15,76 de un .co (precios de noviembre de 2026). El dominio solo se necesita durante el semestre, así que la renovación automática quedó desactivada. Si el vivero quiere conservar la dirección, se decide con el dueño.

**Seguridad.** El security group de AWS solo deja entrar por los puertos 22 (SSH, únicamente con llave), 80 y 443. La instancia tiene una IP elástica para que el dominio no deje de apuntar al servidor si este se reinicia. Los secretos están en el `.env` del servidor, con permisos 600, y se generan allí mismo con `openssl rand`: no pasan por el repositorio ni por el chat del equipo.

**Pendiente.** Respaldos con `pg_dump` y una restauración probada, despliegue automático desde GitHub Actions y rollback verificado.


## D17. Pago en línea opcional con Wompi y número de WhatsApp desde el .env

**Decisión.** El pedido se sigue registrando en el panel después de acordarlo por WhatsApp (D2). Desde la pantalla de pedidos, el personal puede generar un **enlace de pago de Wompi** y mandárselo al cliente por WhatsApp. Wompi avisa el resultado a `POST /api/pagos/eventos`; un pago aprobado confirma el pedido. El cliente vuelve a `pago-resultado.html`, que le pregunta el resultado a la API.

**Por qué Wompi.** Es una pasarela colombiana (de Bancolombia) que recibe tarjetas, Nequi, PSE y Bancolombia en pesos, y tiene un ambiente de pruebas con dinero ficticio que se activa con solo registrarse. Con las llaves `pub_test_…` se demuestra el flujo completo sin cobros reales. Pasar a producción solo exige cambiar las llaves en el `.env`, pero para eso el vivero tiene que abrir su propia cuenta de comercio con sus documentos (RUT y cuenta bancaria); mientras eso no pase, el sistema queda en pruebas.

**Seguridad.**
- Los secretos de Wompi solo están en el `.env` del servidor. El navegador nunca los ve: la API arma el enlace.
- El enlace lleva la **firma de integridad** de Wompi (SHA-256 de referencia, monto en centavos, moneda y secreto de integridad). Si alguien cambia el monto en la dirección, Wompi rechaza el pago.
- Cada evento se acepta solo si su **firma** coincide (SHA-256 de las propiedades que indica el evento, el timestamp y el secreto de eventos). Un evento con firma falsa recibe 401.
- El monto y la moneda del evento tienen que ser los del enlace. Un evento repetido no cambia nada (Wompi reintenta hasta tres veces), y un pedido no puede tener dos pagos aprobados (índice único parcial).
- La página de resultado no le cree a la dirección: la API confirma el estado con el evento firmado o, si todavía no llegó, consultando a Wompi (`GET /transactions/{id}`). Esa respuesta pública no incluye datos del cliente.
- Sin las llaves, el cobro en línea responde 503 y el resto del sistema funciona igual.

**Número de WhatsApp.** El número del vivero va en `WHATSAPP_NUMERO` del `.env` y nunca en el repositorio. nginx lo publica en `/configuracion.json` a partir de la plantilla `infra/nginx/default.conf.template`, y el prototipo lo usa en todos los botones de WhatsApp. En GitHub Pages, o si la variable está vacía, se usa el número de ejemplo.

**Pendiente.** Activar producción cuando el vivero abra su cuenta de comercio en Wompi y cambiar el número de prueba por el del vivero cuando el dueño lo autorice.


## D18. Tienda en línea: carrito en el catálogo y pedidos sin sesión

**Contexto.** Con la D17, el pago en línea solo empezaba desde el panel: el cliente no podía comprar por su cuenta desde el catálogo. En la encuesta, el dueño dijo que le gustaría recibir pedidos por la página.

**Decisión.** Cada producto del catálogo y del detalle tiene el botón «Agregar al carrito». El carrito (`carrito.html`) muestra los productos con los precios y existencias de hoy y ofrece dos caminos: **pagar en línea** con Wompi o **enviar el pedido por WhatsApp**, con el pedido ya escrito, como siempre. Pagar en línea llama a `POST /api/catalogo/pedidos`, que crea un pedido con canal `web` y devuelve el enlace de Wompi. El personal lo ve en Pedidos como «Tienda en línea» y, cuando está pagado, le escribe al cliente para coordinar la entrega.

**Qué cambia frente a la D2.** Hasta ahora, solo el personal con sesión creaba pedidos. Esta es la primera ruta que crea datos sin sesión, así que se protege así:
- **Del navegador solo llegan ids y cantidades.** El esquema no admite precios, y el servidor calcula precios y total con los de ese momento.
- **Solo se compran productos visibles en el catálogo y con stock suficiente**, con el mismo bloqueo de filas que los demás pedidos (D3), así que dos clientes no pueden comprar la misma unidad.
- **Las unidades quedan apartadas 30 minutos.** El enlace de Wompi vence a esa hora (`expiration-time`, incluido en la firma de integridad). Si a los 40 minutos no hay un pago aprobado, el pedido se cancela solo, el stock vuelve y el enlace queda «vencido». Lo revisa la API al arrancar, cada 5 minutos y antes de cada pedido nuevo.
- **Cada conexión puede crear 10 pedidos cada 15 minutos.** Si pasa de ahí, recibe 429. Así nadie puede apartar todo el inventario con un programa. Detrás de Caddy y nginx, la API ve la IP real del cliente.
- **Si el personal genera otro enlace para un pedido de la tienda, el pedido deja de vencer:** desde ese momento lo atiende el vivero.

**Por qué el carrito vive en el navegador.** Guardarlo en `localStorage` evita crear cuentas de cliente, que la D2 descartó. Solo guarda ids y cantidades, así que no hay nada sensible.

**Alternativas descartadas.** Pagar primero y descontar el stock después: con poco inventario, dos clientes podrían pagar la misma unidad. Pedir que el cliente cree una cuenta: es una barrera para un vivero de barrio, y el celular basta para coordinar la entrega.

---

## Pendientes que vienen de la encuesta

- **Actualización masiva de precios.** El dueño la calificó con 5 de 5 ("¿Le gustaría poder actualizar precios masivamente desde un solo lugar?"). Resuelta en el contrato 0.3.0 con `POST /categorias/{id}/ajuste-precios`: sube o baja un porcentaje (entre -50 y 100) los precios de una categoría, redondeados a la centena. Está en la API; la pantalla para usarla queda para la Entrega 4.
- **Capacitación.** El dueño aceptó recibir una capacitación corta. Se planea para la semana 13, con la versión candidata.
