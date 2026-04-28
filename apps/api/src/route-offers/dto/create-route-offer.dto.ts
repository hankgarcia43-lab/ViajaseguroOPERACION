import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const SERVICE_TYPES = ['one_time', 'weekly', 'round_trip'] as const;

export class CreateRouteOfferDto {
  @IsUUID('4')
  routeId!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  boardingReference!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(WEEKDAYS, { each: true })
  weekdays!: Array<(typeof WEEKDAYS)[number]>;

  @IsString()
  @IsIn(SERVICE_TYPES)
  serviceType!: (typeof SERVICE_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  availableSeats!: number;
}


