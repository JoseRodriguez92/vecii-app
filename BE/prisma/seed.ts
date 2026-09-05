import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { RolMembresia, TipoUnidad } from '../src/generated/prisma/enums.js';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DIRECT_URL / DATABASE_URL');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Datos de ejemplo. Reemplaza USUARIO_DEMO_ID por el id (sub) de un usuario
 * real creado en Supabase Auth para poder iniciar sesion con el.
 */
const USUARIO_DEMO_ID = process.env.SEED_USER_ID ?? '00000000-0000-0000-0000-000000000000';

async function main() {
  const usuario = await prisma.usuario.upsert({
    where: { id: USUARIO_DEMO_ID },
    create: { id: USUARIO_DEMO_ID, email: 'demo@vecii.co', nombreCompleto: 'Usuario Demo' },
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
      torres: {
        create: [{ nombre: 'Torre 1' }, { nombre: 'Torre 2' }],
      },
      membresias: {
        create: { usuarioId: usuario.id, rol: RolMembresia.ADMIN_CONJUNTO },
      },
    },
    include: { torres: true },
  });

  const torre1 = conjunto.torres[0];
  await prisma.unidad.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      conjuntoId: conjunto.id,
      torreId: torre1.id,
      identificador: `${i + 1}01`,
      tipo: TipoUnidad.APARTAMENTO,
      coeficiente: 0.0125,
      areaM2: 72.5,
    })),
  });

  console.log(`Seed listo: conjunto ${conjunto.nombre} (${conjunto.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
