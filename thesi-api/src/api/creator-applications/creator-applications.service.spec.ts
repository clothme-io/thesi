import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthService } from 'src/api/auth/auth.service';
import * as schema from 'src/dbConfig/drizzle/schema';
import type { NovuService } from 'src/shared/novu/novu.service';
import { CreatorApplicationsService } from './creator-applications.service';
import { CreateCreatorApplicationDto } from './dto/creator-application.dto';

jest.mock('uuid', () => {
  let sequence = 0;
  return {
    v4: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  };
});

type ApplicationRow = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  city: string;
  country: string;
  tiktokUrl: string;
  instagramUrl: string;
  youtubeUrl?: string | null;
  followerCountRange: string;
  portfolioLink: string;
  [key: string]: unknown;
};

type StoredUser = {
  id: string;
  email: string;
  fullName: string;
  creatorApplicationId: string;
  accountStatus: string;
  mustChangePassword: boolean;
  passwordHash: string;
};

function sqlValues(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if ('value' in node) {
    const value = (node as { value?: unknown }).value;
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.push(item);
      }
    }
  }
  if ('queryChunks' in node) {
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks ?? [];
    for (const chunk of chunks) sqlValues(chunk, out);
  }
  return out;
}

type MemoryQuery = {
  returning: () => Promise<ApplicationRow[]>;
  onConflictDoNothing: () => Promise<void>;
  limit: (count?: number) => Promise<ApplicationRow[]>;
};

type MemoryDb = {
  transaction: <T>(fn: (tx: MemoryDb) => Promise<T>) => Promise<T>;
  insert: (table: unknown) => {
    values: (vals: ApplicationRow) => MemoryQuery;
  };
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => MemoryQuery;
    };
  };
  update: (table: unknown) => {
    set: (patch: Partial<ApplicationRow>) => {
      where: (condition: unknown) => MemoryQuery;
    };
  };
};

function memoryDb(state: {
  applications: Map<string, ApplicationRow>;
  profiles: Array<Record<string, unknown>>;
}): MemoryDb {
  const api: MemoryDb = {
    async transaction<T>(fn: (tx: MemoryDb) => Promise<T>) {
      const applications = new Map(
        [...state.applications.entries()].map(([id, row]) => [id, { ...row }]),
      );
      const profiles = state.profiles.map((row) => ({ ...row }));
      try {
        return await fn(api);
      } catch (error) {
        state.applications = applications;
        state.profiles = profiles;
        throw error;
      }
    },
    insert(table: unknown) {
      return {
        values(vals: ApplicationRow) {
          const save = () => {
            if (table === schema.thesiCreatorApplication) {
              const row = { ...vals };
              state.applications.set(String(vals.id), row);
              return row;
            }
            if (table === schema.creatorProfile) {
              state.profiles.push(vals);
              return vals;
            }
            throw new Error(`unexpected insert ${String(table)}`);
          };
          return {
            returning: () => Promise.resolve([save()]),
            onConflictDoNothing: () => {
              const userId = String(vals.userId);
              if (!state.profiles.some((row) => row.userId === userId)) save();
              return Promise.resolve();
            },
            limit: () => Promise.resolve([]),
          };
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where(condition: unknown) {
              const ids = sqlValues(condition);
              const rows =
                table === schema.thesiCreatorApplication
                  ? [...state.applications.values()].filter((row) =>
                      ids.includes(row.id),
                    )
                  : [];
              return {
                returning: () => Promise.resolve(rows),
                onConflictDoNothing: () => Promise.resolve(),
                limit: (count = rows.length) =>
                  Promise.resolve(rows.slice(0, count)),
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Partial<ApplicationRow>) {
          return {
            where(condition: unknown) {
              return {
                returning: () => {
                  if (table !== schema.thesiCreatorApplication) {
                    throw new Error('unexpected update');
                  }
                  const ids = sqlValues(condition);
                  const row = [...state.applications.values()].find((item) =>
                    ids.includes(item.id),
                  );
                  if (!row) return Promise.resolve([]);
                  Object.assign(row, patch);
                  return Promise.resolve([row]);
                },
                onConflictDoNothing: () => Promise.resolve(),
                limit: () => Promise.resolve([]),
              };
            },
          };
        },
      };
    },
  };
  return api;
}

function applicationDto(
  overrides: Partial<CreateCreatorApplicationDto> = {},
): CreateCreatorApplicationDto {
  return {
    fullName: 'Jane Doe',
    email: 'Jane@Example.com',
    country: 'USA',
    city: 'New York',
    creatorType: 'ugc_creator',
    tiktokUrl: 'https://tiktok.com/@jane',
    instagramUrl: 'https://instagram.com/jane',
    followerCountRange: '1K-5K',
    hasUgcExperience: true,
    portfolioLink: 'https://portfolio.example/jane',
    whyClothme: 'I make UGC',
    interestedCreatorStore: 'yes',
    interestedAffiliate: 'maybe',
    ...overrides,
  } as CreateCreatorApplicationDto;
}

describe('CreatorApplicationsService account provisioning', () => {
  let users: StoredUser[];
  let triggers: Array<Record<string, unknown>>;
  let state: {
    applications: Map<string, ApplicationRow>;
    profiles: Array<Record<string, unknown>>;
  };
  let service: CreatorApplicationsService;

  beforeEach(() => {
    users = [];
    triggers = [];
    state = { applications: new Map(), profiles: [] };
    const auth = {
      createPendingCreatorAccount(input: {
        email: string;
        fullName: string;
        creatorApplicationId: string;
      }) {
        const email = input.email.trim().toLowerCase();
        if (users.some((user) => user.email === email)) {
          throw new ConflictException(
            'A user account already exists for this email',
          );
        }
        const user: StoredUser = {
          id: `user-${users.length + 1}`,
          email,
          fullName: input.fullName,
          creatorApplicationId: input.creatorApplicationId,
          accountStatus: 'pending',
          mustChangePassword: false,
          passwordHash: '$pending$',
        };
        users.push(user);
        return user;
      },
      activateCreatorAccount(input: {
        email: string;
        fullName: string;
        creatorApplicationId: string;
        tempPassword: string;
      }) {
        let user = users.find(
          (item) => item.creatorApplicationId === input.creatorApplicationId,
        );
        if (user?.accountStatus === 'disabled') {
          throw new ConflictException('This creator account is disabled');
        }
        if (!user) {
          user = {
            id: `user-${users.length + 1}`,
            email: input.email.trim().toLowerCase(),
            fullName: input.fullName,
            creatorApplicationId: input.creatorApplicationId,
            accountStatus: 'active',
            mustChangePassword: true,
            passwordHash: `hashed:${input.tempPassword}`,
          };
          users.push(user);
          return user;
        }
        user.accountStatus = 'active';
        user.mustChangePassword = true;
        user.passwordHash = `hashed:${input.tempPassword}`;
        return user;
      },
      disableCreatorAccount(creatorApplicationId: string) {
        const user = users.find(
          (item) => item.creatorApplicationId === creatorApplicationId,
        );
        if (!user) return;
        user.accountStatus = 'disabled';
        user.passwordHash = '$pending$';
        user.mustChangePassword = false;
      },
      resetCreatorTemporaryPassword(
        creatorApplicationId: string,
        tempPassword: string,
      ) {
        const user = users.find(
          (item) => item.creatorApplicationId === creatorApplicationId,
        );
        if (!user) {
          throw new ConflictException(
            'No creator account exists for this application',
          );
        }
        user.accountStatus = 'active';
        user.mustChangePassword = true;
        user.passwordHash = `hashed:${tempPassword}`;
        return user;
      },
    };
    const novu = {
      trigger: (event: Record<string, unknown>) => {
        triggers.push(event);
        return Promise.resolve('txn');
      },
    };
    service = new CreatorApplicationsService(
      memoryDb(state) as never,
      novu as unknown as NovuService,
      auth as unknown as AuthService,
    );
  });

  it('creates a pending account and does not email a password', async () => {
    const created = await service.create(applicationDto());

    expect(created.status).toBe('applied');
    expect(created.email).toBe('jane@example.com');
    expect(state.applications.size).toBe(1);
    expect(state.profiles).toHaveLength(0);
    expect(users).toEqual([
      expect.objectContaining({
        email: 'jane@example.com',
        accountStatus: 'pending',
        mustChangePassword: false,
        passwordHash: '$pending$',
        creatorApplicationId: created.id,
      }),
    ]);
    expect(triggers).toEqual([
      expect.objectContaining({
        type: 'creator_application_received',
        toEmail: 'jane@example.com',
      }),
    ]);
    expect(triggers[0]).not.toHaveProperty('temporaryPassword');
  });

  it('rejects a second application for an email that already has an account', async () => {
    await service.create(applicationDto());
    await expect(service.create(applicationDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.applications.size).toBe(1);
    expect(users).toHaveLength(1);
  });

  it('activates the pending account and emails the temporary password on approval', async () => {
    const created = await service.create(applicationDto());
    triggers.length = 0;

    const approved = await service.approve(created.id);

    expect(approved.status).toBe('approved');
    expect(users[0]).toEqual(
      expect.objectContaining({
        accountStatus: 'active',
        mustChangePassword: true,
      }),
    );
    expect(users[0].passwordHash.startsWith('hashed:')).toBe(true);
    expect(state.profiles).toEqual([
      expect.objectContaining({ userId: users[0].id, displayName: 'Jane Doe' }),
    ]);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      type: 'creator_account_approved',
      toEmail: 'jane@example.com',
    });
    expect(typeof triggers[0].temporaryPassword).toBe('string');
    expect(String(triggers[0].temporaryPassword).length).toBeGreaterThan(0);
  });

  it('does not send another email when the application is already approved', async () => {
    const created = await service.create(applicationDto());
    await service.approve(created.id);
    triggers.length = 0;

    await service.approve(created.id);

    expect(triggers).toEqual([]);
  });

  it('creates the account during approval when the application predates pending accounts', async () => {
    const created = await service.create(applicationDto());
    users.length = 0;
    triggers.length = 0;

    await service.approve(created.id);

    expect(users).toEqual([
      expect.objectContaining({
        creatorApplicationId: created.id,
        accountStatus: 'active',
        mustChangePassword: true,
      }),
    ]);
    expect(triggers[0]).toEqual(
      expect.objectContaining({ type: 'creator_account_approved' }),
    );
  });

  it('disables the pending account on reject and blocks later approval', async () => {
    const created = await service.create(applicationDto());

    const rejected = await service.reject(created.id);

    expect(rejected.status).toBe('rejected');
    expect(users[0].accountStatus).toBe('disabled');
    expect(
      triggers.some((event) => event.type === 'creator_account_approved'),
    ).toBe(false);
    await expect(service.approve(created.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(users[0].accountStatus).toBe('disabled');
  });

  it('does not reject an approved creator', async () => {
    const created = await service.create(applicationDto());
    await service.approve(created.id);

    await expect(service.reject(created.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.applications.get(created.id)?.status).toBe('approved');
    expect(users[0].accountStatus).toBe('active');
  });

  it('resends a temporary password only after approval', async () => {
    const created = await service.create(applicationDto());
    await expect(service.resendInvite(created.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    await service.approve(created.id);
    const firstPassword = String(triggers.at(-1)?.temporaryPassword);
    triggers.length = 0;

    await service.resendInvite(created.id);

    expect(users[0].mustChangePassword).toBe(true);
    expect(users[0].accountStatus).toBe('active');
    const resentPassword = String(triggers[0]?.temporaryPassword);
    expect(resentPassword).not.toBe(firstPassword);
    expect(triggers[0]).toEqual(
      expect.objectContaining({
        type: 'creator_account_approved',
        toEmail: 'jane@example.com',
      }),
    );
  });

  it('returns not found for an unknown application', async () => {
    await expect(service.approve('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.reject('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
