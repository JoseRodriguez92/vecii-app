import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { CodigoRol, TipoAgrupacion, TipoUnidad, TipoZonaComun } from '../src/generated/prisma/enums.js';
import { sembrarRoles } from './seed-roles.js';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DIRECT_URL / DATABASE_URL');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * El catalogo de roles es dato de SISTEMA: sin el, la API no puede asignarle un
 * rol a nadie. Se siembra siempre.
 *
 * Los datos de ejemplo solo se crean si se define SEED_USER_ID con el id (sub)
 * de un usuario real de Supabase Auth.
 */
async function main() {
  await sembrarRoles(prisma);

  const usuarioDemoId = process.env.SEED_USER_ID;
  if (!usuarioDemoId) {
    console.log('SEED_USER_ID vacio: no se crean datos de ejemplo.');
    return;
  }

  const usuario = await prisma.usuario.upsert({
    where: { id: usuarioDemoId },
    create: { id: usuarioDemoId, nombres: 'Usuario', apellidos: 'Demo' },
    update: {},
  });

  const conjunto = await prisma.conjunto.create({
    data: {
      nombre: 'Conjunto Residencial Los Almendros',
      nit: '900123456-7',
      direccion: 'Calle 100 # 15-20',
      ciudad: 'Bogota',
      departamento: 'Cundinamarca',
      telefono: '6011234567',
      email: 'admin@losalmendros.co',
      latitud: 4.686_2,
      longitud: -74.048_1,
      usuarios: {
        create: {
          usuarioId: usuario.id,
          roles: { create: { rol: { connect: { codigo: CodigoRol.ADMIN_CONJUNTO } } } },
        },
      },
      agrupaciones: {
        create: [
          { tipo: TipoAgrupacion.TORRE, nombre: 'Torre 1' },
          { tipo: TipoAgrupacion.TORRE, nombre: 'Torre 2' },
        ],
      },
      tipologias: {
        create: [{ nombre: 'Tipo A', areaM2: 72.5, habitaciones: 2, banos: 2 }],
      },
      zonasComunes: {
        create: [
          { tipo: TipoZonaComun.SALON_COMUNAL, nombre: 'Salon Social', reservable: true },
          { tipo: TipoZonaComun.GIMNASIO, nombre: 'Gimnasio', reservable: false },
        ],
      },
    },
    include: { agrupaciones: true, tipologias: true },
  });

  const torre1 = conjunto.agrupaciones.find((a) => a.nombre === 'Torre 1')!;
  const tipoA = conjunto.tipologias[0];

  await prisma.unidad.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      conjuntoId: conjunto.id,
      agrupacionId: torre1.id,
      tipologiaId: tipoA.id,
      identificador: `${i + 1}01`,
      tipo: TipoUnidad.APARTAMENTO,
      coeficiente: 0.0125,
    })),
  });

  console.log(`Datos de ejemplo: ${conjunto.nombre} (${conjunto.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
