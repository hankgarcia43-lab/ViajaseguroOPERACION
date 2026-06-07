import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export class CreateReservationDto {
  @IsUUID()
  tripId!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(8)
  totalSeats!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(7)
  companionCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(WEEKDAYS, { each: true })
  selectedWeekdays?: string[];
}
