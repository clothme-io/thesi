import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateCreatorApplicationDto,
  CreatorApplicationResponse,
} from './dto/creator-application.dto';
import { CreatorApplicationsService } from './creator-applications.service';

@ApiTags('creator-applications')
@Controller('creator-applications')
export class CreatorApplicationsController {
  constructor(private readonly service: CreatorApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a creator application' })
  @ApiResponse({ status: 201, type: CreatorApplicationResponse })
  async create(@Body() dto: CreateCreatorApplicationDto): Promise<CreatorApplicationResponse> {
    const data = await this.service.create(dto);
    return {
      status: HttpStatus.CREATED,
      error: null,
      data,
    };
  }
}
