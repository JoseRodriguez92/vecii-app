-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('ENCOMIENDA_RECIBIDA', 'INVITADO_AUTORIZADO', 'RESERVA_POR_APROBAR', 'RESERVA_APROBADA', 'RESERVA_RECHAZADA', 'RESERVA_PROXIMA');

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "conjunto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT,
    "entidad" TEXT,
    "entidad_id" UUID,
    "programada_para" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leida_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_conjunto_id_programada_para_idx" ON "notificaciones"("usuario_id", "conjunto_id", "programada_para");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Lo que Prisma no expresa
-- ---------------------------------------------------------------------------
-- El numerito rojo se pregunta en CADA pantalla, asi que la consulta que lo
-- calcula tiene que ser barata para siempre. Un indice parcial —solo sobre las
-- no leidas— se mantiene chico solo: cada aviso que alguien lee SALE del indice.
-- La tabla crece sin parar; este indice no.
CREATE INDEX notificacion_sin_leer
  ON notificaciones (usuario_id, conjunto_id)
  WHERE leida_en IS NULL;

-- Y RLS, como las otras 25. Sin esto la tabla la lee cualquiera con la llave
-- publicable, y aqui hay nombres de residentes y a que unidad llego que.
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;
