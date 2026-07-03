import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateDriverRouteProposalDto {
  @IsString()
  @Matches(TIME_REGEX, { message: 'proposedTime debe tener formato HH:mm' })
  proposedTime!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  boardingPoint!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  boardingReference!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(500)
  suggestedCashContribution!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats!: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  messageToUser?: string;
}
