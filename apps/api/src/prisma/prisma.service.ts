import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private readonly resolvedDatasourceUrl: string;

  constructor() {
    const currentUrl = process.env.DATABASE_URL?.trim() ?? '';
    const isProduction = process.env.NODE_ENV === 'production';

    if (currentUrl.length === 0 && isProduction) {
      throw new Error('DATABASE_URL es obligatoria en produccion. Configurala en Render con la URL de Neon/PostgreSQL.');
    }

    const datasourceUrl = currentUrl.length === 0 ? 'file:./dev_local.db' : currentUrl;

    if (isProduction && !datasourceUrl.startsWith('postgresql://') && !datasourceUrl.startsWith('postgres://')) {
      throw new Error('DATABASE_URL de produccion debe iniciar con postgresql:// o postgres://.');
    }

    process.env.DATABASE_URL = datasourceUrl;

    super({
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    });

    this.resolvedDatasourceUrl = datasourceUrl;
  }

  async onModuleInit() {
    this.logger.log(`Prisma conectado usando datasource: ${this.maskDatasourceUrl(this.resolvedDatasourceUrl)}`);
    await this.$connect();
    if (this.resolvedDatasourceUrl.startsWith('file:')) {
      await this.configureSqliteForLocalStability();
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as PrismaClient).$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  private maskDatasourceUrl(url: string) {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }

  private async configureSqliteForLocalStability() {
    try {
      await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      await this.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
      await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    } catch (error) {
      this.logger.warn(`No se pudo aplicar configuracion SQLite local: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
