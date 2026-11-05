-- Natutech · Migración 002 · Pagos en línea con Wompi (Entrega 4, decisión D17)
-- La venta se sigue cerrando por WhatsApp (D2). El vivero puede generar un enlace de
-- pago para un pedido y mandárselo al cliente; Wompi avisa el resultado.
-- Un pedido puede tener varios intentos de pago, cada uno con su propia referencia.

CREATE TYPE estado_pago AS ENUM ('pendiente', 'aprobado', 'rechazado', 'anulado', 'error');

CREATE TABLE pago (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES pedido (id) ON DELETE RESTRICT,
  -- Referencia que se le manda a Wompi y que vuelve en cada aviso: así se sabe de qué pago es.
  referencia      varchar(40) NOT NULL UNIQUE,
  -- Pesos colombianos, copiados del total del pedido al generar el enlace.
  monto           integer NOT NULL CHECK (monto > 0),
  estado          estado_pago NOT NULL DEFAULT 'pendiente',
  -- Identificador de la transacción en Wompi. Único: el mismo aviso repetido no crea otro pago.
  transaccion_id  varchar(60) UNIQUE,
  metodo          varchar(30),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pago_pedido ON pago (pedido_id, creado_en DESC);

-- Un pedido no puede tener dos pagos aprobados.
CREATE UNIQUE INDEX idx_pago_un_aprobado ON pago (pedido_id) WHERE estado = 'aprobado';

CREATE TRIGGER marcar_pago BEFORE UPDATE ON pago FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();
