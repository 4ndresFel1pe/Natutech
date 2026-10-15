// GET /salud: lo consulta el HEALTHCHECK del contenedor. Sin datos del negocio.
export default async function rutasSalud(app, { db, version }) {
  app.get("/salud", async (request, reply) => {
    try {
      await db.query("SELECT 1");
      return { estado: "ok", base_de_datos: "ok", version };
    } catch {
      reply.code(503);
      return { estado: "degradado", base_de_datos: "sin_conexion", version };
    }
  });
}
