import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('reservations/:reservationId/messages')
  @Roles('driver', 'passenger', 'admin')
  listMessages(@CurrentUser() user: { sub: string; role?: string }, @Param('reservationId') reservationId: string) {
    return this.chatService.listMessages(user.sub, reservationId, user.role ?? '');
  }

  @Post('reservations/:reservationId/messages')
  @Roles('driver', 'passenger')
  sendMessage(
    @CurrentUser() user: { sub: string; role?: string },
    @Param('reservationId') reservationId: string,
    @Body() dto: SendChatMessageDto
  ) {
    return this.chatService.sendMessage(user.sub, reservationId, dto.message, user.role ?? '');
  }
}
