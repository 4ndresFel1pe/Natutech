# Natutech
Catálogo, inventario y alertas de reabastecimiento estacional para un vivero/floristería en Yopal, Casanare.



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

##FRONTED Y EXPERIENCIA

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
