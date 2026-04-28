import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private readonly resolvedDatasourceUrl: string;

  constructor() {
    const defaultSqliteUrl = 'file:./dev_local.db';
    const currentUrl = process.env.DATABASE_URL?.trim() ?? '';
    const datasourceUrl = currentUrl.length === 0 ? defaultSqliteUrl : currentUrl;

    process.env.DATABASE_URL = datasourceUrl;
    if (datasourceUrl.startsWith('file:')) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
    } else {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
    }

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
    this.logger.log(`Prisma conectado usando datasource: ${this.resolvedDatasourceUrl}`);
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




