# Evidencias de la Entrega 4

Pruebas hechas sobre la aplicación desplegada en https://natutech.lat (instancia EC2 de AWS, versión 0.4.0 o posterior). Las letras (A a J) remiten a la lista de verificación de la guía de la Entrega 4. Todos los datos que aparecen son sintéticos.

| Archivo | Qué muestra | Puntos de la guía |
|---|---|---|
| `01-acceso-celular.png` | La aplicación abierta desde un celular con datos móviles, fuera de la red del equipo | A, G |
| `02-certificado-https.png` | El candado del navegador y el certificado válido emitido por Let's Encrypt | G, H |
| `03-redireccion-y-salud.png` | `http://` redirige a `https://` (308) y `/api/salud` responde `ok` con la versión | D, G |
| `04-contenedores.png` | `docker compose ps` en el servidor: `db` y `api` *healthy*; solo `proxy` publica los puertos 80 y 443 | F, G, H |
| `05-ingreso-administrador.png` | Ingreso al panel con la cuenta de administración | C |
| `06-control-acceso.png` | La empleada recibe `403 SIN_PERMISO` al borrar un producto; sin token, `401` | C, D, H |
| `07a-persistencia-creado.png` | Producto «Prueba persistencia» creado desde el panel | B |
| `07b-persistencia-reinicio.png` | `docker compose down` y `docker compose up -d`: se borran y se recrean los contenedores | B, F |
| `07c-persistencia-sigue.png` | El producto sigue ahí después de recrear los contenedores | B, G |
| `08a-pedido-creado.png` | Pedido registrado desde la pantalla de pedidos (navegador → API) | A, D |
| `08b-pedido-en-base.png` | El mismo pedido y el stock descontado, consultados en PostgreSQL | B |
| `09-contrasenas-hash.png` | Las contraseñas están guardadas con bcrypt (costo 12), no en texto | C, H |
| `10-base-caida.png` | Con la base detenida, `/api/salud` responde `503` de inmediato y la API sigue arriba; al encender la base se recupera sola | B, D |
| `11-reinicio-servidor.png` | Después de `sudo reboot`, todo vuelve a levantar solo | G |
| [`npm-audit.md`](npm-audit.md) | Auditoría de dependencias: 1 vulnerabilidad moderada corregida, 0 pendientes | H |

Lo que no se ve en capturas se demuestra en vivo en la sustentación. Los pasos para repetir cada prueba están en [`docs/despliegue.md`](../../despliegue.md).
