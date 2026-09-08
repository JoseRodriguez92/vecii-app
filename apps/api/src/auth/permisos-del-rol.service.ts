import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { TODOS_LOS_PERMISOS } from '../common/permisos.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TTL_CACHE_MS = 5 * 60 * 1000;

/**
 * Que permisos da cada cargo. Ademas, verifica al arrancar que el catalogo de
 * la base cubra todo lo que el codigo declara.
 *
 * Es la mitad de la pregunta. La otra —que permisos tiene ESTA persona aqui—
 * la responde `permisos-del-usuario.service.ts`, que suma estos con los que se
 * derivan de tener una unidad.
 *
 * El mapa rol -> permisos se cachea en memoria porque cambia poquisimo y se
 * consulta en CADA peticion. Como los roles son globales (no por conjunto), es
 * un solo mapa para toda la aplicacion.
 */
@Injectable()
export class PermisosDelRolService implements OnModuleInit {
  private readonly logger = new Logger(PermisosDelRolService.name);
  /** rolId -> permisos. Por ID y no por codigo: dos conjuntos pueden tener
   *  cada uno su rol "COMITE_DEPORTES", y el codigo solo no los distingue. */
  private mapa = new Map<string, Set<string>>();
  /** codigo -> rolId, solo de los roles globales. Los roles derivados
   *  (PROPIETARIO, RESIDENTE) llegan como codigo, no como id. */
  private idsGlobales = new Map<string, string>();
  private cargadoEn = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.verificarCatalogo();
  }

  /**
   * Se niega a levantar si algun permiso declarado en el codigo no existe en la
   * base. Sin esto, un permiso mal escrito o un seed sin correr se descubren en
   * produccion, cuando alguien no puede entrar y nadie sabe por que.
   */
  private async verificarCatalogo() {
    const enBase = await this.prisma.permiso.findMany({ select: { codigo: true } });
    const existentes = new Set(enBase.map((p) => p.codigo));
    const faltantes = TODOS_LOS_PERMISOS.filter((codigo) => !existentes.has(codigo));

    if (faltantes.length > 0) {
      throw new Error(
        `Faltan ${faltantes.length} permiso(s) en la base de datos:\n` +
          faltantes.map((c) => `  - ${c}`).join('\n') +
          `\n\nCorre: pnpm --filter vecii-backend prisma:seed`,
      );
    }

    // Al reves no es error: un permiso en base que el codigo ya no declara es
    // basura de una version anterior. Se avisa, no se bloquea.
    const declarados = new Set<string>(TODOS_LOS_PERMISOS);
    const huerfanos = enBase.filter((p) => !declarados.has(p.codigo)).map((p) => p.codigo);
    if (huerfanos.length > 0) {
      this.logger.warn(`Permisos en base que el codigo ya no usa: ${huerfanos.join(', ')}`);
    }

    this.logger.log(`Catalogo de permisos verificado: ${TODOS_LOS_PERMISOS.length}`);
  }

  private async cargar() {
    if (Date.now() - this.cargadoEn < TTL_CACHE_MS && this.mapa.size > 0) return;

    const filas = await this.prisma.rolPermiso.findMany({
      select: { rolId: true, permiso: { select: { codigo: true } } },
    });

    const nuevo = new Map<string, Set<string>>();
    for (const fila of filas) {
      const set = nuevo.get(fila.rolId) ?? new Set<string>();
      set.add(fila.permiso.codigo);
      nuevo.set(fila.rolId, set);
    }

    const globales = await this.prisma.rol.findMany({
      where: { conjuntoId: null },
      select: { id: true, codigo: true },
    });

    this.mapa = nuevo;
    this.idsGlobales = new Map(globales.map((r) => [r.codigo, r.id]));
    this.cargadoEn = Date.now();
  }

  /**
   * Union de los permisos de unos roles.
   *
   * Recibe IDS y no codigos porque un codigo no identifica un rol: Parques de
   * Castilla y Torres del Parque pueden tener cada uno su "COMITE_DEPORTES", y
   * son roles distintos con permisos distintos.
   *
   * `codigosGlobales` es la excepcion: los roles derivados —PROPIETARIO,
   * RESIDENTE— llegan como codigo desde `rolDeRelacion`, y esos si son globales.
   */
  async permisosDe(rolIds: string[], codigosGlobales: string[] = []): Promise<Set<string>> {
    await this.cargar();

    const ids = [
      ...rolIds,
      ...codigosGlobales.map((c) => this.idsGlobales.get(c)).filter((id): id is string => !!id),
    ];

    const union = new Set<string>();
    for (const id of ids) {
      for (const permiso of this.mapa.get(id) ?? []) union.add(permiso);
    }
    return union;
  }

  /** Fuerza recarga. Hay que llamarlo al editar roles_permisos desde la interfaz. */
  invalidarCache() {
    this.cargadoEn = 0;
  }
}
