import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateDriverRouteProposalDto } from './dto/create-driver-route-proposal.dto';
import { CreateRequestedRouteDto } from './dto/create-requested-route.dto';
import { RouteNeedsService } from './route-needs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('route-needs')
export class RouteNeedsController {
  constructor(private readonly routeNeedsService: RouteNeedsService) {}

  @Post()
  @Roles('passenger')
  createNeed(@CurrentUser() user: { sub: string }, @Body() dto: CreateRequestedRouteDto) {
    return this.routeNeedsService.createNeed(user.sub, dto);
  }

  @Get('admin/all')
  @Roles('admin')
  findAllForAdmin() {
    return this.routeNeedsService.findAllForAdmin();
  }
  @Get('my')
  @Roles('passenger')
  myNeeds(@CurrentUser() user: { sub: string }) {
    return this.routeNeedsService.myNeeds(user.sub);
  }

  @Get('open')
  @Roles('driver')
  openNeeds(@CurrentUser() user: { sub: string }) {
    return this.routeNeedsService.openNeedsForDriver(user.sub);
  }

  @Post(':id/proposals')
  @Roles('driver')
  propose(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CreateDriverRouteProposalDto) {
    return this.routeNeedsService.propose(user.sub, id, dto);
  }

  @Patch('proposals/:id/accept')
  @Roles('passenger')
  acceptProposal(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.routeNeedsService.acceptProposal(user.sub, id);
  }

  @Patch('proposals/:id/reject')
  @Roles('passenger')
  rejectProposal(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.routeNeedsService.rejectProposal(user.sub, id);
  }
}
