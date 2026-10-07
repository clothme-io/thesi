import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function service(env: Record<string, string | undefined>): EmailService {
    return new EmailService({
      get: (key: string) => env[key],
      getOrThrow: (key: string) => {
        const value = env[key];
        if (!value) {
          throw new Error(`Missing ${key}`);
        }
        return value;
      },
    } as unknown as ConfigService);
  }

  it('posts HTML mail to the MailerSend email API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await service({
      MAILERSEND_API_KEY: 'ms-test-key',
      EMAIL_FROM: 'Thesi <noreply@thesi.clothme.io>',
      THESI_WEB_URL: 'https://app.get-thesi.test/',
      NODE_ENV: 'test',
    }).send({
      to: 'creator@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mailersend.com/v1/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ms-test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      from: { email: 'noreply@thesi.clothme.io', name: 'Thesi' },
      to: [{ email: 'creator@example.com' }],
      subject: 'Welcome',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('throws when MailerSend rejects the send and Mailtrap is unset', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"message":"Unauthenticated"}',
    }) as unknown as typeof fetch;

    await expect(
      service({
        MAILERSEND_API_KEY: 'bad',
        THESI_WEB_URL: 'https://app.get-thesi.test',
        NODE_ENV: 'test',
      }).send({
        to: 'creator@example.com',
        subject: 'Welcome',
        html: '<p>Hi</p>',
      }),
    ).rejects.toThrow('MailerSend delivery failed (401)');
  });

  it('falls back to Mailtrap when MailerSend fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await service({
      MAILERSEND_API_KEY: 'ms-test-key',
      MAILTRAP_API_KEY: 'mt-test-key',
      EMAIL_FROM: 'Thesi <noreply@thesi.clothme.io>',
      THESI_WEB_URL: 'https://app.get-thesi.test',
      NODE_ENV: 'test',
    }).send({
      to: 'creator@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://send.api.mailtrap.io/api/send',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mt-test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({
      from: { email: 'noreply@thesi.clothme.io', name: 'Thesi' },
      to: [{ email: 'creator@example.com' }],
      subject: 'Welcome',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });
});
