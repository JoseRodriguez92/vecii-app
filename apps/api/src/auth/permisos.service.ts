import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { TODOS_LOS_PERMISOS } from '../common/permisos.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TTL_CACHE_MS = 5 * 60 * 1000;

/**
 * Resuelve que permisos dan unos roles, y verifica al arrancar que el catalogo
 * de la base cubra todo lo que el codigo declara.
 *
 * El mapa rol -> permisos se cachea en memoria porque cambia poquisimo y se
 * consulta en CADA peticion. Como los roles son globales (no por conjunto), es
 * un solo mapa para toda la aplicacion.
 */
@Injectable()
export class PermisosService implements OnModuleInit {
  private readonly logger = new Logger(PermisosService.name);
  private mapa = new Map<string, Set<string>>();
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

  private async mapaVigente(): Promise<Map<string, Set<string>>> {
    if (Date.now() - this.cargadoEn < TTL_CACHE_MS && this.mapa.size > 0) return this.mapa;

    const filas = await this.prisma.rolPermiso.findMany({
      select: { rol: { select: { codigo: true } }, permiso: { select: { codigo: true } } },
    });

    const nuevo = new Map<string, Set<string>>();
    for (const fila of filas) {
      const set = nuevo.get(fila.rol.codigo) ?? new Set<string>();
      set.add(fila.permiso.codigo);
      nuevo.set(fila.rol.codigo, set);
    }

    this.mapa = nuevo;
    this.cargadoEn = Date.now();
    return this.mapa;
  }

  /** Union de los permisos de todos esos roles. */
  async permisosDe(codigosRol: string[]): Promise<Set<string>> {
    const mapa = await this.mapaVigente();
    const union = new Set<string>();
    for (const rol of codigosRol) {
      for (const permiso of mapa.get(rol) ?? []) union.add(permiso);
    }
    return union;
  }

  /** Fuerza recarga. Hay que llamarlo al editar roles_permisos desde la interfaz. */
  invalidarCache() {
    this.cargadoEn = 0;
  }
}
