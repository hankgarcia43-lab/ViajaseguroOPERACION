import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class TakeViajeDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  boardingReference?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'departureTime debe tener formato HH:mm' })
  departureTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'estimatedArrivalTime debe tener formato HH:mm' })
  estimatedArrivalTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats?: number;
}
