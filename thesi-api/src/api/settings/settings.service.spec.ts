import { ForbiddenException } from '@nestjs/common';
import type {
  BrandSettingsDto,
  CreatorSettingsDto,
} from './dto/settings.dto';
import type {
  SettingsRepository,
  SettingsRow,
  SettingsUser,
} from './settings.repository';
import { SettingsService } from './settings.service';

class FakeSettingsRepository implements SettingsRepository {
  user: SettingsUser | null = null;
  row: SettingsRow | null = null;

  async getUser() {
    return this.user;
  }

  async get() {
    return this.row;
  }

  async upsertCreator(_userId: string, settings: CreatorSettingsDto) {
    this.row = { ...baseRow(), ...settings };
    return this.row;
  }

  async upsertBrand(_userId: string, settings: BrandSettingsDto) {
    this.row = { ...baseRow(), ...settings };
    return this.row;
  }
}

describe('SettingsService', () => {
  let repository: FakeSettingsRepository;
  let service: SettingsService;

  beforeEach(() => {
    repository = new FakeSettingsRepository();
    service = new SettingsService(repository);
  });

  it('returns creator defaults before first save', async () => {
    repository.user = { id: 'creator-1', role: 'creator' };

    await expect(service.getCurrent('creator-1')).resolves.toEqual({
      timezone: 'America/Los_Angeles',
      dateFormat: 'mdy',
      compactSidebar: false,
      emailNotifications: true,
      paymentReminders: true,
      marketingEmails: false,
      dealUpdates: true,
      taskReminders: true,
    });
  });

  it('saves only the brand-facing settings contract', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    const input: BrandSettingsDto = {
      timezone: 'Europe/London',
      dateFormat: 'dmy',
      compactSidebar: true,
      emailNotifications: true,
      paymentReminders: false,
      marketingEmails: false,
      campaignUpdates: true,
      creatorApplications: false,
      marketplaceActivity: true,
    };

    await expect(service.updateBrand('brand-1', input)).resolves.toEqual(input);
  });

  it('prevents a creator from updating brand settings', async () => {
    repository.user = { id: 'creator-1', role: 'creator' };

    await expect(
      service.updateBrand('creator-1', {
        timezone: 'America/Los_Angeles',
        dateFormat: 'mdy',
        compactSidebar: false,
        emailNotifications: true,
        paymentReminders: true,
        marketingEmails: false,
        campaignUpdates: true,
        creatorApplications: true,
        marketplaceActivity: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function baseRow(): SettingsRow {
  return {
    timezone: 'America/Los_Angeles',
    dateFormat: 'mdy',
    compactSidebar: false,
    emailNotifications: true,
    paymentReminders: true,
    marketingEmails: false,
    dealUpdates: true,
    taskReminders: true,
    campaignUpdates: true,
    creatorApplications: true,
    marketplaceActivity: true,
  };
}
