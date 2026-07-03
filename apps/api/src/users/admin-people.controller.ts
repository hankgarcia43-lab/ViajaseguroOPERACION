import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminUserActionDto } from './dto/admin-user-action.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/people')
export class AdminPeopleController {
  constructor(private readonly usersService: UsersService) {}

  @Get('summary')
  summary() {
    return this.usersService.getAdminPeopleSummary();
  }

  @Get()
  list(@Query('q') q?: string, @Query('role') role?: string, @Query('status') status?: string) {
    return this.usersService.findPeopleForAdmin({ q, role, status });
  }

  @Patch(':userId/suspend')
  suspend(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.suspendUserForAdmin(user.sub, userId, dto.notes);
  }

  @Patch(':userId/activate')
  activate(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.activateUserForAdmin(user.sub, userId, dto.notes);
  }

  @Patch(':userId/promote')
  promote(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.promoteUserForAdmin(user.sub, userId, dto.notes);
  }

  @Patch(':userId/standard')
  standard(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.setStandardUserForAdmin(user.sub, userId, dto.notes);
  }

  @Patch(':userId/activate-subscription')
  activateSubscription(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.activateSubscriptionForAdmin(user.sub, userId, dto.notes);
  }

  @Patch(':userId/expire-subscription')
  expireSubscription(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() dto: AdminUserActionDto) {
    return this.usersService.expireSubscriptionForAdmin(user.sub, userId, dto.notes);
  }
  @Delete(':userId')
  remove(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.deleteUserForAdmin(user.sub, userId);
  }
}
