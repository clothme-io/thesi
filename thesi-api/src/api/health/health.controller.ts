import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check() {
    return {
      status: HttpStatus.OK,
      error: null,
      data: { ok: true },
    };
  }
}

@ApiTags('health')
@Controller('ready')
export class ReadinessController {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Database readiness probe' })
  async check() {
    try {
      await this.db.execute(sql`select 1`);
      return {
        status: HttpStatus.OK,
        error: null,
        data: { ok: true, database: 'ready' },
      };
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
