import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const corsOrigins = config.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vecii API')
    .setDescription('API de gestion de conjuntos residenciales')
    .setVersion('0.1.0')
    .addBearerAuth()
    // El orden de los tags es el orden en que Swagger los muestra. Los de un
    // mismo modulo comparten prefijo para que se lean como una familia: OpenAPI
    // no tiene subtitulos, y esto es lo mas cerca que se puede estar.
    .addTag('health', 'Estado del servicio')
    .addTag('auth', 'Sesion del usuario')
    .addTag('conjuntos', 'La copropiedad')
    .addTag('usuarios', 'Quien esta en el conjunto, con que rol y en que unidad')
    .addTag('estructura · agrupaciones', 'Torres, manzanas, etapas: como se subdivide')
    .addTag('estructura · tipologias', 'Plantas repetidas con las que se construyo')
    .addTag('estructura · unidades', 'Propiedad privada: apartamentos, casas, locales')
    .addTag('porteria · casilleros', 'La casilla fisica de cada unidad')
    .addTag('porteria · encomiendas', 'Lo que llega para las unidades y quien lo retira')
    .addTag('porteria · invitados', 'A quien autorizo cada unidad a entrar')
    .addTag('reservas · espacios', 'Que se puede apartar y cuantos a la vez')
    .addTag('reservas · politicas', 'Las reglas de cada espacio')
    .addTag('reservas', 'Quien aparto que y cuando')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Vecii API escuchando en http://localhost:${port}/api (docs: /docs)`);
}

await bootstrap();
