import { PrismaClient } from '@prisma/client';
import { BASE_ROUTE_TEMPLATES } from '../src/routes/base-routes.catalog';

const prisma = new PrismaClient();

const SYSTEM_ROUTE_ADMIN_EMAIL = 'sistema.rutas@viajaseguro.local';
const SYSTEM_ROUTE_ADMIN_NAME = 'Sistema Rutas Base';
const SYSTEM_ROUTE_ADMIN_PHONE = '5500000000';
const SYSTEM_ROUTE_ADMIN_PASSWORD_HASH = '$2b$10$tbW4xgoFuvuzcNXOG0I02Oo0endaADDPCWPdtonj8FkdItdG4gn.u';
const MAX_PRICE_PER_SEAT = 500;

async function nextPublicId(entity: string) {
  const counter = await prisma.entityCounter.upsert({
    where: { entity },
    create: { entity, value: 1 },
    update: { value: { increment: 1 } }
  });

  return counter.value;
}

async function ensureSystemRouteAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: SYSTEM_ROUTE_ADMIN_EMAIL } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      fullName: SYSTEM_ROUTE_ADMIN_NAME,
      phone: SYSTEM_ROUTE_ADMIN_PHONE,
      email: SYSTEM_ROUTE_ADMIN_EMAIL,
      passwordHash: SYSTEM_ROUTE_ADMIN_PASSWORD_HASH,
      role: 'admin',
      verificationStatus: 'approved'
    }
  });
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function main() {
  const systemAdmin = await ensureSystemRouteAdmin();

  for (const template of BASE_ROUTE_TEMPLATES) {
    const boundedPrice = Math.min(Math.max(round(template.recommendedPricePerSeat), 1), MAX_PRICE_PER_SEAT);

    const baseData = {
      driverUserId: systemAdmin.id,
      farePolicyId: null,
      title: template.title,
      origin: template.origin,
      destination: template.destination,
      stopsText: template.stopsText,
      weekdaysText: JSON.stringify(template.weekdays),
      departureTime: template.departureTime,
      estimatedArrivalTime: template.estimatedArrivalTime,
      availableSeats: template.availableSeats,
      distanceKm: round(template.distanceKm),
      pricePerSeat: boundedPrice,
      farePolicyMode: null,
      fareRatePerKmApplied: null,
      maxAllowedPrice: MAX_PRICE_PER_SEAT,
      status: 'active'
    };

    const existing = await prisma.route.findUnique({ where: { templateKey: template.templateKey } });

    if (existing) {
      await prisma.route.update({
        where: { id: existing.id },
        data: baseData
      });
      continue;
    }

    await prisma.route.create({
      data: {
        publicId: await nextPublicId('route'),
        templateKey: template.templateKey,
        ...baseData
      }
    });
  }

  console.log(`Rutas base sincronizadas para pruebas: ${BASE_ROUTE_TEMPLATES.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });