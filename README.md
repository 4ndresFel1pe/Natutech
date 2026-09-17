# Natutech
Catálogo, inventario y alertas de reabastecimiento estacional para un vivero/floristería en Yopal, Casanare.

## Equipo

| Integrante | Rol |
|---|---|
| Brayan David Roa Vega | Líder técnico |
| Andres Felipe Gomez Gutierrez | Backend y datos |
| Andres Felipe Abril Lopez | Frontend y experiencia |
| Joan Sebastián Berbesi Burgos | DevOps y calidad |

## El problema

Los viveros y floristerías pequeños de Casanare llevan su inventario, pedidos
y proveedores en cuaderno o de memoria, sin ningún control frente a los picos
de demanda que trae el calendario: Día de la Madre, Amor y Amistad y, sobre
todo, el Día de los Difuntos (2 de noviembre), la fecha de mayor venta del año
para este tipo de negocio en la región.

Eso se traduce en dos pérdidas concretas: quiebre de stock en el peor momento
posible (ventas que se pierden porque no había suficiente) o sobrestock que no
alcanza a venderse (plantas y flores son perecederas).

Validado con el dueño del Vivero las Acacias, Yopal — ver el detalle completo
de la conversación en [docs/entrevista/formulario](docs/entrevista/formulario/README.md).

## Ruta elegida: A — Contenerización y DevOps

*El tipo de problema que tenemos no es de lógica de dominio compleja.*
Catálogo, pedidos, proveedores y alertas son, en esencia, CRUD — no hay
pagos en línea que integrar (ruta F), no hay necesidad de sincronización
en tiempo real (ruta B), no hay datos externos de terceros que consumir
(ruta D), no hay lenguaje natural que procesar (ruta E), ni hardware o
sensores que monitorear (ruta I). Forzar cualquiera de esas rutas sobre
este problema sería resolver una dificultad que el negocio no tiene.

*La dificultad real está en otro lado: la continuidad operativa.*
El vivero es un negocio familiar sin personal técnico propio. Nadie ahí
sabe qué es un contenedor, un pipeline de CI/CD o una migración de base
de datos — y nosotros no vamos a estar disponibles para mantener el
sistema después de la entrega. Eso significa que el riesgo más grande
del proyecto no es que el sistema tenga un bug: es que falle sin que
nadie sepa cómo recuperarlo, justo el día en que más ventas tiene el año.

*Por eso la ruta A responde directamente al problema, no al revés:*

- **Contenerización** → que el sistema completo se levante con un solo
  comando, sin que alguien tenga que instalar dependencias manualmente
- **CI/CD** → que un cambio no rompa producción sin que nadie lo note
  antes de llegar ahí
- **Despliegue con HTTPS y reverse proxy** → que el sitio esté disponible
  de forma estable, sin intervención manual constante
- **Backup probado** (no solo programado) → que si algo se corrompe el
  2 de noviembre, la recuperación sea cuestión de minutos, no de días
- **Rollback verificado** → que un despliegue fallido se pueda revertir
  sin perder datos de pedidos o inventario

En resumen: la funcionalidad es intencionalmente simple porque el peso
técnico del proyecto no está en qué hace la app, sino en garantizar que
siga funcionando de forma confiable y recuperable sin nosotros detrás.

## Alcance funcional

- **Catálogo público** (sin login obligatorio): productos, fotos, precio, disponibilidad,
  con botón directo a WhatsApp para concluir la venta (sin pasarela de pago)
- **Panel de administrador** (autenticado): CRUD de catálogo, pedidos,
  proveedores y alertas de reabastecimiento
- **Alertas de reabastecimiento**: comparación de stock actual contra
  ventas históricas antes de cada fecha estacional clave
- **Reportes**: ventas por periodo, productos más vendidos, año contra año

## Arquitectura

> El framework de backend y frontend, y algunos detalles del pipeline de despliegue, están sujetos a cambios según lo defina el equipo.

### Backend
- **Framework:** por definir (Express o Fastify) + PostgreSQL — se busca algo liviano y suficiente para el volumen de datos de un solo negocio
- **Autenticación:** JWT con contraseñas cifradas (bcrypt), dos niveles de acceso: público (solo lectura) y administrador

### Frontend
- **Framework:** por definir. Debe funcionar bien tanto en celular (el dueño lo usará desde el mostrador) como en computador, y ser accesible también para los clientes que solo consultan el catálogo
- **Autenticación:** el backend entrega un JWT; el frontend maneja dos niveles de acceso — público (solo lectura del catálogo) y administrador (acceso completo tras iniciar sesión)
- **Consumo de API:** todas las pantallas consumen los endpoints REST expuestos por el backend
- **Diseño:** mobile-first — prioriza que se vea y funcione bien en pantallas pequeñas antes que en escritorio

### DevOps
- **Contenerización:** Docker multietapa + Docker Compose. Un servicio por pieza (backend, frontend, PostgreSQL, reverse proxy), con volúmenes nombrados para que los datos sobrevivan al reinicio de los contenedores. La etapa de build queda separada de la de runtime para que la imagen final no cargue dependencias de desarrollo
- **CI/CD:** GitHub Actions. En cada push y pull request: instalación de dependencias, linter, pruebas y build de la imagen. En la rama principal, además, publicación de la imagen en GHCR etiquetada con el SHA del commit (no solo `latest`), que es lo que permite volver a una versión anterior sin reconstruir nada
- **Despliegue:** Traefik o Caddy como reverse proxy, con HTTPS automático vía Let's Encrypt y renovación sin intervención manual
- **Backup:** dump programado de PostgreSQL con restauración probada al menos una vez sobre un entorno limpio, documentada en `docs/backup.md`. Un backup que nunca se restauró no cuenta como backup
- **Rollback:** desplegar la etiqueta anterior de la imagen y verificar que las migraciones de base de datos sean reversibles, para que revertir no implique perder pedidos ni movimientos de inventario

## Cómo levantar el proyecto

En construcción — los pasos de abajo son el plan objetivo; los puertos, el `.env.example` y el comando de migraciones se completan cuando el backend esté listo.

**Requisitos:** Node.js 22 LTS, Docker, Docker Compose y Git.

```bash
# 1. Clonar el repositorio
git clone https://github.com/4ndresFel1pe/Natutech.git
cd Natutech

# 2. Copiar las variables de entorno de ejemplo y ajustarlas
cp .env.example .env

# 3. Levantar todo el stack
docker compose up -d --build

# 4. Ver el estado de los servicios
docker compose ps
```

Una vez arriba:

| Servicio | URL local |
|---|---|
| Catálogo público | http://localhost:[puerto] |
| Panel de administrador | http://localhost:[puerto]/admin |
| API | http://localhost:[puerto]/api |

Para detener todo: `docker compose down` (agregar `-v` solo si se quiere borrar también la base de datos).

## Estructura de carpetas

Propuesta inicial (ajústala según el framework que elijan):

```
frontend/
├── public/
│   └── favicon, imágenes estáticas
├── src/
│   ├── assets/          # imágenes, íconos
│   ├── components/      # componentes reutilizables (cards, botones, etc.)
│   ├── pages/
│   │   ├── Catalogo/    # vista pública
│   │   ├── Admin/
│   │   │   ├── Productos/
│   │   │   ├── Pedidos/
│   │   │   └── Proveedores/
│   │   ├── Alertas/     # alertas de reabastecimiento
│   │   └── Reportes/
│   ├── services/        # llamadas a la API (fetch/axios)
│   ├── context/         # manejo de sesión/autenticación (JWT)
│   ├── hooks/
│   ├── styles/
│   └── App.jsx
├── .env                 # URL de la API, variables de entorno
├── package.json
└── README.md
```
