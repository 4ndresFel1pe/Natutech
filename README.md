# Natutech
Catálogo, inventario y alertas de reabastecimiento estacional para un vivero/floristería en Yopal, Casanare.

## Equipo

| Integrante | Rol |
|---|---|
| Brayan David Roa Vega | Líder técnico |
| Andres Felipe Gomez Gutierrez | Backend y datos |
| Andres Felipe Abril Lopez | Frontend y experiencia |
| Joan Sebastián Berbesi Burgos | DevOps y calidad |

### Ruta elegida: A — Contenerización y DevOps

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
- **Catálogo público** (sin login onligatorio): productos, fotos, precio, disponibilidad, 
  con botón directo a WhatsApp para concluir la venta (sin pasarela de pago)
- **Panel de administrador** (autenticado): CRUD de catálogo, pedidos, 
  proveedores y alertas de reabastecimiento
- **Alertas de reabastecimiento**: comparación de stock actual contra 
  ventas históricas antes de cada fecha estacional clave
- **Reportes**: ventas por periodo, productos más vendidos, año contra año

## Arquitectura
- **Backend:** (Sujeto a cambios) [Express / Fastify] + PostgreSQL — elegido por ser liviano 
  y suficiente para el volumen de datos de un solo negocio
- **Frontend:** [por definir] — pensado para que el dueño lo use desde 
  el celular en el mostrador, su computador y que de esta misma forma accedan los clientes.
- **Autenticación:** JWT con contraseñas cifradas (bcrypt), dos niveles 
  de acceso: público (solo lectura) y administrador
- **Contenerización:** Docker multietapa + Docker Compose
- **CI/CD:** GitHub Actions → build, pruebas, publicación en GHCR
- **Despliegue:** Traefik/Caddy con HTTPS vía Let's Encrypt
- Los últimos dos ítems están sujetos a cambios.

## Fronted Y Experiencias

## 🏗️ Arquitectura (parte frontend)

- **Framework**: por definir. Debe funcionar bien tanto en celular (el dueño lo usará desde el mostrador) como en computador, y ser accesible también para los clientes que solo consultan el catálogo.
- **Autenticación**: el backend entrega un JWT. El frontend debe manejar dos niveles de acceso:
  - **Público**: solo lectura (catálogo).
  - **Administrador**: acceso completo tras iniciar sesión.
- **Consumo de API**: todas las pantallas consumen los endpoints REST expuestos por el backend (Express/Fastify).
- **Diseño**: mobile-first — prioriza que se vea y funcione bien en pantallas pequeñas antes que en escritorio.

> ⚠️ El framework específico y algunos detalles de despliegue (contenerización, CI/CD) están sujetos a cambios, según lo defina el equipo.

---

## 📁 Estructura de carpetas

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
