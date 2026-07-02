import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReservationByOfferDto } from './dto/create-reservation-by-offer.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ValidateBoardingDto } from './dto/validate-boarding.dto';
import { ReservationsService } from './reservations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles('passenger')
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(user.sub, dto);
  }


  @Post('by-offer')
  @Roles('passenger')
  createByOffer(@CurrentUser() user: { sub: string }, @Body() dto: CreateReservationByOfferDto) {
    return this.reservationsService.createByOffer(user.sub, dto);
  }
  @Get('my-reservations')
  @Roles('passenger')
  myReservations(@CurrentUser() user: { sub: string }) {
    return this.reservationsService.myReservations(user.sub);
  }

  @Get('admin/all')
  @Roles('admin')
  findAllForAdmin() {
    return this.reservationsService.findAllForAdmin();
  }

  @Get('admin/:id')
  @Roles('admin')
  findByIdForAdmin(@Param('id') reservationId: string) {
    return this.reservationsService.findByIdForAdmin(reservationId);
  }

  @Post('validate-boarding')
  @Roles('driver')
  validateBoarding(@CurrentUser() user: { sub: string }, @Body() dto: ValidateBoardingDto) {
    return this.reservationsService.validateBoarding(user.sub, dto);
  }

  @Get('driver/trip/:tripId')
  @Roles('driver')
  findForDriverTrip(@CurrentUser() user: { sub: string }, @Param('tripId') tripId: string) {
    return this.reservationsService.findForDriverTrip(user.sub, tripId);
  }
  @Get(':id/ticket')
  @Roles('passenger')
  ticket(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.ticketForPassenger(user.sub, reservationId);
  }

  @Get(':id')
  @Roles('passenger')
  findById(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.findByIdForPassenger(user.sub, reservationId);
  }

  @Patch(':id/cancel')
  @Roles('passenger')
  cancel(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.cancelByPassenger(user.sub, reservationId);
  }

  @Patch(':id/accept')
  @Roles('driver')
  accept(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.acceptByDriver(user.sub, reservationId);
  }

  @Patch(':id/reject')
  @Roles('driver')
  reject(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.rejectByDriver(user.sub, reservationId);
  }
  @Patch(':id/board')
  @Roles('driver')
  board(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.boardByDriver(user.sub, reservationId);
  }

  @Patch(':id/no-show')
  @Roles('driver')
  noShow(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.noShowByDriver(user.sub, reservationId);
  }

  @Patch(':id/complete')
  @Roles('driver')
  complete(@CurrentUser() user: { sub: string }, @Param('id') reservationId: string) {
    return this.reservationsService.completeByDriver(user.sub, reservationId);
  }
}
