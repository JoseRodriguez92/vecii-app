/** El conjunto en el que el usuario esta operando, con lo que puede hacer ahi. */
export interface ConjuntoActivo {
  /**
   * id del registro en `usuarios_conjuntos`.
   *
   * NULL cuando quien entra es del equipo de Vecii y no vive en este conjunto:
   * un rol de plataforma no crea vinculo. Todo lo que necesite el vinculo tiene
   * que comprobarlo.
   */
  id: string | null;
  conjuntoId: string;
  /** Roles efectivos: los de plataforma, los otorgados aqui, y los derivados. */
  roles: string[];
  /** Permisos que le dan esos roles. */
  permisos: Set<string>;
  /** Si entro por un rol de plataforma (equipo de Vecii). */
  esDePlataforma: boolean;
}
