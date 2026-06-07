import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { FarePolicyService } from '../fare-policy/fare-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AdminCreateRouteDto } from './dto/admin-create-route.dto';
import { CreateRouteDto, RouteStatusDto, WeekdayDto } from './dto/create-route.dto';
import { NearbyRoutesQueryDto } from './dto/nearby-routes-query.dto';
import { TakeViajeDto } from './dto/take-viaje.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { estimateRouteDistanceKm } from './route-distance-estimator';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly vehiclesService: VehiclesService, private readonly farePolicyService: FarePolicyService) {}

  async create(userId: string, dto: CreateRouteDto) {
    await this.ensureApprovedDriver(userId);
    const route = await this.createRouteRecord(userId, dto, false);
    const initialTrip = await this.createInitialTripForRoute(route);
    return this.mapRoute(route, false, initialTrip);
  }

  async createPublic(userId: string, dto: CreateRouteDto) {
    await this.ensureUserCanPublishPublicRoute(userId);
    const route = await this.createRouteRecord(userId, dto, true);
    return this.mapRoute(route, true);
  }

  async createForAdminOrDriver(userId: string, dto: AdminCreateRouteDto) {
    const user = await this.ensureRoutePublisher(userId);
    this.assertPrice(dto.pricePerSeat);
    const route = await this.createRouteRecord(
      user.id,
      {
        title: dto.title?.trim() || `${dto.origin} -> ${dto.destination}`,
        origin: dto.origin,
        destination: dto.destination,
        stopsText: this.composeRouteDescription(dto),
        weekdays: [WeekdayDto.MONDAY, WeekdayDto.TUESDAY, WeekdayDto.WEDNESDAY, WeekdayDto.THURSDAY, WeekdayDto.FRIDAY, WeekdayDto.SATURDAY, WeekdayDto.SUNDAY],
        departureTime: '06:00',
        estimatedArrivalTime: '08:00',
        availableSeats: 4,
        pricePerSeat: dto.pricePerSeat,
        status: RouteStatusDto.ACTIVE
      },
      true
    );
    return this.mapRoute(route, true);
  }

  async findPublicRoutes() {
    const routes = await this.routeDelegate().findMany({ where: { status: 'active' }, include: this.routeInclude(true), orderBy: { createdAt: 'desc' } });
    return routes.map((r: any) => this.mapRoute(r, true));
  }

  async findNearbyRoutes(query: NearbyRoutesQueryDto) {
    const routes = await this.routeDelegate().findMany({ where: { status: 'active', originLat: { not: null }, originLng: { not: null } }, include: this.routeInclude(true) });
    const radiusKm = query.radiusKm ?? 5;
    const limit = query.limit ?? 20;
    return routes
      .map((r: any) => ({ r, d: this.haversine(query.lat, query.lng, r.originLat, r.originLng) }))
      .filter((x: any) => x.d <= radiusKm)
      .sort((a: any, b: any) => a.d - b.d)
      .slice(0, limit)
      .map((x: any) => this.mapRoute(x.r, true, null, Number(x.d.toFixed(2))));
  }

  async calculateDistanceFromAddresses(origin?: string, destination?: string) {
    const distanceKm = estimateRouteDistanceKm({ origin, destination });
    return { distanceKm, source: 'estimated_catalog' };
  }

  async findMyRoutes(userId: string) {
    await this.ensureDriver(userId);
    const routes = await this.routeDelegate().findMany({ where: { driverUserId: userId }, include: this.routeInclude(false), orderBy: { createdAt: 'desc' } });
    return routes.map((r: any) => this.mapRoute(r));
  }

  async findAllForAdmin() {
    const routes = await this.routeDelegate().findMany({ include: this.routeInclude(true), orderBy: { createdAt: 'desc' } });
    return routes.map((r: any) => this.mapRoute(r, true));
  }

  async findAssignableDriversForAdmin() {
    const users = await this.prisma.user.findMany({ where: { role: 'driver', verificationStatus: 'approved' }, include: { driverProfile: true, vehicle: true }, orderBy: { fullName: 'asc' } });
    return users.filter((u) => u.driverProfile && u.vehicle && String(u.vehicle.status).toLowerCase() === 'approved').map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, vehicleStatus: u.vehicle?.status?.toLowerCase() ?? 'pending' }));
  }

  async findById(userId: string, routeId: string) {
    const route = await this.findOwnedRouteOrThrow(userId, routeId);
    return this.mapRoute(route);
  }

  async findByIdForAdmin(routeId: string) {
    const route = await this.findRouteByIdOrThrow(routeId, true);
    return this.mapRoute(route, true);
  }

  async update(userId: string, routeId: string, dto: UpdateRouteDto) {
    await this.ensureApprovedDriver(userId);
    const existing = await this.findOwnedRouteOrThrow(userId, routeId);
    const route = await this.updateRouteRecord(routeId, existing, dto, false);
    return this.mapRoute(route);
  }

  async updateForAdmin(routeId: string, dto: UpdateRouteDto) {
    const existing = await this.findRouteByIdOrThrow(routeId, true);
    const route = await this.updateRouteRecord(routeId, existing, dto, true);
    return this.mapRoute(route, true);
  }

  async pause(userId: string, routeId: string) { return this.setStatus(userId, routeId, 'paused'); }
  async activate(userId: string, routeId: string) { return this.setStatus(userId, routeId, 'active'); }
  async setStatusForAdmin(routeId: string, status: 'active' | 'paused') { await this.findRouteByIdOrThrow(routeId, true); const r = await this.execute(() => this.routeDelegate().update({ where: { id: routeId }, data: { status }, include: this.routeInclude(true) })); return this.mapRoute(r, true); }

  async deleteForAdmin(routeId: string) { await this.findRouteByIdOrThrow(routeId, true); const reason = await this.getRouteDeleteBlockReason(routeId); if (reason) throw new ForbiddenException(reason); await this.execute(() => this.routeDelegate().delete({ where: { id: routeId } })); return { routeId, deleted: true, message: 'Ruta eliminada correctamente.' }; }

  async deleteManyForAdmin(routeIds: string[]) {
    const results: Array<{ routeId: string; deleted: boolean; message: string }> = [];
    for (const routeId of Array.from(new Set(routeIds))) {
      try { await this.findRouteByIdOrThrow(routeId, true); const reason = await this.getRouteDeleteBlockReason(routeId); if (reason) { results.push({ routeId, deleted: false, message: reason }); continue; } await this.execute(() => this.routeDelegate().delete({ where: { id: routeId } })); results.push({ routeId, deleted: true, message: 'Ruta eliminada correctamente.' }); }
      catch (e) { results.push({ routeId, deleted: false, message: e instanceof Error ? e.message : 'No se pudo eliminar la ruta.' }); }
    }
    const deletedCount = results.filter((r) => r.deleted).length;
    return { total: results.length, deletedCount, blockedCount: results.length - deletedCount, results };
  }

  async takeViaje(driverUserId: string, routeId: string, dto: TakeViajeDto) {
    await this.ensureApprovedDriver(driverUserId);
    const route = await this.findRouteByIdOrThrow(routeId, true);
    const nextTripDate = this.findNextTripDate(this.parseWeekdays(route.weekdaysText));
    const existing = await this.tripDelegate().findFirst({ where: { routeId: route.id, driverUserId, tripDate: nextTripDate, status: { in: ['scheduled', 'started', 'finished'] } } });
    const dep = (dto.departureTime ?? route.departureTime).trim();
    const arr = (dto.estimatedArrivalTime ?? route.estimatedArrivalTime).trim();
    const ref = (dto.boardingReference ?? '').trim();

    if (existing) {
      const updateData: any = {};
      if (dep) updateData.departureTimeSnapshot = dep;
      if (arr) updateData.estimatedArrivalTimeSnapshot = arr;
      if (ref) updateData.boardingReference = ref;
      const trip = Object.keys(updateData).length ? await this.tripDelegate().update({ where: { id: existing.id }, data: updateData }) : existing;
      return { route: this.mapRoute(route, true), trip: this.mapInitialTrip(trip), message: 'Viaje actualizado con horario y referencia de abordaje.' };
    }

    const trip = await this.tripDelegate().create({ data: { publicId: await this.nextPublicId('trip'), routeId: route.id, driverUserId, tripDate: nextTripDate, departureTimeSnapshot: dep, estimatedArrivalTimeSnapshot: arr, availableSeatsSnapshot: route.availableSeats, pricePerSeatSnapshot: route.pricePerSeat, boardingReference: ref || null, status: 'scheduled' } });
    return { route: this.mapRoute(route, true), trip: this.mapInitialTrip(trip), message: ref ? 'Viaje tomado, con horario y referencia guardados correctamente.' : 'Viaje tomado correctamente. Ahora agrega la referencia de abordaje.' };
  }

  private async createRouteRecord(userId: string, dto: CreateRouteDto, includeDriver: boolean) {
    this.assertPrice(dto.pricePerSeat);
    const distanceKm = this.estimateDistanceFromRouteInput(dto);
    const pricing = await this.farePolicyService.resolveRoutePricing(distanceKm, dto.pricePerSeat);
    const data: any = { publicId: await this.nextPublicId('route'), driverUserId: userId, farePolicyId: pricing.farePolicyId, title: dto.title, origin: dto.origin, destination: dto.destination, originPlaceId: dto.originPlaceId, destinationPlaceId: dto.destinationPlaceId, originLat: dto.originLat, originLng: dto.originLng, destinationLat: dto.destinationLat, destinationLng: dto.destinationLng, stopsText: dto.stopsText, weekdaysText: this.serializeWeekdays(dto.weekdays), departureTime: dto.departureTime, estimatedArrivalTime: dto.estimatedArrivalTime, availableSeats: dto.availableSeats, distanceKm: pricing.distanceKm, pricePerSeat: pricing.finalPricePerSeat, farePolicyMode: pricing.farePolicyMode, fareRatePerKmApplied: pricing.fareRatePerKmApplied, maxAllowedPrice: pricing.maxAllowedPrice, status: this.toStorageStatus(dto.status ?? RouteStatusDto.ACTIVE) };
    return this.execute(() => this.routeDelegate().create({ data, include: this.routeInclude(includeDriver) }));
  }

  private async updateRouteRecord(routeId: string, existing: any, dto: UpdateRouteDto, includeDriver: boolean) {
    const nextPrice = dto.pricePerSeat ?? existing.pricePerSeat;
    this.assertPrice(nextPrice);
    const mergedRoute = { ...existing, ...dto };
    const distanceKm = this.estimateDistanceFromRouteInput(mergedRoute);
    const pricing = await this.farePolicyService.resolveRoutePricing(distanceKm, nextPrice);
    return this.execute(() => this.routeDelegate().update({ where: { id: routeId }, data: { title: dto.title, origin: dto.origin, destination: dto.destination, originPlaceId: dto.originPlaceId, destinationPlaceId: dto.destinationPlaceId, originLat: dto.originLat, originLng: dto.originLng, destinationLat: dto.destinationLat, destinationLng: dto.destinationLng, stopsText: dto.stopsText, weekdaysText: dto.weekdays ? this.serializeWeekdays(dto.weekdays) : undefined, departureTime: dto.departureTime, estimatedArrivalTime: dto.estimatedArrivalTime, availableSeats: dto.availableSeats, status: dto.status ? this.toStorageStatus(dto.status) : undefined, distanceKm: pricing.distanceKm, pricePerSeat: pricing.finalPricePerSeat, farePolicyId: pricing.farePolicyId, farePolicyMode: pricing.farePolicyMode, fareRatePerKmApplied: pricing.fareRatePerKmApplied, maxAllowedPrice: pricing.maxAllowedPrice }, include: this.routeInclude(includeDriver) }));
  }

  private async createInitialTripForRoute(route: any) { const tripDate = this.findNextTripDate(this.parseWeekdays(route.weekdaysText)); const existing = await this.tripDelegate().findFirst({ where: { routeId: route.id, tripDate, status: { in: ['scheduled', 'started', 'finished'] } } }); if (existing) return this.mapInitialTrip(existing); const trip = await this.tripDelegate().create({ data: { publicId: await this.nextPublicId('trip'), routeId: route.id, driverUserId: route.driverUserId, tripDate, departureTimeSnapshot: route.departureTime, estimatedArrivalTimeSnapshot: route.estimatedArrivalTime, availableSeatsSnapshot: route.availableSeats, pricePerSeatSnapshot: route.pricePerSeat, status: 'scheduled' } }); return this.mapInitialTrip(trip); }
  private findNextTripDate(weekdays: WeekdayDto[]) { const n = weekdays.length ? weekdays : [this.weekdayFromDate(new Date())]; const nums = n.map((d) => this.weekdayToNumber(d)); const now = new Date(); const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)); for (let i = 0; i <= 7; i += 1) { const c = new Date(base); c.setUTCDate(base.getUTCDate() + i); if (nums.includes(c.getUTCDay())) return c; } return base; }
  private weekdayToNumber(d: WeekdayDto) { const m: Record<WeekdayDto, number> = { [WeekdayDto.SUNDAY]: 0, [WeekdayDto.MONDAY]: 1, [WeekdayDto.TUESDAY]: 2, [WeekdayDto.WEDNESDAY]: 3, [WeekdayDto.THURSDAY]: 4, [WeekdayDto.FRIDAY]: 5, [WeekdayDto.SATURDAY]: 6 }; return m[d]; }
  private weekdayFromDate(date: Date): WeekdayDto { return [WeekdayDto.SUNDAY, WeekdayDto.MONDAY, WeekdayDto.TUESDAY, WeekdayDto.WEDNESDAY, WeekdayDto.THURSDAY, WeekdayDto.FRIDAY, WeekdayDto.SATURDAY][date.getUTCDay()] as WeekdayDto; }

  private estimateDistanceFromRouteInput(route: Pick<CreateRouteDto, 'origin' | 'destination' | 'originLat' | 'originLng' | 'destinationLat' | 'destinationLng'>) { return estimateRouteDistanceKm(route); }

  private async getRouteDeleteBlockReason(routeId: string) { const trips = await this.tripDelegate().findMany({ where: { routeId }, select: { status: true, _count: { select: { reservations: true } } } }); if (trips.some((t: any) => (t._count?.reservations ?? 0) > 0)) return 'No se puede eliminar la ruta porque tiene reservaciones relacionadas. Pausala para dejarla fuera de operacion.'; if (trips.some((t: any) => String(t.status || '').toLowerCase() !== 'scheduled')) return 'No se puede eliminar la ruta porque tiene viajes en curso o historicos. Pausala para conservar trazabilidad.'; return null; }
  private async setStatus(userId: string, routeId: string, status: 'active' | 'paused') { await this.ensureApprovedDriver(userId); await this.findOwnedRouteOrThrow(userId, routeId); const route = await this.execute(() => this.routeDelegate().update({ where: { id: routeId }, data: { status }, include: this.routeInclude(false) })); return this.mapRoute(route); }
  private routeInclude(includeDriver: boolean) { return includeDriver ? { driver: { select: { id: true, fullName: true, email: true } }, farePolicy: { select: { id: true, mode: true, ratePerKm: true, currency: true } } } : { farePolicy: { select: { id: true, mode: true, ratePerKm: true, currency: true } } }; }
  private mapRoute(route: any, includeDriver = false, initialTrip: any = null, nearbyDistanceKm: number | null = null) { return { id: route.id, publicId: route.publicId, driverUserId: route.driverUserId, farePolicyId: route.farePolicyId, title: route.title, origin: route.origin, destination: route.destination, originPlaceId: route.originPlaceId, destinationPlaceId: route.destinationPlaceId, originLat: route.originLat, originLng: route.originLng, destinationLat: route.destinationLat, destinationLng: route.destinationLng, stopsText: route.stopsText, weekdays: this.parseWeekdays(route.weekdaysText), departureTime: route.departureTime, estimatedArrivalTime: route.estimatedArrivalTime, availableSeats: route.availableSeats, distanceKm: route.distanceKm, pricePerSeat: route.pricePerSeat, farePolicyMode: route.farePolicyMode, fareRatePerKmApplied: route.fareRatePerKmApplied, maxAllowedPrice: route.maxAllowedPrice, status: this.mapStatus(route.status), createdAt: route.createdAt, updatedAt: route.updatedAt, nearbyDistanceKm, farePolicy: route.farePolicy ?? null, initialTrip, initialViaje: initialTrip, driver: includeDriver && route.driver ? { id: route.driver.id, fullName: route.driver.fullName, email: route.driver.email } : null, publishedBy: route.driver ? { id: route.driver.id, fullName: route.driver.fullName, email: route.driver.email } : null }; }
  private mapInitialTrip(trip: any) { return { id: trip.id, publicId: trip.publicId, routeId: trip.routeId, tripDate: trip.tripDate, departureTimeSnapshot: trip.departureTimeSnapshot, estimatedArrivalTimeSnapshot: trip.estimatedArrivalTimeSnapshot, availableSeatsSnapshot: trip.availableSeatsSnapshot, pricePerSeatSnapshot: trip.pricePerSeatSnapshot, boardingReference: trip.boardingReference, status: trip.status }; }
  private serializeWeekdays(weekdays: WeekdayDto[]) { return JSON.stringify(Array.from(new Set(weekdays))); }
  private parseWeekdays(value: string): WeekdayDto[] { try { const p = JSON.parse(value); if (!Array.isArray(p)) return []; return p.filter((d): d is WeekdayDto => Object.values(WeekdayDto).includes(d as WeekdayDto)); } catch { return []; } }
  private toStorageStatus(status: RouteStatusDto): 'active' | 'paused' { return status === RouteStatusDto.PAUSED ? 'paused' : 'active'; }
  private mapStatus(status: string): RouteStatusDto { return String(status || '').toLowerCase() === 'paused' ? RouteStatusDto.PAUSED : RouteStatusDto.ACTIVE; }
  private composeRouteDescription(dto: AdminCreateRouteDto) { return dto.stopsText?.trim() || dto.description?.trim() || undefined; }
  private async findOwnedRouteOrThrow(userId: string, routeId: string) { await this.ensureDriver(userId); const route = await this.routeDelegate().findUnique({ where: { id: routeId }, include: this.routeInclude(false) }); if (!route) throw new NotFoundException('Ruta no encontrada'); if (route.driverUserId !== userId) throw new ForbiddenException('No puedes gestionar rutas de otro conductor'); return route; }
  private async findRouteByIdOrThrow(routeId: string, includeDriver = false) { const route = await this.routeDelegate().findUnique({ where: { id: routeId }, include: this.routeInclude(includeDriver) }); if (!route) throw new NotFoundException('Ruta no encontrada'); return route; }
  private async ensureRoutePublisher(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId } }); if (!user) throw new NotFoundException('Usuario no encontrado'); const role = String(user.role || '').toLowerCase(); if (role === 'admin') return user; if (role === 'driver') { await this.ensureApprovedDriver(userId); return user; } throw new ForbiddenException('Solo admin y conductor pueden crear rutas base.'); }
  private async ensureDriver(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { driverProfile: true } }); if (!user) throw new NotFoundException('Usuario no encontrado'); if (String(user.role || '').toLowerCase() !== 'driver') throw new ForbiddenException('Solo conductores pueden gestionar rutas'); if (!user.driverProfile) throw new ForbiddenException('El usuario no tiene perfil de conductor'); return user; }
  private async ensureApprovedDriver(userId: string) { await this.vehiclesService.ensureDriverCanOperate(userId); }
  private async ensureUserCanPublishPublicRoute(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, verificationStatus: true } }); if (!user) throw new NotFoundException('Usuario no encontrado'); if (String(user.role || '').toLowerCase() === 'admin') return user; if (String(user.verificationStatus || '').toLowerCase() !== 'approved') throw new ForbiddenException('Debes tener verificacion aprobada para publicar rutas. Completa tu verificacion en /dashboard/verification.'); return user; }
  private assertPrice(price: number) { if (price > 500) throw new BadRequestException('El precio por asiento no puede ser mayor a 500 MXN.'); if (price < 1) throw new BadRequestException('El precio por asiento debe ser mayor o igual a 1 MXN.'); }
  private round(v: number) { return Math.round(v * 100) / 100; }
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number) { const r = (x: number) => (x * Math.PI) / 180; const R = 6371; const dLat = r(lat2 - lat1); const dLng = r(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2; return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); }
  private async nextPublicId(entity: string) { const counter = await this.prisma.entityCounter.upsert({ where: { entity }, create: { entity, value: 1 }, update: { value: { increment: 1 } } }); return counter.value; }
  private routeDelegate() { return (this.prisma as any).route; }
  private tripDelegate() { return (this.prisma as any).trip; }
  private async execute<T>(operation: () => Promise<T>, attempts = 3): Promise<T> { for (let i = 1; i <= attempts; i += 1) { try { return await operation(); } catch (e) { const timeout = e instanceof PrismaClientKnownRequestError && e.code === 'P1008'; if (!timeout || i === attempts) throw timeout ? new ServiceUnavailableException('La base de datos local esta ocupada temporalmente. Intenta de nuevo en unos segundos.') : e; await new Promise((r) => setTimeout(r, 250 * i)); } } throw new ServiceUnavailableException('No se pudo completar la operacion sobre rutas'); }
}

