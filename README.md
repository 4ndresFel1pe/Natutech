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
