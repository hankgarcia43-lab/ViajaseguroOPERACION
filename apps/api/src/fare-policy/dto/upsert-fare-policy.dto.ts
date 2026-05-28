import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertFarePolicyDto {
  @IsIn(['fixed_per_km', 'max_per_km'])
  mode!: 'fixed_per_km' | 'max_per_km';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  ratePerKm!: number;

  @Transform(({ value }) => Number(value))
  @IsIn([5, 10, 15])
  appCommissionPercent!: 5 | 10 | 15;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  currency?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}