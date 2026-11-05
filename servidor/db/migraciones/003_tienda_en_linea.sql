-- Natutech · Migración 003 · Tienda en línea (Entrega 4, decisión D18)
-- El cliente arma un carrito en el catálogo público y paga con Wompi. El pedido aparta
-- las unidades por un tiempo; si no se paga, se cancela solo y el stock vuelve.

-- Pedidos que llegan desde el carrito del catálogo público.
ALTER TYPE canal_pedido ADD VALUE IF NOT EXISTS 'web';

-- Enlace de pago que venció sin que el cliente pagara.
ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'vencido';

-- Hasta cuándo se apartan las unidades de un pedido de la tienda en línea sin pagar.
-- NULL en los pedidos que registra el personal: esos no vencen.
ALTER TABLE pedido ADD COLUMN reservado_hasta timestamptz;
CREATE INDEX idx_pedido_reservado_hasta ON pedido (reservado_hasta) WHERE reservado_hasta IS NOT NULL;

-- Vencimiento del enlace de Wompi (expiration-time). Se guarda para volver a armar el mismo
-- enlace con la misma firma de integridad.
ALTER TABLE pago ADD COLUMN vence_en timestamptz;
