import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { motivoParaNoEntrar } from './conjunto-operativo.js';
import { PermisosDelUsuarioService } from './permisos-del-usuario.service.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisosDelUsuario: PermisosDelUsuarioService,
  ) {}

  /**
   * Quien entro, donde puede entrar, y que puede hacer en cada lado.
   *
   * Es la primera llamada de la app y de ella sale todo lo demas: con que
   * conjunto trabajar, que menu dibujar y cual es "mi apartamento".
   *
   * Devuelve **permisos**, no solo roles, y esa es la parte que importa. Antes
   * devolvia los roles otorgados, y con eso la app no podia armar nada:
   * propietario y residente no se otorgan —se derivan de tener una unidad— asi
   * que un propietario, que es justo quien mas va a usar la app, llegaba con la
   * lista vacia. Y preguntar por cargos seria el unico lugar del sistema donde
   * el codigo vuelve a nombrarlos: el resto pregunta por permisos para que un
   * conjunto pueda inventarse un "Comite de Deportes" sin tocar codigo.
   *
   * Los permisos salen de `PermisosDelUsuarioService`, el mismo que usa el
   * guard. No es
   * ahorro de lineas: si fueran dos calculos, la app dibujaria botones que el
   * guard rechaza, y eso no se descubre probando sino cuando alguien reclama.
   *
   * No sincroniza nada. Crear la persona a partir de la cuenta de Supabase lo
   * hace `SupabaseAuthGuard`, en cualquier ruta y no solo en esta.
   */
  async me(user: AuthUser) {
    const [persona, porConjunto] = await Promise.all([
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          celular: true,
          tipoDocumento: true,
          numeroDocumento: true,
        },
      }),
      this.permisosDelUsuario.enTodosSusConjuntos(user.id),
    ]);

    const conjuntos = await this.prisma.conjunto.findMany({
      where: { id: { in: porConjunto.map((p) => p.conjuntoId) } },
      select: { id: true, nombre: true, ciudad: true, departamento: true, estado: true },
      orderBy: { nombre: 'asc' },
    });

    return {
      ...persona,
      /** Del equipo de Vecii. Puede entrar a conjuntos que no aparecen en la lista. */
      esDePlataforma: porConjunto.some((p) => p.esDePlataforma),
      conjuntos: conjuntos.map((c) => {
        const suyo = porConjunto.find((p) => p.conjuntoId === c.id);
        return {
          ...c,
          /**
           * Por que este conjunto no se puede abrir, o `null` si se puede.
           *
           * Sale de la misma funcion que usa el guard, no de leer `estado` por
           * fuera: si la app decidiera por su cuenta, el dia que cambie la regla
           * mostraria un conjunto que el guard rechaza —y el residente veria un
           * error tecnico en vez de "esta suspendido, llama a la administracion".
           */
          motivoParaNoEntrar: suyo?.esDePlataforma ? null : motivoParaNoEntrar(c.estado),
          /** id en `usuarios_conjuntos`. Lo que va en `x-conjunto-id` es `id`, no este. */
          vinculoId: suyo?.id ?? null,
          roles: suyo?.roles ?? [],
          // Set no sobrevive a JSON.
          permisos: [...(suyo?.permisos ?? [])].sort(),
          unidades: suyo?.unidades ?? [],
        };
      }),
    };
  }
}
