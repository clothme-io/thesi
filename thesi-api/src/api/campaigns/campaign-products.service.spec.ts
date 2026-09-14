import { CampaignProductsService } from './campaign-products.service';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertCampaignDto } from './dto/campaign.dto';
const brand = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const link = {
  id: 'link',
  vendor_id: 'vendor',
  merchant_brand_id: brand,
  workspace_id: 'workspace',
};
const product = {
  productId,
  brandId: brand,
  vendorId: 'vendor',
  title: 'Shirt',
  description: 'Linen',
  imageUrl: 'javascript:bad',
  brandName: 'Brand',
};
describe('Merchant campaign products', () => {
  let enabled: boolean;
  let db: any;
  let service: CampaignProductsService;
  let fetcher: jest.SpyInstance;
  const run = (action: () => any) =>
    workspaceContext.run(
      { workspaceId: 'workspace', actorUserId: 'owner', role: 'owner' },
      action,
    );
  const input = (extra = {}) =>
    ({
      status: 'draft',
      payment: { model: 'commission' },
      ...extra,
    }) as unknown as UpsertCampaignDto;
  beforeEach(() => {
    enabled = true;
    db = { execute: jest.fn().mockResolvedValue({ rows: [link] }) };
    const config = {
      get: () => enabled,
      getOrThrow: (key: string) =>
        ({
          MERCHANT_API_URL: 'https://vendor.test',
          THESI_WEB_URL: 'https://thesi.test',
          MERCHANT_CATALOG_SERVICE_KEY: 'secret',
        })[key],
    };
    service = new CampaignProductsService(db, config as any);
    fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: { products: [product], nextOffset: null } }),
      } as Response);
  });
  afterEach(() => fetcher.mockRestore());
  it('does not read the link database when disabled', async () => {
    enabled = false;
    expect(await service.list('owner')).toMatchObject({ enabled: false });
    expect(db.execute).not.toHaveBeenCalled();
  });
  it('rejects a missing workspace and an unrelated actor', async () => {
    await expect(service.list('owner')).rejects.toThrow('owned brand');
    await expect(run(() => service.list('intruder'))).rejects.toThrow(
      'owned brand',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires an active Merchant link', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    await expect(run(() => service.list('owner'))).rejects.toThrow(
      'Connect this brand',
    );
  });
  it('uses trusted link identity and sanitizes the product snapshot', async () => {
    const dto = input({ merchantProductId: productId });
    await run(() => service.prepare('owner', dto));
    expect(dto.payment.promotedProduct).toMatchObject({
      productId,
      linkId: 'link',
      workspaceId: 'workspace',
      imageUrl: null,
      previewUrl: `https://thesi.test/product-preview/${brand}/${productId}`,
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      vendorId: 'vendor',
      brandId: brand,
      productId,
    });
  });
  it('rejects catalog responses from a different Merchant brand', async () => {
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ ...product, brandId: 'other' }],
        nextOffset: null,
      }),
    });
    await expect(
      run(() =>
        service.prepare('owner', input({ merchantProductId: productId })),
      ),
    ).rejects.toThrow('identity');
  });
  it('rejects link revocation during product selection', async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [link] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      run(() =>
        service.prepare('owner', input({ merchantProductId: productId })),
      ),
    ).rejects.toThrow('Connect this brand');
  });
  it('requires a product for a new published commission campaign, but permits incomplete drafts', async () => {
    await expect(
      run(() => service.prepare('owner', input({ status: 'active' }))),
    ).rejects.toThrow('Select a Merchant product');
    await expect(
      run(() => service.prepare('owner', input())),
    ).resolves.toBeUndefined();
  });
  it('preserves the published product snapshot without a catalog refresh', async () => {
    const previous = {
      ...product,
      linkId: 'link',
      workspaceId: 'workspace',
      previewUrl: 'old',
      verifiedAt: 'old',
    };
    const dto = input({ status: 'active' });
    await service.prepare('owner', dto, {
      status: 'active',
      payment: { promotedProduct: previous },
    } as any);
    expect(dto.payment.promotedProduct).toBe(previous);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      service.prepare('owner', input({ merchantProductId: null }), {
        status: 'active',
        payment: { promotedProduct: previous },
      } as any),
    ).rejects.toThrow('locked');
  });
  it('grandfathers existing published commission campaigns without a product', async () => {
    await expect(
      service.prepare('owner', input({ status: 'active' }), {
        status: 'active',
        payment: { model: 'commission' },
      } as any),
    ).resolves.toBeUndefined();
  });
  it('rejects browser-provided product snapshots at the DTO boundary', async () => {
    const dto = plainToInstance(UpsertCampaignDto, {
      status: 'draft',
      payment: { model: 'commission', promotedProduct: product },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(JSON.stringify(errors)).toContain(
      'promotedProduct should not exist',
    );
  });
  it('returns only public fields in the preview', async () => {
    const result = await service.preview(brand, productId);
    expect(Object.keys(result).sort()).toEqual([
      'brandName',
      'description',
      'imageUrl',
      'title',
    ]);
  });
});

describe('Multi-product agreements', () => {
  const second = '33333333-3333-4333-8333-333333333333';
  const variant = '44444444-4444-4444-8444-444444444444';
  const otherVariant = '55555555-5555-4555-8555-555555555555';
  const variantData = {
    id: variant,
    color: 'Blue',
    size: 'M',
    priceCents: 3000,
    currency: 'USD',
  };
  let enabled: boolean;
  let service: CampaignProductsService;
  let fetcher: jest.SpyInstance;
  const run = (action: () => any) =>
    workspaceContext.run(
      { workspaceId: 'workspace', actorUserId: 'owner', role: 'owner' },
      action,
    );
  const input = (extra = {}) =>
    ({
      status: 'draft',
      payment: { model: 'commission' },
      merchantProducts: [
        { productId, variantIds: [variant] },
        { productId: second },
      ],
      ...extra,
    }) as unknown as UpsertCampaignDto;
  beforeEach(() => {
    enabled = true;
    service = new CampaignProductsService(
      { execute: jest.fn().mockResolvedValue({ rows: [link] }) } as any,
      {
        get: (key: string) =>
          key === 'CAMPAIGN_MULTI_PRODUCTS_ENABLED' ? enabled : true,
        getOrThrow: (key: string) =>
          key === 'MERCHANT_API_URL'
            ? 'https://vendor.test'
            : key === 'THESI_WEB_URL'
              ? 'https://thesi.test'
              : 'secret',
      } as any,
    );
    fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (_url, options) =>
          ({
            ok: true,
            json: async () => ({
              products: [
                {
                  ...product,
                  productId: JSON.parse(options!.body as string).productId,
                  variants: [
                    variantData,
                    { ...variantData, id: otherVariant, size: 'L' },
                  ],
                },
              ],
              nextOffset: null,
            }),
          }) as Response,
      );
  });
  afterEach(() => fetcher.mockRestore());
  it('records trusted prices and selected variants for each product', async () => {
    const dto = input();
    await run(() => service.prepare('owner', dto));
    expect(dto.payment.promotedProducts).toHaveLength(2);
    expect(dto.payment.promotedProducts![0].variants).toEqual([variantData]);
    expect(dto.payment.promotedProducts![1].variants).toHaveLength(2);
    expect(dto.payment.promotedProduct).toEqual(
      dto.payment.promotedProducts![0],
    );
  });
  it('rejects foreign, empty, duplicate variants and duplicate products', async () => {
    for (const variantIds of [[second], [], [variant, variant]])
      await expect(
        run(() =>
          service.prepare(
            'owner',
            input({ merchantProducts: [{ productId, variantIds }] }),
          ),
        ),
      ).rejects.toThrow('variants');
    await expect(
      run(() =>
        service.prepare(
          'owner',
          input({ merchantProducts: [{ productId }, { productId }] }),
        ),
      ),
    ).rejects.toThrow('distinct');
  });
  it('rejects a different commission currency', async () => {
    await expect(
      run(() =>
        service.prepare(
          'owner',
          input({
            payment: {
              model: 'commission',
              hybrid: { affiliate: { currency: 'EUR' } },
            },
          }),
        ),
      ),
    ).rejects.toThrow('currency');
  });
  it.each(['active', 'draft'])(
    'freezes accepted/prefunded %s terms including prices',
    async (status) => {
      const original = input();
      await run(() => service.prepare('owner', original));
      fetcher.mockClear();
      const existing = { status, payment: original.payment } as any;
      const dto = input({
        merchantProducts: original.payment
          .promotedProducts!.map((p) => ({
            productId: p.productId,
            variantIds: p.variants!.map((v) => v.id),
          }))
          .reverse(),
      });
      await service.prepare('owner', dto, existing, true);
      expect(dto.payment.promotedProducts).toEqual(
        original.payment.promotedProducts,
      );
      expect(fetcher).not.toHaveBeenCalled();
      await expect(
        service.prepare(
          'owner',
          input({
            merchantProducts: [{ productId, variantIds: [otherVariant] }],
          }),
          existing,
          true,
        ),
      ).rejects.toThrow('locked');
    },
  );
  it('allows unchanged draft maintenance when paused but blocks activation and selection', async () => {
    const original = input();
    await run(() => service.prepare('owner', original));
    enabled = false;
    fetcher.mockClear();
    const existing = { status: 'draft', payment: original.payment } as any;
    const dto = input({ merchantProducts: undefined });
    await service.prepare('owner', dto, existing);
    expect(dto.payment.promotedProducts).toEqual(
      original.payment.promotedProducts,
    );
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      service.prepare(
        'owner',
        input({ status: 'active', merchantProducts: undefined }),
        existing,
      ),
    ).rejects.toThrow('paused');
    await expect(
      service.prepare('owner', input({ merchantProducts: [] }), existing),
    ).rejects.toThrow('paused');
  });
  it('rejects browser-provided multi-product snapshots', async () => {
    const dto = plainToInstance(UpsertCampaignDto, {
      payment: { model: 'commission', promotedProducts: [product] },
    });
    expect(
      JSON.stringify(
        await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
      ),
    ).toContain('promotedProducts should not exist');
  });
});

describe('commission rule rollout and preservation',()=>{
 const old={version:1,reviewDays:30,payoutFrequency:'on_approval',minimumPayoutCents:0,creatorFeeCents:0,creditPolicy:'hold_until_verified',selfReferralPolicy:'hold_until_reviewed'};
 const previous={status:'active',payment:{model:'commission',hybrid:{affiliate:{enabled:true,rules:old}}}} as any;
 it('preserves rules omitted by older clients and rejects published changes',async()=>{
  const service=new CampaignProductsService({} as any,{get:()=>false} as any);
  const input={status:'paused',payment:{model:'commission',hybrid:{affiliate:{enabled:true}}}} as any;
  await service.prepare('owner',input,previous);
  expect(input.payment.hybrid.affiliate.rules).toEqual(old);
  await expect(service.prepare('owner',{...input,payment:{...input.payment,hybrid:{affiliate:{enabled:true,rules:{...old,reviewDays:0}}}}},previous)).rejects.toThrow('locked');
 });
 it('does not add defaults to historical campaigns',async()=>{
  const service=new CampaignProductsService({} as any,{get:()=>true} as any);
  const input={status:'paused',payment:{model:'commission',hybrid:{affiliate:{enabled:true}}}} as any;
  await service.prepare('owner',input,{status:'active',payment:{model:'commission'}} as any);
  expect(input.payment.hybrid.affiliate.rules).toBeUndefined();
 });
});
