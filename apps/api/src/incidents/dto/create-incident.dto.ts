import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const INCIDENT_TYPES = [
  'comment',
  'report',
  'alert',
  'sos',
  'fraud_suspicion',
  'attempted_theft',
  'suspicious_behavior',
  'payment_problem',
  'driver_mismatch',
  'vehicle_mismatch',
  'off_platform_payment_request',
  'passenger_mismatch',
  'wrong_code',
  'unvalidated_boarding_attempt',
  'fake_payment_attempt',
  'unsafe_boarding_point',
  'other_problem'
] as const;

export class CreateIncidentDto {
  @IsString()
  @IsIn(INCIDENT_TYPES)
  type!: (typeof INCIDENT_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  message!: string;

  @IsOptional()
  @IsUUID('4')
  routeId?: string;

  @IsOptional()
  @IsUUID('4')
  routeOfferId?: string;

  @IsOptional()
  @IsUUID('4')
  tripId?: string;

  @IsOptional()
  @IsUUID('4')
  reservationId?: string;
}
