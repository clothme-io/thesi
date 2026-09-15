import {
  EarningsIngestionGuard,
  EarningsOperationsGuard,
} from './commission-earnings.controller';
import { CommissionEventDto } from './commission-event.dto';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ctx = (header: string, value: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { [header]: value } }),
    }),
  }) as any;
describe('commission service credentials', () => {
  const config = {
    get: (k: string) =>
      k === 'EARNINGS_SERVICE_KEY' ? 'i'.repeat(32) : 'r'.repeat(32),
  } as any;
  it('separates financial writes from operations reads', () => {
    expect(
      new EarningsIngestionGuard(config).canActivate(
        ctx('x-thesi-earnings-key', 'i'.repeat(32)),
      ),
    ).toBe(true);
    expect(() =>
      new EarningsIngestionGuard(config).canActivate(
        ctx('x-thesi-earnings-key', 'r'.repeat(32)),
      ),
    ).toThrow();
    expect(
      new EarningsOperationsGuard(config).canActivate(
        ctx('x-thesi-report-key', 'r'.repeat(32)),
      ),
    ).toBe(true);
    expect(() =>
      new EarningsOperationsGuard(config).canActivate(
        ctx('x-thesi-report-key', 'i'.repeat(32)),
      ),
    ).toThrow();
  });
  it.each([undefined, ['i'.repeat(32)], 'short'])(
    'rejects missing, repeated and malformed keys',
    (v) =>
      expect(() =>
        new EarningsIngestionGuard(config).canActivate(
          ctx('x-thesi-earnings-key', v),
        ),
      ).toThrow(),
  );
  it('requires authoritative financial fields', async () => {
    const dto = new CommissionEventDto();
    Object.assign(dto, {
      revision: 1,
      currency: 'USD',
      fullyRefunded: false,
      holdReasons: [],
      evidence: 'stripe_verified',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'netSaleCents')).toBe(true);
    expect(errors.some((e) => e.property === 'platformFeeCents')).toBe(true);
    expect(errors.some((e) => e.property === 'receiptId')).toBe(true);
  });
  it('reports base payment movement through funding operations', () => {
    const serviceSource = readFileSync(
      join(__dirname, 'commission-earnings.service.ts'),
      'utf8',
    );

    expect(serviceSource).toContain(
      'JOIN thesi.campaign_fund_operation op ON op.id=fe.operation_id JOIN obligation_scope o ON o.id=op.obligation_id',
    );
    expect(serviceSource).not.toContain('fe.obligation_id');
  });
});
