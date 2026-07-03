import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { WeekdayDto } from '../../routes/dto/create-route.dto';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateRequestedRouteDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  originText!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  destinationText!: string;

  @IsOptional()
  @IsISO8601()
  desiredDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsEnum(WeekdayDto, { each: true })
  recurrenceDays?: WeekdayDto[];

  @IsString()
  @Matches(TIME_REGEX, { message: 'desiredTime debe tener formato HH:mm' })
  desiredTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  seatsNeeded!: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message?: string;
}
