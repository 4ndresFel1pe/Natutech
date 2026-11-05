# Despliegue en el servidor

Cómo se publica Natutech en internet y cómo se mantiene. La razón de cada elección está en la [decisión D16](decisiones.md#d16-despliegue-una-máquina-virtual-con-el-mismo-compose-y-caddy-para-https).

**Dirección pública:** https://natutech.lat

```
Internet ──► proxy (Caddy 2.11, puertos 80 y 443) ── HTTPS con certificado automático
                │
                ▼
             web (nginx 1.27) ── sirve web/ y reenvía /api/* ──► api (Node 22 + Fastify 5) ── SQL ──► db (PostgreSQL 16)
```

Solo Caddy publica puertos. nginx, la API y la base se ven únicamente dentro de la red interna de Compose.

## Qué se necesita

| Pieza | Valor usado |
|---|---|
| Servidor | Instancia EC2 de AWS (plan gratuito), región us-east-1, Ubuntu Server 24.04 LTS, tipo t3.small (2 vCPU, 2 GiB), disco de 20 GiB |
| Dirección | IP elástica: no cambia aunque la instancia se apague y se vuelva a encender |
| Puertos abiertos (security group) | 22 (SSH, solo con llave), 80 y 443 |
| Dominio | `natutech.lat` en Porkbun, con dos registros A (raíz y `www`) que apuntan a la IP pública del servidor |
| Software | Docker Engine con Compose 2.24 o superior (por `!reset` en `docker-compose.prod.yml`) |

## 1. Entrar al servidor

Desde Git Bash, en el computador que tiene la llave:

```bash
ssh -i ~/.ssh/natutech_servidor ubuntu@IP_DEL_SERVIDOR
```

- `-i ~/.ssh/natutech_servidor`: la llave privada con la que se entra. El servidor no acepta contraseñas.
- `ubuntu@…`: el usuario que traen las instancias Ubuntu de AWS y la dirección del servidor.

La primera vez pregunta si confía en el servidor: escriba `yes`.

## 2. Instalar Docker (una sola vez)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

- `curl -fsSL URL`: descarga el instalador oficial de Docker. `-f` falla si el servidor responde con error, `-s` oculta la barra de progreso, `-S` muestra los errores aunque se use `-s` y `-L` sigue las redirecciones.
- `| sudo sh`: ejecuta el instalador como administrador. Instala Docker Engine y Compose, y deja Docker configurado para arrancar con la máquina.
- `usermod -aG docker $USER`: agrega su usuario al grupo `docker` para usar `docker` sin `sudo`. `-a` agrega sin quitarle otros grupos y `-G` indica el grupo.
- `exit`: cierra la sesión. El grupo nuevo se aplica al volver a entrar (paso 1).

Comprobación, después de entrar de nuevo:

```bash
docker compose version
```

Debe mostrar `Docker Compose version v2.…`, con versión 2.24 o superior.

## 3. Descargar el proyecto

```bash
git clone https://github.com/4ndresFel1pe/Natutech.git
cd Natutech
```

## 4. Crear el `.env` del servidor

Los secretos se generan aquí mismo y no salen del servidor. En la contraseña del administrador use solo letras, números y guiones.

```bash
read -p "Dominio (por ejemplo natutech.lat): " DOMINIO
read -p "Correo del administrador: " ADMIN_CORREO
read -s -p "Contraseña del administrador: " ADMIN_CONTRASENA; echo
cat > .env <<EOF
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
DOMINIO=$DOMINIO
POSTGRES_USER=natutech
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=natutech
JWT_SECRETO=$(openssl rand -hex 32)
JWT_EXPIRA_EN=8h
CORS_ORIGENES=https://$DOMINIO
SEMBRAR_DATOS_EJEMPLO=si
HORAS_ENTRE_ALERTAS=6
ADMIN_NOMBRE=Administración del vivero
ADMIN_CORREO=$ADMIN_CORREO
ADMIN_CONTRASENA=$ADMIN_CONTRASENA
WHATSAPP_NUMERO=
EOF
chmod 600 .env
unset ADMIN_CONTRASENA
```

- `read -p "texto" VARIABLE`: muestra el texto y guarda en `VARIABLE` lo que usted escriba. Con `-s` no se ve lo que escribe. Como el valor no hace parte del comando, **no queda en el historial** de la terminal.
- `cat > .env <<EOF … EOF`: escribe en `.env` todo lo que va entre las dos marcas `EOF` y reemplaza `$VARIABLE` y `$(comando)` por su valor.
- `openssl rand -hex 24`: genera 24 bytes al azar escritos en hexadecimal (48 caracteres). Con `32` se genera el secreto de los tokens JWT.
- `COMPOSE_FILE=…`: hace que `docker compose` use siempre los dos archivos en este servidor, sin escribir `-f`.
- `chmod 600 .env`: solo el dueño del archivo puede leerlo y modificarlo.
- `unset ADMIN_CONTRASENA`: borra la contraseña de la memoria de la terminal.

**Nunca** muestre `.env` con el proyector encendido.

## 5. Levantar el sistema

```bash
docker compose up -d --build
docker compose ps
```

- `up`: crea y arranca los servicios. `-d` los deja corriendo en segundo plano y `--build` construye la imagen de la API con el código actual.
- `ps`: muestra el estado de cada servicio. `db` y `api` deben decir `healthy`; `web` y `proxy`, `Up`.

En el primer arranque, la API aplica las migraciones, carga los datos de ejemplo y crea el administrador. Caddy pide el certificado en los primeros segundos. Para comprobarlo:

```bash
docker compose logs proxy --tail 30
```

Debe aparecer `certificate obtained successfully`. Luego, desde cualquier computador:

```bash
curl https://natutech.lat/api/salud
# {"estado":"ok","base_de_datos":"ok","version":"0.4.0"}
```

## 6. Crear la cuenta de la empleada

```bash
read -s -p "Contraseña de la empleada: " CLAVE; echo
docker compose exec -e NUEVA_CONTRASENA="$CLAVE" api node scripts/crear-usuario.js --nombre "Empleada de prueba" --correo empleada@natutech.lat
unset CLAVE
```

- `exec api …`: ejecuta un comando dentro del contenedor de la API, que ya está corriendo.
- `-e NUEVA_CONTRASENA="$CLAVE"`: le pasa la contraseña al script como variable de entorno. En el historial queda escrito `$CLAVE`, no la contraseña.
- Para crear otro administrador, agregue `--rol administrador`.

Las cuentas de prueba para la evaluación se entregan al docente por un medio privado, nunca en el repositorio.

## Operación diaria

| Para… | Comando |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los registros de un servicio | `docker compose logs api --tail 50` (o `db`, `web`, `proxy`); con `-f` se siguen en vivo |
| Reiniciar sin perder datos | `docker compose restart` |
| Publicar una versión nueva | `git pull` y luego `docker compose up -d --build` |
| Apagar todo (los datos quedan) | `docker compose down` |

Los datos viven en el volumen `natutech_datos_postgres` y los certificados en `natutech_datos_caddy`. Sobreviven a `restart`, a `down` y al reinicio de la máquina (`sudo reboot`), porque Docker arranca con el sistema y los servicios tienen `restart: unless-stopped`.

**Nunca** ejecute `docker compose down -v` en el servidor: `-v` borra los volúmenes, es decir, la base de datos y los certificados.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| Compose dice `Falta … en .env` | Falta esa variable en `.env` (paso 4) |
| `api` no llega a `healthy` | `docker compose logs api`: casi siempre es la conexión con la base o una variable |
| El navegador no abre el dominio | `nslookup natutech.lat` debe dar la IP del servidor; en el security group de AWS deben estar abiertos los puertos 80 y 443 |
| Caddy no obtiene el certificado | `docker compose logs proxy`: el dominio debe apuntar ya al servidor y el puerto 80 debe estar abierto |
| `/api/salud` responde `"base_de_datos":"sin_conexion"` | `docker compose ps db` y `docker compose logs db` |

## Pendiente

- Respaldos con `pg_dump` y una restauración probada.
- Despliegue automático desde GitHub Actions y rollback verificado.
