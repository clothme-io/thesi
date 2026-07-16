import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness / readiness probe' })
  check() {
    return {
      status: HttpStatus.OK,
      error: null,
      data: { ok: true },
    };
  }
}
