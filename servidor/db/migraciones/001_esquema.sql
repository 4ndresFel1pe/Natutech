-- Natutech · Migración 001 · Esquema inicial
-- Implementa docs/modelo-datos.md: mismos nombres, tipos, restricciones e índices.
-- Las fechas con hora son timestamptz: se guardan como instante absoluto y se
-- muestran en hora de Colombia, sin depender de la zona horaria del servidor.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE luz AS ENUM ('baja', 'media', 'alta');
CREATE TYPE cuidado AS ENUM ('facil', 'intermedio', 'avanzado');
CREATE TYPE canal_pedido AS ENUM ('whatsapp', 'tienda');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'confirmado', 'entregado', 'cancelado');
CREATE TYPE tipo_alerta AS ENUM ('stock_minimo', 'temporada');
CREATE TYPE estado_alerta AS ENUM ('activa', 'atendida', 'descartada');
CREATE TYPE rol_usuario AS ENUM ('administrador', 'empleado');

-- Mantiene actualizado_en al día en cada UPDATE, sin depender de la aplicación.
CREATE FUNCTION marcar_actualizacion() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE categoria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         varchar(40) NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 40),
  descripcion    varchar(200),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_categoria_nombre ON categoria (lower(nombre));

CREATE TABLE proveedor (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         varchar(80) NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
  telefono       varchar(17) NOT NULL CHECK (telefono ~ '^\+57 \d{3} \d{3} \d{4}$'),
  municipio      varchar(60) NOT NULL CHECK (char_length(municipio) BETWEEN 3 AND 60),
  suministra     varchar(120),
  dias_entrega   smallint NOT NULL DEFAULT 3 CHECK (dias_entrega BETWEEN 0 AND 60),
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE producto (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id        uuid NOT NULL REFERENCES categoria (id) ON DELETE RESTRICT,
  proveedor_id        uuid REFERENCES proveedor (id) ON DELETE SET NULL,
  nombre              varchar(80) NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
  nombre_cientifico   varchar(120),
  descripcion         text CHECK (char_length(descripcion) <= 600),
  presentacion        varchar(60) NOT NULL CHECK (char_length(presentacion) >= 2),
  precio              integer NOT NULL CHECK (precio BETWEEN 0 AND 5000000),
  stock               integer NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 100000),
  stock_minimo        integer NOT NULL DEFAULT 5 CHECK (stock_minimo BETWEEN 0 AND 10000),
  luz                 luz,
  riego               varchar(60),
  cuidado             cuidado,
  imagen_url          varchar(300),
  visible_en_catalogo boolean NOT NULL DEFAULT true,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_producto_nombre ON producto (lower(nombre));
CREATE INDEX idx_producto_categoria ON producto (categoria_id);
CREATE INDEX idx_producto_proveedor ON producto (proveedor_id);

CREATE TABLE pedido (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre   varchar(80) NOT NULL CHECK (char_length(cliente_nombre) BETWEEN 2 AND 80),
  cliente_telefono varchar(17) NOT NULL CHECK (cliente_telefono ~ '^\+57 \d{3} \d{3} \d{4}$'),
  canal            canal_pedido NOT NULL DEFAULT 'whatsapp',
  estado           estado_pedido NOT NULL DEFAULT 'pendiente',
  fecha_entrega    date,
  nota             varchar(300),
  total            integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedido_creado_en ON pedido (creado_en DESC);

CREATE TABLE detalle_pedido (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
  producto_id     uuid NOT NULL REFERENCES producto (id) ON DELETE RESTRICT,
  cantidad        integer NOT NULL CHECK (cantidad BETWEEN 1 AND 1000),
  precio_unitario integer NOT NULL CHECK (precio_unitario >= 0),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_detalle_pedido UNIQUE (pedido_id, producto_id)
);
CREATE INDEX idx_detalle_producto ON detalle_pedido (producto_id);

CREATE TABLE temporada (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            varchar(60) NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 60),
  fecha             date NOT NULL,
  dias_anticipacion smallint NOT NULL DEFAULT 21 CHECK (dias_anticipacion BETWEEN 1 AND 90),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_temporada ON temporada (lower(nombre), fecha);
CREATE INDEX idx_temporada_fecha ON temporada (fecha);

CREATE TABLE alerta (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
  temporada_id     uuid REFERENCES temporada (id) ON DELETE CASCADE,
  tipo             tipo_alerta NOT NULL,
  stock_actual     integer NOT NULL CHECK (stock_actual >= 0),
  demanda_estimada integer CHECK (demanda_estimada >= 0),
  estado           estado_alerta NOT NULL DEFAULT 'activa',
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  -- Una alerta de temporada siempre dice cuál; una de stock mínimo nunca.
  CONSTRAINT ck_alerta_temporada CHECK ((tipo = 'temporada') = (temporada_id IS NOT NULL)),
  CONSTRAINT ck_alerta_demanda CHECK (tipo = 'temporada' OR demanda_estimada IS NULL)
);
-- El proceso de alertas corre varias veces al día: esto impide repetir la misma alerta activa.
CREATE UNIQUE INDEX uq_alerta_activa ON alerta (producto_id, tipo, temporada_id) NULLS NOT DISTINCT
  WHERE estado = 'activa';
CREATE INDEX idx_alerta_estado ON alerta (estado, creado_en DESC);

CREATE TABLE usuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          varchar(80) NOT NULL,
  correo          varchar(120) NOT NULL,
  contrasena_hash varchar(255) NOT NULL,
  rol             rol_usuario NOT NULL DEFAULT 'empleado',
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_usuario_correo ON usuario (lower(correo));

CREATE TRIGGER marcar_categoria BEFORE UPDATE ON categoria FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_proveedor BEFORE UPDATE ON proveedor FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_producto BEFORE UPDATE ON producto FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_pedido BEFORE UPDATE ON pedido FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_detalle BEFORE UPDATE ON detalle_pedido FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_temporada BEFORE UPDATE ON temporada FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_alerta BEFORE UPDATE ON alerta FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
CREATE TRIGGER marcar_usuario BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
