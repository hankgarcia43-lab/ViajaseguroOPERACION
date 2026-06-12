import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from 'class-validator';
import { RouteStatusDto, WeekdayDto } from './create-route.dto';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class AdminCreateRouteDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  origin!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  destination!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  stopsText?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsEnum(WeekdayDto, { each: true })
  weekdays!: WeekdayDto[];

  @IsString()
  @Matches(TIME_REGEX, { message: 'departureTime debe tener formato HH:mm' })
  departureTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'estimatedArrivalTime debe tener formato HH:mm' })
  estimatedArrivalTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(500)
  pricePerSeat?: number;

  @IsOptional()
  @IsEnum(RouteStatusDto)
  status?: RouteStatusDto;
}