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

export enum WeekdayDto {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export enum RouteStatusDto {
  ACTIVE = 'active',
  PAUSED = 'paused'
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateRouteDto {
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
  originPlaceId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  destinationPlaceId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  stopsText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsEnum(WeekdayDto, { each: true })
  weekdays?: WeekdayDto[];

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'departureTime debe tener formato HH:mm' })
  departureTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'estimatedArrivalTime debe tener formato HH:mm' })
  estimatedArrivalTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(500)
  pricePerSeat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  originLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  originLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  destinationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  destinationLng?: number;

  @IsOptional()
  @IsEnum(RouteStatusDto)
  status?: RouteStatusDto;
}

