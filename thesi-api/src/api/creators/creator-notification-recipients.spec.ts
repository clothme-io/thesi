import { activeCreatorRecipients } from './creator-notification-recipients';

describe('activeCreatorRecipients', () => {
  it('keeps each active creator email once', () => {
    expect(
      activeCreatorRecipients([
        candidate({ id: 'a', email: 'Ada@example.com', fullName: 'Ada' }),
        candidate({
          id: 'b',
          email: ' ada@example.com ',
          fullName: 'Ada Again',
        }),
        candidate({ id: 'c', email: 'Bea@example.com', fullName: 'Bea' }),
        candidate({ id: 'd', email: '   ', fullName: 'No Email' }),
      ]),
    ).toEqual([
      { id: 'a', email: 'Ada@example.com', name: 'Ada' },
      { id: 'c', email: 'Bea@example.com', name: 'Bea' },
    ]);
  });

  it('skips pending and disabled accounts', () => {
    expect(
      activeCreatorRecipients([
        candidate({ id: 'pending', accountStatus: 'pending' }),
        candidate({ id: 'disabled', accountStatus: 'disabled' }),
        candidate({ id: 'brand', role: 'brand', email: 'brand@example.com' }),
      ]),
    ).toEqual([]);
  });
});

function candidate(
  overrides: Partial<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    accountStatus: string;
  }> = {},
) {
  return {
    id: 'creator-1',
    email: 'creator@example.com',
    fullName: 'Creator',
    role: 'creator',
    accountStatus: 'active',
    ...overrides,
  };
}
