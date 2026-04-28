import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminCreateRouteDto } from './dto/admin-create-route.dto';
import { BulkDeleteRoutesDto } from './dto/bulk-delete-routes.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RoutesService } from './routes.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/routes')
export class AdminRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('drivers')
  findAssignableDrivers() {
    return this.routesService.findAssignableDriversForAdmin();
  }

  @Get()
  findAll() {
    return this.routesService.findAllForAdmin();
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: AdminCreateRouteDto) {
    return this.routesService.createForAdminOrDriver(user.id, dto);
  }

  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteRoutesDto) {
    return this.routesService.deleteManyForAdmin(dto.routeIds);
  }

  @Get(':id')
  findById(@Param('id') routeId: string) {
    return this.routesService.findByIdForAdmin(routeId);
  }

  @Patch(':id')
  update(@Param('id') routeId: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.updateForAdmin(routeId, dto);
  }

  @Patch(':id/pause')
  pause(@Param('id') routeId: string) {
    return this.routesService.setStatusForAdmin(routeId, 'paused');
  }

  @Patch(':id/activate')
  activate(@Param('id') routeId: string) {
    return this.routesService.setStatusForAdmin(routeId, 'active');
  }

  @Delete(':id')
  remove(@Param('id') routeId: string) {
    return this.routesService.deleteForAdmin(routeId);
  }
}

