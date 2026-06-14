import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class ValidateBoardingDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'numericCode debe contener solo digitos'
  })
  @MinLength(6, { message: 'numericCode debe tener 6 digitos' })
  @MaxLength(6, { message: 'numericCode debe tener 6 digitos' })
  numericCode?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  qrToken?: string;

  @IsOptional()
  @IsUUID()
  tripId?: string;
}
