/** El conjunto en el que el usuario esta operando, con lo que puede hacer ahi. */
export interface ConjuntoActivo {
  /** id del registro en usuarios_conjuntos */
  id: string;
  conjuntoId: string;
  /** Roles efectivos: los otorgados mas los derivados de sus unidades. */
  roles: string[];
  /** Permisos que le dan esos roles. */
  permisos: Set<string>;
}
