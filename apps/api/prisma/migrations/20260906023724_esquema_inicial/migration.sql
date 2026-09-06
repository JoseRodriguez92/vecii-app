-- CreateEnum
CREATE TYPE "RolMembresia" AS ENUM ('SUPER_ADMIN', 'ADMIN_CONJUNTO', 'CONSEJO', 'PROPIETARIO', 'RESIDENTE', 'PORTERIA');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('APARTAMENTO', 'CASA', 'LOCAL', 'PARQUEADERO', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "RelacionUnidad" AS ENUM ('PROPIETARIO', 'ARRENDATARIO', 'RESIDENTE_AUTORIZADO');

-- CreateEnum
CREATE TYPE "EstadoConjunto" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "conjuntos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "estado" "EstadoConjunto" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torres" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "torreId" UUID,
    "identificador" TEXT NOT NULL,
    "tipo" "TipoUnidad" NOT NULL DEFAULT 'APARTAMENTO',
    "coeficiente" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "areaM2" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombreCompleto" TEXT,
    "telefono" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "rol" "RolMembresia" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocupaciones_unidad" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadId" UUID NOT NULL,
    "relacion" "RelacionUnidad" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),

    CONSTRAINT "ocupaciones_unidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conjuntos_nit_key" ON "conjuntos"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "torres_conjuntoId_nombre_key" ON "torres"("conjuntoId", "nombre");

-- CreateIndex
CREATE INDEX "unidades_conjuntoId_idx" ON "unidades"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_conjuntoId_identificador_key" ON "unidades"("conjuntoId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "membresias_conjuntoId_idx" ON "membresias"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "membresias_usuarioId_conjuntoId_key" ON "membresias"("usuarioId", "conjuntoId");

-- CreateIndex
CREATE INDEX "ocupaciones_unidad_unidadId_idx" ON "ocupaciones_unidad"("unidadId");

-- CreateIndex
CREATE UNIQUE INDEX "ocupaciones_unidad_usuarioId_unidadId_relacion_key" ON "ocupaciones_unidad"("usuarioId", "unidadId", "relacion");

-- AddForeignKey
ALTER TABLE "torres" ADD CONSTRAINT "torres_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_torreId_fkey" FOREIGN KEY ("torreId") REFERENCES "torres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupaciones_unidad" ADD CONSTRAINT "ocupaciones_unidad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupaciones_unidad" ADD CONSTRAINT "ocupaciones_unidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
