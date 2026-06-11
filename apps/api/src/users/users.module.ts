import { Module } from '@nestjs/common';
import { AdminPeopleController } from './admin-people.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  controllers: [UsersController, AdminPeopleController],
  exports: [UsersService]
})
export class UsersModule {}
