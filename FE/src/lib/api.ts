import { env } from './env';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** id del conjunto activo -> cabecera x-conjunto-id */
  conjuntoId?: string;
}

/**
 * Cliente para la API de NestJS. Adjunta el JWT de Supabase en cada peticion.
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, conjuntoId, headers, ...rest } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(conjuntoId ? { 'x-conjunto-id': conjuntoId } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : undefined) ?? `Error ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }

  return parsed as T;
}
