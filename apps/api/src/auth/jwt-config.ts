import { ConfigService } from '@nestjs/config';

export function resolveJwtSecret(configService: ConfigService) {
  const configuredSecret = configService.get<string>('JWT_SECRET')?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET debe configurarse en produccion.');
  }

  return 'dev-only-viaja-seguro-jwt-secret';
}
