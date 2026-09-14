import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CampaignProductsService } from './campaign-products.service';
@Controller('product-preview')
export class ProductPreviewController {
  constructor(private readonly products: CampaignProductsService) {}
  @Get(':brandId/:productId')
  async get(@Param('brandId', ParseUUIDPipe) brandId: string, @Param('productId', ParseUUIDPipe) productId: string) {
    return { data: await this.products.preview(brandId, productId), error: null, status: 200 };
  }
}
