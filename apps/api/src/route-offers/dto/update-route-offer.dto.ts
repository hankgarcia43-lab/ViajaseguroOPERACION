import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const SERVICE_TYPES = ['one_time', 'weekly', 'round_trip'] as const;
const OFFER_STATUS = ['active', 'paused'] as const;

export class UpdateRouteOfferDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  boardingReference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(WEEKDAYS, { each: true })
  weekdays?: Array<(typeof WEEKDAYS)[number]>;

  @IsOptional()
  @IsString()
  @IsIn(SERVICE_TYPES)
  serviceType?: (typeof SERVICE_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats?: number;

  @IsOptional()
  @IsString()
  @IsIn(OFFER_STATUS)
  status?: (typeof OFFER_STATUS)[number];
}


