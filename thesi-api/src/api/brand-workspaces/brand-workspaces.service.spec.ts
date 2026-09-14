import { ConfigService } from '@nestjs/config';
import { BrandWorkspacesService } from './brand-workspaces.service';

describe('BrandWorkspacesService', () => {
  it.each([undefined, false, 'false', 'true'])('does not touch the database when the validated flag is %s', async (flag) => {
    const db = { select: jest.fn() };
    const service = new BrandWorkspacesService(db as never, { get: () => flag } as unknown as ConfigService);
    await expect(service.list('brand')).rejects.toThrow('Not found');
    expect(db.select).not.toHaveBeenCalled();
  });
});
