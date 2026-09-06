/** Forma del payload de un access token emitido por Supabase Auth. */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  aud: string | string[];
  exp: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/** Usuario autenticado que queda disponible en `request.user`. */
export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
}
