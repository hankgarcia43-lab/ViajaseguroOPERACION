import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export class CreateReservationByOfferDto {
  @IsUUID('4')
  offerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(WEEKDAYS, { each: true })
  selectedWeekdays!: string[];

  @IsInt()
  @Min(1)
  @Max(10)
  totalSeats!: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  referralDiscountRequested?: boolean;
}
