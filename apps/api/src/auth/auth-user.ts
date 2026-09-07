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

/** Lo que trae el token: una CUENTA de Supabase, todavia sin traducir. */
export interface SesionSupabase {
  /** El `sub` del JWT. Identifica la cuenta, no a la persona. */
  cuentaId: string;
  email?: string;
  phone?: string;
}

/**
 * Usuario autenticado que queda disponible en `request.user`.
 *
 * OJO con `id`: es el de la PERSONA en `usuarios`, no el `sub` del token. Los
 * dos coincidieron durante meses —la tabla era un espejo de `auth.users`— y
 * dejaron de coincidir cuando la persona se separo de la cuenta, para poder
 * anotar gente que nunca va a entrar a la app. La traduccion la hace
 * `SupabaseAuthGuard`, una sola vez por peticion, para que ningun servicio
 * tenga que saber que existen dos ids.
 */
export interface AuthUser {
  /** id de la persona en `usuarios`. */
  id: string;
  /** id de la cuenta en Supabase, el `sub` del token. */
  cuentaId: string;
  email?: string;
  phone?: string;
}
