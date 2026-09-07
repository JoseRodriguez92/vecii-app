-- Las columnas pasan a snake_case, como las tablas.
--
-- ESCRITA A MANO, y hay que saber por que: Prisma no detecta renombres. Si se
-- le pide `migrate dev` despues de agregar los @map, ve 122 columnas que
-- desaparecen y 122 que aparecen, y genera DROP COLUMN + ADD COLUMN. Eso vacia
-- la base entera sin decir nada. RENAME COLUMN no mueve un solo dato.
--
-- Los indices y las llaves foraneas tambien se renombran, y no es cosmetica:
-- Prisma arma sus nombres por defecto con los nombres de COLUMNA. Si se dejan
-- como estan, la proxima migracion los ve distintos de lo que espera y trata de
-- arreglarlos sola.
--
-- Las cinco restricciones de la migracion anterior no aparecen aqui: Postgres
-- actualiza solo las expresiones de un CHECK y de un indice cuando la columna
-- que nombran se renombra.

-- 122 columnas -------------------------------------------------------

-- conjuntos
ALTER TABLE "conjuntos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "conjuntos" RENAME COLUMN "updatedAt" TO "updated_at";

-- agrupaciones
ALTER TABLE "agrupaciones" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "agrupaciones" RENAME COLUMN "padreId" TO "padre_id";
ALTER TABLE "agrupaciones" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "agrupaciones" RENAME COLUMN "updatedAt" TO "updated_at";

-- unidades
ALTER TABLE "unidades" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "unidades" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "unidades" RENAME COLUMN "tipologiaId" TO "tipologia_id";
ALTER TABLE "unidades" RENAME COLUMN "areaM2" TO "area_m2";
ALTER TABLE "unidades" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "unidades" RENAME COLUMN "updatedAt" TO "updated_at";

-- horarios_zona_comun
ALTER TABLE "horarios_zona_comun" RENAME COLUMN "zonaComunId" TO "zona_comun_id";
ALTER TABLE "horarios_zona_comun" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "horarios_zona_comun" RENAME COLUMN "updatedAt" TO "updated_at";

-- parqueaderos
ALTER TABLE "parqueaderos" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "parqueaderos" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "parqueaderos" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "parqueaderos" RENAME COLUMN "admiteCarro" TO "admite_carro";
ALTER TABLE "parqueaderos" RENAME COLUMN "admiteMoto" TO "admite_moto";
ALTER TABLE "parqueaderos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "parqueaderos" RENAME COLUMN "updatedAt" TO "updated_at";

-- asignaciones_parqueadero
ALTER TABLE "asignaciones_parqueadero" RENAME COLUMN "parqueaderoId" TO "parqueadero_id";
ALTER TABLE "asignaciones_parqueadero" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "asignaciones_parqueadero" RENAME COLUMN "createdAt" TO "created_at";

-- espacios_reservables
ALTER TABLE "espacios_reservables" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "espacios_reservables" RENAME COLUMN "zonaComunId" TO "zona_comun_id";
ALTER TABLE "espacios_reservables" RENAME COLUMN "naturalezaParqueadero" TO "naturaleza_parqueadero";
ALTER TABLE "espacios_reservables" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "espacios_reservables" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "espacios_reservables" RENAME COLUMN "updatedAt" TO "updated_at";

-- politicas_reserva
ALTER TABLE "politicas_reserva" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "politicas_reserva" RENAME COLUMN "espacioId" TO "espacio_id";
ALTER TABLE "politicas_reserva" RENAME COLUMN "requiereAprobacion" TO "requiere_aprobacion";
ALTER TABLE "politicas_reserva" RENAME COLUMN "anticipacionMinimaHoras" TO "anticipacion_minima_horas";
ALTER TABLE "politicas_reserva" RENAME COLUMN "anticipacionMaximaDias" TO "anticipacion_maxima_dias";
ALTER TABLE "politicas_reserva" RENAME COLUMN "duracionMinimaMinutos" TO "duracion_minima_minutos";
ALTER TABLE "politicas_reserva" RENAME COLUMN "duracionMaximaMinutos" TO "duracion_maxima_minutos";
ALTER TABLE "politicas_reserva" RENAME COLUMN "maxSimultaneasPorUnidad" TO "max_simultaneas_por_unidad";
ALTER TABLE "politicas_reserva" RENAME COLUMN "maxMensualesPorUnidad" TO "max_mensuales_por_unidad";
ALTER TABLE "politicas_reserva" RENAME COLUMN "soloPropietarios" TO "solo_propietarios";
ALTER TABLE "politicas_reserva" RENAME COLUMN "bloqueaConMora" TO "bloquea_con_mora";
ALTER TABLE "politicas_reserva" RENAME COLUMN "cancelacionMinimaHoras" TO "cancelacion_minima_horas";
ALTER TABLE "politicas_reserva" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "politicas_reserva" RENAME COLUMN "updatedAt" TO "updated_at";

-- reservas
ALTER TABLE "reservas" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "reservas" RENAME COLUMN "espacioId" TO "espacio_id";
ALTER TABLE "reservas" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "reservas" RENAME COLUMN "solicitadaPorId" TO "solicitada_por_id";
ALTER TABLE "reservas" RENAME COLUMN "invitadoId" TO "invitado_id";
ALTER TABLE "reservas" RENAME COLUMN "parqueaderoId" TO "parqueadero_id";
ALTER TABLE "reservas" RENAME COLUMN "aprobadaPorId" TO "aprobada_por_id";
ALTER TABLE "reservas" RENAME COLUMN "aprobadaEn" TO "aprobada_en";
ALTER TABLE "reservas" RENAME COLUMN "motivoRechazo" TO "motivo_rechazo";
ALTER TABLE "reservas" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "reservas" RENAME COLUMN "updatedAt" TO "updated_at";

-- tipologias
ALTER TABLE "tipologias" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "tipologias" RENAME COLUMN "areaM2" TO "area_m2";
ALTER TABLE "tipologias" RENAME COLUMN "planoUrl" TO "plano_url";
ALTER TABLE "tipologias" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tipologias" RENAME COLUMN "updatedAt" TO "updated_at";

-- zonas_comunes
ALTER TABLE "zonas_comunes" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "zonas_comunes" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "zonas_comunes" RENAME COLUMN "reglasUso" TO "reglas_uso";
ALTER TABLE "zonas_comunes" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "zonas_comunes" RENAME COLUMN "updatedAt" TO "updated_at";

-- usuarios
ALTER TABLE "usuarios" RENAME COLUMN "tipoDocumento" TO "tipo_documento";
ALTER TABLE "usuarios" RENAME COLUMN "numeroDocumento" TO "numero_documento";
ALTER TABLE "usuarios" RENAME COLUMN "avatarUrl" TO "avatar_url";
ALTER TABLE "usuarios" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "usuarios" RENAME COLUMN "updatedAt" TO "updated_at";

-- usuarios_conjuntos
ALTER TABLE "usuarios_conjuntos" RENAME COLUMN "usuarioId" TO "usuario_id";
ALTER TABLE "usuarios_conjuntos" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "usuarios_conjuntos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "usuarios_conjuntos" RENAME COLUMN "updatedAt" TO "updated_at";

-- roles
ALTER TABLE "roles" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "roles" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "roles" RENAME COLUMN "updatedAt" TO "updated_at";

-- modulos
ALTER TABLE "modulos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "modulos" RENAME COLUMN "updatedAt" TO "updated_at";

-- permisos
ALTER TABLE "permisos" RENAME COLUMN "moduloId" TO "modulo_id";
ALTER TABLE "permisos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "permisos" RENAME COLUMN "updatedAt" TO "updated_at";

-- roles_permisos
ALTER TABLE "roles_permisos" RENAME COLUMN "rolId" TO "rol_id";
ALTER TABLE "roles_permisos" RENAME COLUMN "permisoId" TO "permiso_id";
ALTER TABLE "roles_permisos" RENAME COLUMN "createdAt" TO "created_at";

-- usuario_conjunto_roles
ALTER TABLE "usuario_conjunto_roles" RENAME COLUMN "usuarioConjuntoId" TO "usuario_conjunto_id";
ALTER TABLE "usuario_conjunto_roles" RENAME COLUMN "rolId" TO "rol_id";
ALTER TABLE "usuario_conjunto_roles" RENAME COLUMN "asignadoPorId" TO "asignado_por_id";
ALTER TABLE "usuario_conjunto_roles" RENAME COLUMN "createdAt" TO "created_at";

-- usuarios_unidades
ALTER TABLE "usuarios_unidades" RENAME COLUMN "usuarioId" TO "usuario_id";
ALTER TABLE "usuarios_unidades" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "usuarios_unidades" RENAME COLUMN "createdAt" TO "created_at";

-- casilleros
ALTER TABLE "casilleros" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "casilleros" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "casilleros" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "casilleros" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "casilleros" RENAME COLUMN "updatedAt" TO "updated_at";

-- encomiendas
ALTER TABLE "encomiendas" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "encomiendas" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "encomiendas" RENAME COLUMN "agrupacionId" TO "agrupacion_id";
ALTER TABLE "encomiendas" RENAME COLUMN "casilleroId" TO "casillero_id";
ALTER TABLE "encomiendas" RENAME COLUMN "recibidaPorId" TO "recibida_por_id";
ALTER TABLE "encomiendas" RENAME COLUMN "recibidaEn" TO "recibida_en";
ALTER TABLE "encomiendas" RENAME COLUMN "notificadaEn" TO "notificada_en";
ALTER TABLE "encomiendas" RENAME COLUMN "retiradaPorNombre" TO "retirada_por_nombre";
ALTER TABLE "encomiendas" RENAME COLUMN "entregadaPorId" TO "entregada_por_id";
ALTER TABLE "encomiendas" RENAME COLUMN "entregadaEn" TO "entregada_en";
ALTER TABLE "encomiendas" RENAME COLUMN "fotoUrl" TO "foto_url";
ALTER TABLE "encomiendas" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "encomiendas" RENAME COLUMN "updatedAt" TO "updated_at";

-- invitados
ALTER TABLE "invitados" RENAME COLUMN "conjuntoId" TO "conjunto_id";
ALTER TABLE "invitados" RENAME COLUMN "unidadId" TO "unidad_id";
ALTER TABLE "invitados" RENAME COLUMN "tipoDocumento" TO "tipo_documento";
ALTER TABLE "invitados" RENAME COLUMN "numeroDocumento" TO "numero_documento";
ALTER TABLE "invitados" RENAME COLUMN "invitadoPorId" TO "invitado_por_id";
ALTER TABLE "invitados" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "invitados" RENAME COLUMN "updatedAt" TO "updated_at";

-- usuarios_plataforma
ALTER TABLE "usuarios_plataforma" RENAME COLUMN "usuarioId" TO "usuario_id";
ALTER TABLE "usuarios_plataforma" RENAME COLUMN "rolId" TO "rol_id";
ALTER TABLE "usuarios_plataforma" RENAME COLUMN "otorgadoPorId" TO "otorgado_por_id";
ALTER TABLE "usuarios_plataforma" RENAME COLUMN "createdAt" TO "created_at";

-- 65 indices y claves unicas ------------------------------------
ALTER INDEX "agrupaciones_conjuntoId_idx" RENAME TO "agrupaciones_conjunto_id_idx";
ALTER INDEX "agrupaciones_padreId_idx" RENAME TO "agrupaciones_padre_id_idx";
ALTER INDEX "agrupaciones_conjuntoId_nombre_key" RENAME TO "agrupaciones_conjunto_id_nombre_key";
ALTER INDEX "agrupaciones_id_conjuntoId_key" RENAME TO "agrupaciones_id_conjunto_id_key";
ALTER INDEX "unidades_conjuntoId_idx" RENAME TO "unidades_conjunto_id_idx";
ALTER INDEX "unidades_agrupacionId_idx" RENAME TO "unidades_agrupacion_id_idx";
ALTER INDEX "unidades_tipologiaId_idx" RENAME TO "unidades_tipologia_id_idx";
ALTER INDEX "unidades_conjuntoId_agrupacionId_identificador_key" RENAME TO "unidades_conjunto_id_agrupacion_id_identificador_key";
ALTER INDEX "unidades_id_conjuntoId_key" RENAME TO "unidades_id_conjunto_id_key";
ALTER INDEX "horarios_zona_comun_zonaComunId_idx" RENAME TO "horarios_zona_comun_zona_comun_id_idx";
ALTER INDEX "horarios_zona_comun_zonaComunId_dia_apertura_key" RENAME TO "horarios_zona_comun_zona_comun_id_dia_apertura_key";
ALTER INDEX "parqueaderos_conjuntoId_idx" RENAME TO "parqueaderos_conjunto_id_idx";
ALTER INDEX "parqueaderos_agrupacionId_idx" RENAME TO "parqueaderos_agrupacion_id_idx";
ALTER INDEX "parqueaderos_conjuntoId_identificador_key" RENAME TO "parqueaderos_conjunto_id_identificador_key";
ALTER INDEX "parqueaderos_id_conjuntoId_key" RENAME TO "parqueaderos_id_conjunto_id_key";
ALTER INDEX "asignaciones_parqueadero_parqueaderoId_idx" RENAME TO "asignaciones_parqueadero_parqueadero_id_idx";
ALTER INDEX "asignaciones_parqueadero_unidadId_idx" RENAME TO "asignaciones_parqueadero_unidad_id_idx";
ALTER INDEX "asignaciones_parqueadero_parqueaderoId_unidadId_desde_key" RENAME TO "asignaciones_parqueadero_parqueadero_id_unidad_id_desde_key";
ALTER INDEX "espacios_reservables_zonaComunId_key" RENAME TO "espacios_reservables_zona_comun_id_key";
ALTER INDEX "espacios_reservables_conjuntoId_idx" RENAME TO "espacios_reservables_conjunto_id_idx";
ALTER INDEX "espacios_reservables_conjuntoId_nombre_key" RENAME TO "espacios_reservables_conjunto_id_nombre_key";
ALTER INDEX "espacios_reservables_id_conjuntoId_key" RENAME TO "espacios_reservables_id_conjunto_id_key";
ALTER INDEX "politicas_reserva_espacioId_key" RENAME TO "politicas_reserva_espacio_id_key";
ALTER INDEX "politicas_reserva_conjuntoId_idx" RENAME TO "politicas_reserva_conjunto_id_idx";
ALTER INDEX "politicas_reserva_espacioId_conjuntoId_key" RENAME TO "politicas_reserva_espacio_id_conjunto_id_key";
ALTER INDEX "reservas_conjuntoId_idx" RENAME TO "reservas_conjunto_id_idx";
ALTER INDEX "reservas_espacioId_inicio_idx" RENAME TO "reservas_espacio_id_inicio_idx";
ALTER INDEX "reservas_unidadId_idx" RENAME TO "reservas_unidad_id_idx";
ALTER INDEX "reservas_conjuntoId_fin_idx" RENAME TO "reservas_conjunto_id_fin_idx";
ALTER INDEX "reservas_parqueaderoId_idx" RENAME TO "reservas_parqueadero_id_idx";
ALTER INDEX "tipologias_conjuntoId_idx" RENAME TO "tipologias_conjunto_id_idx";
ALTER INDEX "tipologias_conjuntoId_nombre_key" RENAME TO "tipologias_conjunto_id_nombre_key";
ALTER INDEX "tipologias_id_conjuntoId_key" RENAME TO "tipologias_id_conjunto_id_key";
ALTER INDEX "zonas_comunes_conjuntoId_idx" RENAME TO "zonas_comunes_conjunto_id_idx";
ALTER INDEX "zonas_comunes_agrupacionId_idx" RENAME TO "zonas_comunes_agrupacion_id_idx";
ALTER INDEX "zonas_comunes_conjuntoId_nombre_key" RENAME TO "zonas_comunes_conjunto_id_nombre_key";
ALTER INDEX "zonas_comunes_id_conjuntoId_key" RENAME TO "zonas_comunes_id_conjunto_id_key";
ALTER INDEX "usuarios_tipoDocumento_numeroDocumento_key" RENAME TO "usuarios_tipo_documento_numero_documento_key";
ALTER INDEX "usuarios_conjuntos_conjuntoId_idx" RENAME TO "usuarios_conjuntos_conjunto_id_idx";
ALTER INDEX "usuarios_conjuntos_usuarioId_conjuntoId_key" RENAME TO "usuarios_conjuntos_usuario_id_conjunto_id_key";
ALTER INDEX "roles_conjuntoId_idx" RENAME TO "roles_conjunto_id_idx";
ALTER INDEX "roles_conjuntoId_codigo_key" RENAME TO "roles_conjunto_id_codigo_key";
ALTER INDEX "permisos_moduloId_idx" RENAME TO "permisos_modulo_id_idx";
ALTER INDEX "roles_permisos_permisoId_idx" RENAME TO "roles_permisos_permiso_id_idx";
ALTER INDEX "usuario_conjunto_roles_usuarioConjuntoId_idx" RENAME TO "usuario_conjunto_roles_usuario_conjunto_id_idx";
ALTER INDEX "usuario_conjunto_roles_rolId_idx" RENAME TO "usuario_conjunto_roles_rol_id_idx";
ALTER INDEX "usuario_conjunto_roles_usuarioConjuntoId_rolId_desde_key" RENAME TO "usuario_conjunto_roles_usuario_conjunto_id_rol_id_desde_key";
ALTER INDEX "usuarios_unidades_unidadId_idx" RENAME TO "usuarios_unidades_unidad_id_idx";
ALTER INDEX "usuarios_unidades_usuarioId_idx" RENAME TO "usuarios_unidades_usuario_id_idx";
ALTER INDEX "usuarios_unidades_usuarioId_unidadId_relacion_desde_key" RENAME TO "usuarios_unidades_usuario_id_unidad_id_relacion_desde_key";
ALTER INDEX "casilleros_conjuntoId_idx" RENAME TO "casilleros_conjunto_id_idx";
ALTER INDEX "casilleros_agrupacionId_idx" RENAME TO "casilleros_agrupacion_id_idx";
ALTER INDEX "casilleros_conjuntoId_identificador_key" RENAME TO "casilleros_conjunto_id_identificador_key";
ALTER INDEX "casilleros_unidadId_conjuntoId_key" RENAME TO "casilleros_unidad_id_conjunto_id_key";
ALTER INDEX "casilleros_id_conjuntoId_key" RENAME TO "casilleros_id_conjunto_id_key";
ALTER INDEX "encomiendas_conjuntoId_estado_idx" RENAME TO "encomiendas_conjunto_id_estado_idx";
ALTER INDEX "encomiendas_unidadId_idx" RENAME TO "encomiendas_unidad_id_idx";
ALTER INDEX "encomiendas_agrupacionId_idx" RENAME TO "encomiendas_agrupacion_id_idx";
ALTER INDEX "encomiendas_casilleroId_idx" RENAME TO "encomiendas_casillero_id_idx";
ALTER INDEX "invitados_conjuntoId_hasta_idx" RENAME TO "invitados_conjunto_id_hasta_idx";
ALTER INDEX "invitados_unidadId_idx" RENAME TO "invitados_unidad_id_idx";
ALTER INDEX "invitados_numeroDocumento_idx" RENAME TO "invitados_numero_documento_idx";
ALTER INDEX "invitados_id_conjuntoId_key" RENAME TO "invitados_id_conjunto_id_key";
ALTER INDEX "usuarios_plataforma_usuarioId_hasta_idx" RENAME TO "usuarios_plataforma_usuario_id_hasta_idx";
ALTER INDEX "usuarios_plataforma_usuarioId_rolId_desde_key" RENAME TO "usuarios_plataforma_usuario_id_rol_id_desde_key";

-- 51 llaves foraneas -------------------------------------------
ALTER TABLE "agrupaciones" RENAME CONSTRAINT "agrupaciones_conjuntoId_fkey" TO "agrupaciones_conjunto_id_fkey";
ALTER TABLE "agrupaciones" RENAME CONSTRAINT "agrupaciones_padreId_fkey" TO "agrupaciones_padre_id_fkey";
ALTER TABLE "unidades" RENAME CONSTRAINT "unidades_conjuntoId_fkey" TO "unidades_conjunto_id_fkey";
ALTER TABLE "unidades" RENAME CONSTRAINT "unidades_agrupacionId_conjuntoId_fkey" TO "unidades_agrupacion_id_conjunto_id_fkey";
ALTER TABLE "unidades" RENAME CONSTRAINT "unidades_tipologiaId_conjuntoId_fkey" TO "unidades_tipologia_id_conjunto_id_fkey";
ALTER TABLE "horarios_zona_comun" RENAME CONSTRAINT "horarios_zona_comun_zonaComunId_fkey" TO "horarios_zona_comun_zona_comun_id_fkey";
ALTER TABLE "parqueaderos" RENAME CONSTRAINT "parqueaderos_conjuntoId_fkey" TO "parqueaderos_conjunto_id_fkey";
ALTER TABLE "parqueaderos" RENAME CONSTRAINT "parqueaderos_agrupacionId_conjuntoId_fkey" TO "parqueaderos_agrupacion_id_conjunto_id_fkey";
ALTER TABLE "parqueaderos" RENAME CONSTRAINT "parqueaderos_unidadId_fkey" TO "parqueaderos_unidad_id_fkey";
ALTER TABLE "asignaciones_parqueadero" RENAME CONSTRAINT "asignaciones_parqueadero_parqueaderoId_fkey" TO "asignaciones_parqueadero_parqueadero_id_fkey";
ALTER TABLE "asignaciones_parqueadero" RENAME CONSTRAINT "asignaciones_parqueadero_unidadId_fkey" TO "asignaciones_parqueadero_unidad_id_fkey";
ALTER TABLE "espacios_reservables" RENAME CONSTRAINT "espacios_reservables_conjuntoId_fkey" TO "espacios_reservables_conjunto_id_fkey";
ALTER TABLE "espacios_reservables" RENAME CONSTRAINT "espacios_reservables_zonaComunId_fkey" TO "espacios_reservables_zona_comun_id_fkey";
ALTER TABLE "espacios_reservables" RENAME CONSTRAINT "espacios_reservables_agrupacionId_fkey" TO "espacios_reservables_agrupacion_id_fkey";
ALTER TABLE "politicas_reserva" RENAME CONSTRAINT "politicas_reserva_conjuntoId_fkey" TO "politicas_reserva_conjunto_id_fkey";
ALTER TABLE "politicas_reserva" RENAME CONSTRAINT "politicas_reserva_espacioId_conjuntoId_fkey" TO "politicas_reserva_espacio_id_conjunto_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_conjuntoId_fkey" TO "reservas_conjunto_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_espacioId_conjuntoId_fkey" TO "reservas_espacio_id_conjunto_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_unidadId_fkey" TO "reservas_unidad_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_solicitadaPorId_fkey" TO "reservas_solicitada_por_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_invitadoId_conjuntoId_fkey" TO "reservas_invitado_id_conjunto_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_parqueaderoId_conjuntoId_fkey" TO "reservas_parqueadero_id_conjunto_id_fkey";
ALTER TABLE "reservas" RENAME CONSTRAINT "reservas_aprobadaPorId_fkey" TO "reservas_aprobada_por_id_fkey";
ALTER TABLE "tipologias" RENAME CONSTRAINT "tipologias_conjuntoId_fkey" TO "tipologias_conjunto_id_fkey";
ALTER TABLE "zonas_comunes" RENAME CONSTRAINT "zonas_comunes_conjuntoId_fkey" TO "zonas_comunes_conjunto_id_fkey";
ALTER TABLE "zonas_comunes" RENAME CONSTRAINT "zonas_comunes_agrupacionId_fkey" TO "zonas_comunes_agrupacion_id_fkey";
ALTER TABLE "usuarios_conjuntos" RENAME CONSTRAINT "usuarios_conjuntos_usuarioId_fkey" TO "usuarios_conjuntos_usuario_id_fkey";
ALTER TABLE "usuarios_conjuntos" RENAME CONSTRAINT "usuarios_conjuntos_conjuntoId_fkey" TO "usuarios_conjuntos_conjunto_id_fkey";
ALTER TABLE "permisos" RENAME CONSTRAINT "permisos_moduloId_fkey" TO "permisos_modulo_id_fkey";
ALTER TABLE "roles_permisos" RENAME CONSTRAINT "roles_permisos_rolId_fkey" TO "roles_permisos_rol_id_fkey";
ALTER TABLE "roles_permisos" RENAME CONSTRAINT "roles_permisos_permisoId_fkey" TO "roles_permisos_permiso_id_fkey";
ALTER TABLE "usuario_conjunto_roles" RENAME CONSTRAINT "usuario_conjunto_roles_usuarioConjuntoId_fkey" TO "usuario_conjunto_roles_usuario_conjunto_id_fkey";
ALTER TABLE "usuario_conjunto_roles" RENAME CONSTRAINT "usuario_conjunto_roles_rolId_fkey" TO "usuario_conjunto_roles_rol_id_fkey";
ALTER TABLE "usuario_conjunto_roles" RENAME CONSTRAINT "usuario_conjunto_roles_asignadoPorId_fkey" TO "usuario_conjunto_roles_asignado_por_id_fkey";
ALTER TABLE "usuarios_unidades" RENAME CONSTRAINT "usuarios_unidades_usuarioId_fkey" TO "usuarios_unidades_usuario_id_fkey";
ALTER TABLE "usuarios_unidades" RENAME CONSTRAINT "usuarios_unidades_unidadId_fkey" TO "usuarios_unidades_unidad_id_fkey";
ALTER TABLE "casilleros" RENAME CONSTRAINT "casilleros_conjuntoId_fkey" TO "casilleros_conjunto_id_fkey";
ALTER TABLE "casilleros" RENAME CONSTRAINT "casilleros_agrupacionId_conjuntoId_fkey" TO "casilleros_agrupacion_id_conjunto_id_fkey";
ALTER TABLE "casilleros" RENAME CONSTRAINT "casilleros_unidadId_conjuntoId_fkey" TO "casilleros_unidad_id_conjunto_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_conjuntoId_fkey" TO "encomiendas_conjunto_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_unidadId_conjuntoId_fkey" TO "encomiendas_unidad_id_conjunto_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_agrupacionId_conjuntoId_fkey" TO "encomiendas_agrupacion_id_conjunto_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_casilleroId_conjuntoId_fkey" TO "encomiendas_casillero_id_conjunto_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_recibidaPorId_fkey" TO "encomiendas_recibida_por_id_fkey";
ALTER TABLE "encomiendas" RENAME CONSTRAINT "encomiendas_entregadaPorId_fkey" TO "encomiendas_entregada_por_id_fkey";
ALTER TABLE "invitados" RENAME CONSTRAINT "invitados_conjuntoId_fkey" TO "invitados_conjunto_id_fkey";
ALTER TABLE "invitados" RENAME CONSTRAINT "invitados_unidadId_conjuntoId_fkey" TO "invitados_unidad_id_conjunto_id_fkey";
ALTER TABLE "invitados" RENAME CONSTRAINT "invitados_invitadoPorId_fkey" TO "invitados_invitado_por_id_fkey";
ALTER TABLE "usuarios_plataforma" RENAME CONSTRAINT "usuarios_plataforma_usuarioId_fkey" TO "usuarios_plataforma_usuario_id_fkey";
ALTER TABLE "usuarios_plataforma" RENAME CONSTRAINT "usuarios_plataforma_rolId_fkey" TO "usuarios_plataforma_rol_id_fkey";
ALTER TABLE "usuarios_plataforma" RENAME CONSTRAINT "usuarios_plataforma_otorgadoPorId_fkey" TO "usuarios_plataforma_otorgado_por_id_fkey";
