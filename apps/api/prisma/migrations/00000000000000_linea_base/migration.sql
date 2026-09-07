-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'CE', 'PASAPORTE', 'PPT', 'NIT');

-- CreateEnum
CREATE TYPE "TipoAgrupacion" AS ENUM ('TORRE', 'MANZANA', 'ETAPA', 'BLOQUE', 'INTERIOR');

-- CreateEnum
CREATE TYPE "NaturalezaParqueadero" AS ENUM ('PRIVADO', 'USO_EXCLUSIVO', 'ROTATIVO', 'VISITANTES');

-- CreateEnum
CREATE TYPE "OrigenAsignacion" AS ENUM ('PROPIEDAD', 'REGLAMENTO', 'SORTEO', 'PRESTAMO', 'ARRIENDO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('SOLICITADA', 'CONFIRMADA', 'CANCELADA', 'CUMPLIDA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "TipoZonaComun" AS ENUM ('SALON_COMUNAL', 'BBQ', 'PISCINA', 'GIMNASIO', 'CANCHA', 'PARQUE_INFANTIL', 'ZONA_HUMEDA', 'COWORKING', 'SALA_CINE', 'TERRAZA', 'ZONA_MASCOTAS', 'PORTERIA', 'OTRA');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('APARTAMENTO', 'APARTAESTUDIO', 'CASA', 'DUPLEX', 'TRIPLEX', 'PENTHOUSE', 'LOCAL', 'OFICINA', 'CONSULTORIO', 'BODEGA', 'PARQUEADERO', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "RelacionUnidad" AS ENUM ('PROPIETARIO', 'ARRENDATARIO', 'RESIDENTE_AUTORIZADO');

-- CreateEnum
CREATE TYPE "AmbitoRol" AS ENUM ('PLATAFORMA', 'CONJUNTO');

-- CreateEnum
CREATE TYPE "EstadoConjunto" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "TipoEncomienda" AS ENUM ('PAQUETE', 'CORRESPONDENCIA', 'CERTIFICADO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEncomienda" AS ENUM ('RECIBIDA', 'NOTIFICADA', 'ENTREGADA', 'DEVUELTA');

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
    "latitud" DECIMAL(8,6),
    "longitud" DECIMAL(9,6),
    "estado" "EstadoConjunto" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agrupaciones" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "padreId" UUID,
    "tipo" "TipoAgrupacion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agrupaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "agrupacionId" UUID,
    "identificador" TEXT NOT NULL,
    "tipo" "TipoUnidad" NOT NULL DEFAULT 'APARTAMENTO',
    "tipologiaId" UUID,
    "coeficiente" DECIMAL(9,6),
    "areaM2" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_zona_comun" (
    "id" UUID NOT NULL,
    "zonaComunId" UUID NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "apertura" INTEGER NOT NULL,
    "cierre" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horarios_zona_comun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parqueaderos" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "agrupacionId" UUID,
    "naturaleza" "NaturalezaParqueadero" NOT NULL,
    "identificador" TEXT NOT NULL,
    "unidadId" UUID,
    "admiteCarro" BOOLEAN NOT NULL DEFAULT true,
    "admiteMoto" BOOLEAN NOT NULL DEFAULT false,
    "cubierto" BOOLEAN NOT NULL DEFAULT false,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parqueaderos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_parqueadero" (
    "id" UUID NOT NULL,
    "parqueaderoId" UUID NOT NULL,
    "unidadId" UUID NOT NULL,
    "origen" "OrigenAsignacion" NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_parqueadero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espacios_reservables" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 1,
    "zonaComunId" UUID,
    "naturalezaParqueadero" "NaturalezaParqueadero",
    "agrupacionId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espacios_reservables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_reserva" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "espacioId" UUID NOT NULL,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "anticipacionMinimaHoras" INTEGER,
    "anticipacionMaximaDias" INTEGER,
    "duracionMinimaMinutos" INTEGER,
    "duracionMaximaMinutos" INTEGER,
    "maxSimultaneasPorUnidad" INTEGER,
    "maxMensualesPorUnidad" INTEGER,
    "soloPropietarios" BOOLEAN NOT NULL DEFAULT false,
    "bloqueaConMora" BOOLEAN NOT NULL DEFAULT false,
    "cancelacionMinimaHoras" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicas_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "espacioId" UUID NOT NULL,
    "unidadId" UUID NOT NULL,
    "solicitadaPorId" UUID NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "estado" "EstadoReserva" NOT NULL DEFAULT 'SOLICITADA',
    "invitadoId" UUID,
    "parqueaderoId" UUID,
    "placa" TEXT,
    "aprobadaPorId" UUID,
    "aprobadaEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipologias" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaM2" DECIMAL(8,2) NOT NULL,
    "habitaciones" INTEGER NOT NULL,
    "banos" INTEGER NOT NULL,
    "descripcion" TEXT,
    "planoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipologias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas_comunes" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "agrupacionId" UUID,
    "tipo" "TipoZonaComun" NOT NULL,
    "nombre" TEXT NOT NULL,
    "reservable" BOOLEAN NOT NULL DEFAULT false,
    "aforo" INTEGER,
    "reglasUso" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zonas_comunes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "nombres" TEXT,
    "apellidos" TEXT,
    "tipoDocumento" "TipoDocumento",
    "numeroDocumento" TEXT,
    "telefono" TEXT,
    "celular" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_conjuntos" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_conjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID,
    "codigo" TEXT NOT NULL,
    "ambito" "AmbitoRol" NOT NULL DEFAULT 'CONJUNTO',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "asignable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "ambito" "AmbitoRol" NOT NULL DEFAULT 'CONJUNTO',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "moduloId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "rolId" UUID NOT NULL,
    "permisoId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateTable
CREATE TABLE "usuario_conjunto_roles" (
    "id" UUID NOT NULL,
    "usuarioConjuntoId" UUID NOT NULL,
    "rolId" UUID NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "asignadoPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_conjunto_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_unidades" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadId" UUID NOT NULL,
    "relacion" "RelacionUnidad" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casilleros" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "agrupacionId" UUID,
    "identificador" TEXT NOT NULL,
    "unidadId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casilleros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encomiendas" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "unidadId" UUID,
    "agrupacionId" UUID,
    "destinatario" TEXT,
    "tipo" "TipoEncomienda" NOT NULL,
    "remitente" TEXT,
    "casilleroId" UUID,
    "estado" "EstadoEncomienda" NOT NULL DEFAULT 'RECIBIDA',
    "recibidaPorId" UUID NOT NULL,
    "recibidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificadaEn" TIMESTAMP(3),
    "retiradaPorNombre" TEXT,
    "entregadaPorId" UUID,
    "entregadaEn" TIMESTAMP(3),
    "observacion" TEXT,
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encomiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitados" (
    "id" UUID NOT NULL,
    "conjuntoId" UUID NOT NULL,
    "unidadId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento",
    "numeroDocumento" TEXT,
    "telefono" TEXT,
    "placa" TEXT,
    "invitadoPorId" UUID NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_plataforma" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "rolId" UUID NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "otorgadoPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conjuntos_nit_key" ON "conjuntos"("nit");

-- CreateIndex
CREATE INDEX "agrupaciones_conjuntoId_idx" ON "agrupaciones"("conjuntoId");

-- CreateIndex
CREATE INDEX "agrupaciones_padreId_idx" ON "agrupaciones"("padreId");

-- CreateIndex
CREATE UNIQUE INDEX "agrupaciones_conjuntoId_nombre_key" ON "agrupaciones"("conjuntoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "agrupaciones_id_conjuntoId_key" ON "agrupaciones"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "unidades_conjuntoId_idx" ON "unidades"("conjuntoId");

-- CreateIndex
CREATE INDEX "unidades_agrupacionId_idx" ON "unidades"("agrupacionId");

-- CreateIndex
CREATE INDEX "unidades_tipologiaId_idx" ON "unidades"("tipologiaId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_conjuntoId_agrupacionId_identificador_key" ON "unidades"("conjuntoId", "agrupacionId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_id_conjuntoId_key" ON "unidades"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "horarios_zona_comun_zonaComunId_idx" ON "horarios_zona_comun"("zonaComunId");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_zona_comun_zonaComunId_dia_apertura_key" ON "horarios_zona_comun"("zonaComunId", "dia", "apertura");

-- CreateIndex
CREATE INDEX "parqueaderos_conjuntoId_idx" ON "parqueaderos"("conjuntoId");

-- CreateIndex
CREATE INDEX "parqueaderos_agrupacionId_idx" ON "parqueaderos"("agrupacionId");

-- CreateIndex
CREATE UNIQUE INDEX "parqueaderos_conjuntoId_identificador_key" ON "parqueaderos"("conjuntoId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "parqueaderos_id_conjuntoId_key" ON "parqueaderos"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "asignaciones_parqueadero_parqueaderoId_idx" ON "asignaciones_parqueadero"("parqueaderoId");

-- CreateIndex
CREATE INDEX "asignaciones_parqueadero_unidadId_idx" ON "asignaciones_parqueadero"("unidadId");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_parqueadero_parqueaderoId_unidadId_desde_key" ON "asignaciones_parqueadero"("parqueaderoId", "unidadId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "espacios_reservables_zonaComunId_key" ON "espacios_reservables"("zonaComunId");

-- CreateIndex
CREATE INDEX "espacios_reservables_conjuntoId_idx" ON "espacios_reservables"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "espacios_reservables_conjuntoId_nombre_key" ON "espacios_reservables"("conjuntoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "espacios_reservables_id_conjuntoId_key" ON "espacios_reservables"("id", "conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_reserva_espacioId_key" ON "politicas_reserva"("espacioId");

-- CreateIndex
CREATE INDEX "politicas_reserva_conjuntoId_idx" ON "politicas_reserva"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_reserva_espacioId_conjuntoId_key" ON "politicas_reserva"("espacioId", "conjuntoId");

-- CreateIndex
CREATE INDEX "reservas_conjuntoId_idx" ON "reservas"("conjuntoId");

-- CreateIndex
CREATE INDEX "reservas_espacioId_inicio_idx" ON "reservas"("espacioId", "inicio");

-- CreateIndex
CREATE INDEX "reservas_unidadId_idx" ON "reservas"("unidadId");

-- CreateIndex
CREATE INDEX "reservas_conjuntoId_fin_idx" ON "reservas"("conjuntoId", "fin");

-- CreateIndex
CREATE INDEX "reservas_parqueaderoId_idx" ON "reservas"("parqueaderoId");

-- CreateIndex
CREATE INDEX "tipologias_conjuntoId_idx" ON "tipologias"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "tipologias_conjuntoId_nombre_key" ON "tipologias"("conjuntoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipologias_id_conjuntoId_key" ON "tipologias"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "zonas_comunes_conjuntoId_idx" ON "zonas_comunes"("conjuntoId");

-- CreateIndex
CREATE INDEX "zonas_comunes_agrupacionId_idx" ON "zonas_comunes"("agrupacionId");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_comunes_conjuntoId_nombre_key" ON "zonas_comunes"("conjuntoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_comunes_id_conjuntoId_key" ON "zonas_comunes"("id", "conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tipoDocumento_numeroDocumento_key" ON "usuarios"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "usuarios_conjuntos_conjuntoId_idx" ON "usuarios_conjuntos"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_conjuntos_usuarioId_conjuntoId_key" ON "usuarios_conjuntos"("usuarioId", "conjuntoId");

-- CreateIndex
CREATE INDEX "roles_conjuntoId_idx" ON "roles"("conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_conjuntoId_codigo_key" ON "roles"("conjuntoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_codigo_key" ON "modulos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_moduloId_idx" ON "permisos"("moduloId");

-- CreateIndex
CREATE INDEX "roles_permisos_permisoId_idx" ON "roles_permisos"("permisoId");

-- CreateIndex
CREATE INDEX "usuario_conjunto_roles_usuarioConjuntoId_idx" ON "usuario_conjunto_roles"("usuarioConjuntoId");

-- CreateIndex
CREATE INDEX "usuario_conjunto_roles_rolId_idx" ON "usuario_conjunto_roles"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_conjunto_roles_usuarioConjuntoId_rolId_desde_key" ON "usuario_conjunto_roles"("usuarioConjuntoId", "rolId", "desde");

-- CreateIndex
CREATE INDEX "usuarios_unidades_unidadId_idx" ON "usuarios_unidades"("unidadId");

-- CreateIndex
CREATE INDEX "usuarios_unidades_usuarioId_idx" ON "usuarios_unidades"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_unidades_usuarioId_unidadId_relacion_desde_key" ON "usuarios_unidades"("usuarioId", "unidadId", "relacion", "desde");

-- CreateIndex
CREATE INDEX "casilleros_conjuntoId_idx" ON "casilleros"("conjuntoId");

-- CreateIndex
CREATE INDEX "casilleros_agrupacionId_idx" ON "casilleros"("agrupacionId");

-- CreateIndex
CREATE UNIQUE INDEX "casilleros_conjuntoId_identificador_key" ON "casilleros"("conjuntoId", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "casilleros_unidadId_conjuntoId_key" ON "casilleros"("unidadId", "conjuntoId");

-- CreateIndex
CREATE UNIQUE INDEX "casilleros_id_conjuntoId_key" ON "casilleros"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "encomiendas_conjuntoId_estado_idx" ON "encomiendas"("conjuntoId", "estado");

-- CreateIndex
CREATE INDEX "encomiendas_unidadId_idx" ON "encomiendas"("unidadId");

-- CreateIndex
CREATE INDEX "encomiendas_agrupacionId_idx" ON "encomiendas"("agrupacionId");

-- CreateIndex
CREATE INDEX "encomiendas_casilleroId_idx" ON "encomiendas"("casilleroId");

-- CreateIndex
CREATE INDEX "invitados_conjuntoId_hasta_idx" ON "invitados"("conjuntoId", "hasta");

-- CreateIndex
CREATE INDEX "invitados_unidadId_idx" ON "invitados"("unidadId");

-- CreateIndex
CREATE INDEX "invitados_numeroDocumento_idx" ON "invitados"("numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "invitados_id_conjuntoId_key" ON "invitados"("id", "conjuntoId");

-- CreateIndex
CREATE INDEX "usuarios_plataforma_usuarioId_hasta_idx" ON "usuarios_plataforma"("usuarioId", "hasta");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_plataforma_usuarioId_rolId_desde_key" ON "usuarios_plataforma"("usuarioId", "rolId", "desde");

-- AddForeignKey
ALTER TABLE "agrupaciones" ADD CONSTRAINT "agrupaciones_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agrupaciones" ADD CONSTRAINT "agrupaciones_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "agrupaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_agrupacionId_conjuntoId_fkey" FOREIGN KEY ("agrupacionId", "conjuntoId") REFERENCES "agrupaciones"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tipologiaId_conjuntoId_fkey" FOREIGN KEY ("tipologiaId", "conjuntoId") REFERENCES "tipologias"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "horarios_zona_comun" ADD CONSTRAINT "horarios_zona_comun_zonaComunId_fkey" FOREIGN KEY ("zonaComunId") REFERENCES "zonas_comunes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parqueaderos" ADD CONSTRAINT "parqueaderos_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parqueaderos" ADD CONSTRAINT "parqueaderos_agrupacionId_conjuntoId_fkey" FOREIGN KEY ("agrupacionId", "conjuntoId") REFERENCES "agrupaciones"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parqueaderos" ADD CONSTRAINT "parqueaderos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_parqueadero" ADD CONSTRAINT "asignaciones_parqueadero_parqueaderoId_fkey" FOREIGN KEY ("parqueaderoId") REFERENCES "parqueaderos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_parqueadero" ADD CONSTRAINT "asignaciones_parqueadero_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios_reservables" ADD CONSTRAINT "espacios_reservables_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios_reservables" ADD CONSTRAINT "espacios_reservables_zonaComunId_fkey" FOREIGN KEY ("zonaComunId") REFERENCES "zonas_comunes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios_reservables" ADD CONSTRAINT "espacios_reservables_agrupacionId_fkey" FOREIGN KEY ("agrupacionId") REFERENCES "agrupaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_reserva" ADD CONSTRAINT "politicas_reserva_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_reserva" ADD CONSTRAINT "politicas_reserva_espacioId_conjuntoId_fkey" FOREIGN KEY ("espacioId", "conjuntoId") REFERENCES "espacios_reservables"("id", "conjuntoId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_espacioId_conjuntoId_fkey" FOREIGN KEY ("espacioId", "conjuntoId") REFERENCES "espacios_reservables"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_invitadoId_conjuntoId_fkey" FOREIGN KEY ("invitadoId", "conjuntoId") REFERENCES "invitados"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_parqueaderoId_conjuntoId_fkey" FOREIGN KEY ("parqueaderoId", "conjuntoId") REFERENCES "parqueaderos"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipologias" ADD CONSTRAINT "tipologias_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_comunes" ADD CONSTRAINT "zonas_comunes_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_comunes" ADD CONSTRAINT "zonas_comunes_agrupacionId_fkey" FOREIGN KEY ("agrupacionId") REFERENCES "agrupaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_conjuntos" ADD CONSTRAINT "usuarios_conjuntos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_conjuntos" ADD CONSTRAINT "usuarios_conjuntos_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_conjunto_roles" ADD CONSTRAINT "usuario_conjunto_roles_usuarioConjuntoId_fkey" FOREIGN KEY ("usuarioConjuntoId") REFERENCES "usuarios_conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_conjunto_roles" ADD CONSTRAINT "usuario_conjunto_roles_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_conjunto_roles" ADD CONSTRAINT "usuario_conjunto_roles_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_unidades" ADD CONSTRAINT "usuarios_unidades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_unidades" ADD CONSTRAINT "usuarios_unidades_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casilleros" ADD CONSTRAINT "casilleros_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casilleros" ADD CONSTRAINT "casilleros_agrupacionId_conjuntoId_fkey" FOREIGN KEY ("agrupacionId", "conjuntoId") REFERENCES "agrupaciones"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "casilleros" ADD CONSTRAINT "casilleros_unidadId_conjuntoId_fkey" FOREIGN KEY ("unidadId", "conjuntoId") REFERENCES "unidades"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_unidadId_conjuntoId_fkey" FOREIGN KEY ("unidadId", "conjuntoId") REFERENCES "unidades"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_agrupacionId_conjuntoId_fkey" FOREIGN KEY ("agrupacionId", "conjuntoId") REFERENCES "agrupaciones"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_casilleroId_conjuntoId_fkey" FOREIGN KEY ("casilleroId", "conjuntoId") REFERENCES "casilleros"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_recibidaPorId_fkey" FOREIGN KEY ("recibidaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_entregadaPorId_fkey" FOREIGN KEY ("entregadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_unidadId_conjuntoId_fkey" FOREIGN KEY ("unidadId", "conjuntoId") REFERENCES "unidades"("id", "conjuntoId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_invitadoPorId_fkey" FOREIGN KEY ("invitadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_plataforma" ADD CONSTRAINT "usuarios_plataforma_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_plataforma" ADD CONSTRAINT "usuarios_plataforma_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_plataforma" ADD CONSTRAINT "usuarios_plataforma_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
