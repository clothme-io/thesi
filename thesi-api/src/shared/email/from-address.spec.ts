import { parseFromAddress } from './from-address';

describe('parseFromAddress', () => {
  it('splits display name and email', () => {
    expect(parseFromAddress('Thesi <noreply@thesi.clothme.io>')).toEqual({
      email: 'noreply@thesi.clothme.io',
      name: 'Thesi',
    });
  });

  it('keeps a bare address', () => {
    expect(parseFromAddress('noreply@thesi.clothme.io')).toEqual({
      email: 'noreply@thesi.clothme.io',
    });
  });
});
