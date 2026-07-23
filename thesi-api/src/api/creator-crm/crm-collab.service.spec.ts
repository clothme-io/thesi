import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CrmCollabService } from './crm-collab.service';
import type { CreatorCrmRepository } from './creator-crm.repository';
import type {
  CrmCollabSnapshot,
  CrmIntegrationConnectionDto,
  CrmWorkspaceDto,
  CrmWorkspaceMemberDto,
  PostgresCrmCollabRepository,
} from './postgres-crm-collab.repository';

describe('CrmCollabService', () => {
  const workspace: CrmWorkspaceDto = {
    id: 'ws-1',
    ownerUserId: 'creator-1',
    name: 'My CRM',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ownerMember: CrmWorkspaceMemberDto = {
    id: 'mem-1',
    workspaceId: 'ws-1',
    userId: 'creator-1',
    email: 'creator@example.com',
    role: 'owner',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let connections: CrmIntegrationConnectionDto[];
  let members: CrmWorkspaceMemberDto[];
  let collab: {
    getUser: jest.Mock;
    ensureWorkspace: jest.Mock;
    getSnapshot: jest.Mock;
    createInvite: jest.Mock;
    listMembers: jest.Mock;
    removeMember: jest.Mock;
    ensureDefaultConnections: jest.Mock;
    connectProvider: jest.Mock;
    getConnection: jest.Mock;
    createSyncRun: jest.Mock;
    insertSyncedEmail: jest.Mock;
    insertSyncedCalendarEvent: jest.Mock;
    markSynced: jest.Mock;
    finishSyncRun: jest.Mock;
    createActivity?: never;
  };
  let crm: {
    getAggregate: jest.Mock;
    createActivity: jest.Mock;
    createCalendarEvent: jest.Mock;
  };
  let service: CrmCollabService;

  beforeEach(() => {
    members = [ownerMember];
    connections = [
      {
        id: 'conn-mail',
        workspaceId: 'ws-1',
        provider: 'gmail',
        accountEmail: '',
        status: 'disconnected',
        scopes: [],
        lastError: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const snapshot = (): CrmCollabSnapshot => ({
      workspace,
      members: [...members],
      connections: [...connections],
      syncedEmails: [],
      syncedCalendarEvents: [],
    });

    collab = {
      getUser: jest.fn(async (id: string) =>
        id === 'creator-1'
          ? {
              id: 'creator-1',
              role: 'creator',
              email: 'creator@example.com',
              fullName: 'Creator',
            }
          : null,
      ),
      ensureWorkspace: jest.fn(async () => workspace),
      getSnapshot: jest.fn(async () => snapshot()),
      createInvite: jest.fn(async (input: { email: string; role: string }) => {
        const member: CrmWorkspaceMemberDto = {
          id: 'mem-2',
          workspaceId: 'ws-1',
          email: input.email,
          role: input.role as CrmWorkspaceMemberDto['role'],
          status: 'invited',
          inviteToken: 'token-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        members.push(member);
        return member;
      }),
      listMembers: jest.fn(async () => members),
      removeMember: jest.fn(async (_ws: string, memberId: string) => {
        members = members.map((member) =>
          member.id === memberId
            ? { ...member, status: 'removed' as const }
            : member,
        );
        return members.find((member) => member.id === memberId) ?? null;
      }),
      ensureDefaultConnections: jest.fn(async () => connections),
      connectProvider: jest.fn(async () => {
        connections[0] = {
          ...connections[0],
          status: 'stub',
          accountEmail: 'creator@gmail.com',
        };
        return connections[0];
      }),
      getConnection: jest.fn(async () => connections[0]),
      createSyncRun: jest.fn(async () => ({ id: 'run-1' })),
      insertSyncedEmail: jest.fn(async () => ({
        id: 'email-1',
        connectionId: 'conn-mail',
        direction: 'inbound' as const,
        fromEmail: 'a@b.com',
        toEmail: 'creator@gmail.com',
        subject: 'Hello',
        snippet: 'Hi',
        sentAt: new Date().toISOString(),
      })),
      insertSyncedCalendarEvent: jest.fn(),
      markSynced: jest.fn(),
      finishSyncRun: jest.fn(),
    };

    crm = {
      getAggregate: jest.fn(async () => ({
        brands: [
          {
            id: 'brand-1',
            name: 'Acme',
            contactName: 'A',
            email: 'a@acme.com',
            phone: '',
            website: '',
            relationshipStage: 'prospect',
            tags: [],
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        people: [],
        deals: [],
        jobs: [],
        contracts: [],
        payments: [],
        calendarEvents: [],
        tasks: [],
        activities: [],
        customObjects: [],
        customFields: [],
        customRecords: [],
        entityFieldValues: [],
        workflows: [],
      })),
      createActivity: jest.fn(async () => ({
        id: 'act-1',
        type: 'email_received',
        message: 'Email received',
        createdAt: new Date().toISOString(),
      })),
      createCalendarEvent: jest.fn(),
    };

    service = new CrmCollabService(
      collab as unknown as PostgresCrmCollabRepository,
      crm as unknown as CreatorCrmRepository,
    );
  });

  it('invites a teammate', async () => {
    const data = await service.inviteMember('creator-1', {
      email: 'teammate@agency.com',
      role: 'member',
    });
    expect(data.members.some((m) => m.email === 'teammate@agency.com')).toBe(
      true,
    );
  });

  it('rejects non-creators', async () => {
    collab.getUser.mockResolvedValueOnce({
      id: 'brand-1',
      role: 'brand',
      email: 'b@b.com',
    });
    await expect(service.getSnapshot('brand-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('connects and syncs a mail provider stub', async () => {
    await service.connectIntegration(
      'creator-1',
      'conn-mail',
      'creator@gmail.com',
    );
    connections[0].status = 'stub';
    connections[0].accountEmail = 'creator@gmail.com';
    const data = await service.syncIntegration('creator-1', 'conn-mail');
    expect(collab.insertSyncedEmail).toHaveBeenCalled();
    expect(crm.createActivity).toHaveBeenCalled();
    expect(data.connections[0].status).toBe('stub');
  });

  it('fails sync when disconnected', async () => {
    await expect(
      service.syncIntegration('creator-1', 'conn-mail'),
    ).rejects.toBeInstanceOf(Error);
  });

  it('fails when user missing', async () => {
    collab.getUser.mockResolvedValueOnce(null);
    await expect(service.getSnapshot('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
