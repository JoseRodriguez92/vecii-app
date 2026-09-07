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
    .setDescription(
      'API de gestion de conjuntos residenciales (propiedad horizontal, Ley 675 de 2001).\n\n' +
        '### Como se autoriza\n\n' +
        'Toda peticion lleva el JWT de Supabase **y** la cabecera `x-conjunto-id`, que dice en ' +
        'que conjunto estas operando. Los endpoints no exigen roles: exigen **permisos**, y que ' +
        'rol da cada permiso vive en la base y se edita sin desplegar.\n\n' +
        'Los roles efectivos de una persona salen de **tres** lugares, y se suman:\n\n' +
        '| origen | ejemplo | alcance |\n' +
        '|---|---|---|\n' +
        '| `usuarios_plataforma` | `STAFF_VECII` | todos los conjuntos. Es el equipo de Vecii |\n' +
        '| `usuario_conjunto_roles` | `CONSEJO`, `PORTERIA` | solo ese conjunto |\n' +
        '| `usuarios_unidades` | `PROPIETARIO`, `RESIDENTE` | **derivados**: nadie los otorga |\n\n' +
        'Los derivados no tienen fila en ninguna tabla de roles. Por eso quien vende su ' +
        'apartamento deja de ser propietario solo, sin que nadie borre nada.\n\n' +
        'Varios endpoints tienen ademas **alcance de fila**: el guard razona a nivel de ' +
        'conjunto, y que la unidad sea tuya lo comprueba el servicio. Cada uno lo dice en su ' +
        'descripcion.',
    )
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
    .addTag('instalaciones · zonas comunes', 'Bienes comunes: salon, piscina, gimnasio, BBQ')
    .addTag('instalaciones · horarios zona comun', 'A que horas abre cada zona, dia por dia')
    .addTag('instalaciones · parqueaderos', 'Los cupos, como cosa fisica')
    .addTag('instalaciones · asignaciones parqueadero', 'Quien tiene derecho a cada cupo, y desde cuando')
    .addTag('reservas · espacios', 'Que se puede apartar y cuantos a la vez')
    .addTag('reservas · politicas', 'Las reglas de cada espacio')
    .addTag('reservas', 'Quien aparto que y cuando')
    .addTag('roles', 'Que puede hacer cada cargo')
    .addTag('roles · modulos', 'El catalogo de permisos, agrupado')
    .addTag('plataforma · usuarios', 'El equipo de Vecii y su acceso a todos los conjuntos')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT') ?? 3201;
  await app.listen(port);
  new Logger('Bootstrap').log(`Vecii API escuchando en http://localhost:${port}/api (docs: /docs)`);
}

await bootstrap();
