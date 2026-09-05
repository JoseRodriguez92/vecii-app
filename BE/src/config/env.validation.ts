import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, validateSync } from 'class-validator';

class EnvVars {
  @IsIn(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsInt()
  @IsOptional()
  PORT: number = 3000;

  /** Conexion via pooler de Supabase (PgBouncer, puerto 6543). La usa el runtime. */
  @IsString()
  DATABASE_URL!: string;

  /** Conexion directa a Postgres de Supabase (puerto 5432). La usan las migraciones. */
  @IsString()
  DIRECT_URL!: string;

  /** URL del proyecto Supabase, ej: https://xxxx.supabase.co */
  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;

  /** Secreto para verificar los JWT de Supabase (Settings -> API -> JWT Secret). HS256. */
  @IsString()
  SUPABASE_JWT_SECRET!: string;

  /** Service role key de Supabase. Solo backend, nunca exponer al cliente. */
  @IsString()
  @IsOptional()
  SUPABASE_SERVICE_ROLE_KEY?: string;

  /** Origenes permitidos para CORS, separados por coma. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Variables de entorno invalidas:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return validated;
}
