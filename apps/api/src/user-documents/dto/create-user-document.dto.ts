import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum UserDocumentTypeDto {
  IDENTITY_DOCUMENT_FRONT = 'identity_document_front',
  IDENTITY_DOCUMENT_BACK = 'identity_document_back',
  IDENTITY_DOCUMENT = 'identity_document',
  SUBSCRIPTION_PAYMENT_PROOF = 'subscription_payment_proof'
}

export class CreateUserDocumentDto {
  @IsEnum(UserDocumentTypeDto)
  documentType!: UserDocumentTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}
