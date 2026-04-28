import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum VehicleDocumentTypeDto {
  VEHICLE_REGISTRATION = 'vehicle_registration',
  INSURANCE_POLICY = 'insurance_policy',
  VEHICLE_PHOTO = 'vehicle_photo',
  DRIVER_PHOTO = 'driver_photo'
}

export class CreateVehicleDocumentDto {
  @IsEnum(VehicleDocumentTypeDto)
  documentType!: VehicleDocumentTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}
