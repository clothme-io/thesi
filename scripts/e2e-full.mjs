#!/usr/bin/env node
/**
 * Full Thesi E2E against local API + DB (+ web BFF where noted).
 * Run with: node scripts/e2e-full.mjs
 */
const API = process.env.THESI_API_URL || 'http://localhost:5010/v1';
const WEB = process.env.THESI_WEB_URL || 'http://localhost:3000';
const ADMIN_KEY =
  process.env.ADMIN_API_KEY || 'thesi-local-admin-key-change-before-production';

const stamp = Date.now();
const brandEmail = `brand.e2e.${stamp}@example.com`;
const creatorEmail = `creator.e2e.${stamp}@example.com`;
const password = 'TestPass123!';

const results = [];

function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, text };
}

async function web(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${WEB}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

async function setCreatorPassword(email, newPassword) {
  const { execFileSync } = await import('node:child_process');
  const hash = execFileSync(
    process.execPath,
    [
      '-e',
      `require('bcryptjs').hash(${JSON.stringify(newPassword)},10).then(h=>process.stdout.write(h))`,
    ],
    {
      cwd: '/Users/paulikhane/Documents/projects/thesi/thesi-api',
      encoding: 'utf8',
    },
  );
  // Use execFile (no shell) so bcrypt `$` chars are not expanded.
  const out = execFileSync(
    'psql',
    [
      '-h',
      'localhost',
      '-p',
      '5434',
      '-U',
      'postgres',
      '-d',
      'thesi',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-c',
      `UPDATE public.thesi_users SET password_hash='${hash.replace(/'/g, "''")}', must_change_password=false, onboarding_completed=true, onboarding_step='complete' WHERE email='${email.toLowerCase().replace(/'/g, "''")}' RETURNING id;`,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: 'postgres' },
    },
  );
  if (!String(out).trim()) {
    throw new Error(`No user row for ${email}`);
  }
}

async function main() {
  // Health
  {
    const { res, json } = await api('/health');
    if (res.ok) ok('API health', JSON.stringify(json?.data || json));
    else fail('API health', `${res.status}`);
  }
  {
    const res = await fetch(`${WEB}/sign-in`);
    if (res.ok) ok('Web sign-in page', String(res.status));
    else fail('Web sign-in page', String(res.status));
  }

  // Brand signup + onboarding
  let brandToken = '';
  let brandUserId = '';
  {
    const { res, json } = await api('/auth/signup', {
      method: 'POST',
      body: {
        fullName: 'E2E Brand Owner',
        companyName: 'E2E Brand Co',
        email: brandEmail,
        password,
      },
    });
    if (res.ok && json?.data?.accessToken) {
      brandToken = json.data.accessToken;
      brandUserId = json.data.user.id;
      ok('Brand signup', brandEmail);
    } else fail('Brand signup', JSON.stringify(json));
  }
  {
    const { res, json } = await api('/onboarding/welcome', {
      method: 'POST',
      token: brandToken,
      body: {},
    });
    if (res.ok) ok('Brand welcome onboarding');
    else fail('Brand welcome onboarding', JSON.stringify(json));
  }
  {
    const { res, json } = await api('/onboarding/questions', {
      method: 'POST',
      token: brandToken,
      body: {
        companySize: '11-50',
        monthlyCampaigns: '2-5',
        primaryGoal: 'ugc',
        budgetRange: '1k-5k',
        hearAbout: 'other',
      },
    });
    if (res.ok && json?.data?.user?.onboardingCompleted) ok('Brand onboarding questions');
    else fail('Brand onboarding questions', JSON.stringify(json));
  }

  // Brand profile
  {
    const { res, json } = await api('/profile/brand', {
      method: 'PUT',
      token: brandToken,
      body: {
        companyName: 'E2E Brand Co',
        tagline: 'UGC that converts',
        about: 'E2E brand for integration testing',
        website: 'https://e2e-brand.example',
        headquarters: 'San Francisco, CA',
        industry: 'Fashion',
        instagram: '@e2ebrand',
        tiktok: '@e2ebrand',
        youtube: '',
        linkedin: '',
        companySize: '11-50',
        typicalBudgetRange: '$1k-$5k',
        primaryGoal: 'More authentic UGC',
        preferredCreatorNiches: ['Fashion', 'Lifestyle'],
        preferredPlatforms: ['TikTok', 'Instagram'],
      },
    });
    if (res.ok) ok('Brand profile save');
    else fail('Brand profile save', JSON.stringify(json));
  }
  {
    const { res, json } = await web('/api/profile', { token: brandToken });
    if (res.ok && json?.data) ok('Web BFF profile', 'GET /api/profile');
    else fail('Web BFF profile', `${res.status} ${JSON.stringify(json)}`);
  }

  // Settings
  {
    const { res, json } = await api('/settings', { token: brandToken });
    if (res.ok) ok('Brand settings GET');
    else fail('Brand settings GET', JSON.stringify(json));
  }

  // Campaign + marketplace sync
  let campaignId = '';
  {
    const { res, json } = await api('/campaigns', {
      method: 'POST',
      token: brandToken,
      body: {
        name: 'E2E Summer Drop',
        campaignType: 'experience',
        type: 'tiktok',
        status: 'active',
        startDate: '2026-07-20',
        endDate: '2026-08-20',
        brief: 'Create authentic TikTok UGC for our summer collection.',
        deliverables: '3 TikTok videos',
        exampleVideoLinks: ['https://www.tiktok.com/@example/video/e2e'],
        requirements: {
          niches: ['Fashion'],
          minFollowersRange: '1K-5K',
          location: 'Remote',
          platforms: ['TikTok'],
        },
        files: [],
        payment: { model: 'flat_rate', flatRateCents: 50000 },
        postToMarketplace: true,
      },
    });
    if (res.ok && json?.data?.id) {
      campaignId = json.data.id;
      ok('Campaign create (marketplace)', campaignId);
    } else fail('Campaign create (marketplace)', JSON.stringify(json));
  }

  // File upload
  {
    const form = new FormData();
    form.append(
      'file',
      new Blob(['e2e brief content'], { type: 'text/plain' }),
      'brief.txt',
    );
    const res = await fetch(`${API}/campaigns/${campaignId}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${brandToken}` },
      body: form,
    });
    const json = await res.json();
    if (res.ok) ok('Campaign file upload', json?.data?.id || json?.data?.name);
    else fail('Campaign file upload', JSON.stringify(json));
  }

  // Marketplace listing exists
  let listingId = '';
  {
    const { res, json } = await api('/marketplace', { token: brandToken });
    const listings = json?.data?.listings || [];
    const found = listings.find((l) => l.campaignId === campaignId);
    if (res.ok && found) {
      listingId = found.id;
      ok('Marketplace sync from campaign', listingId);
    } else fail('Marketplace sync from campaign', JSON.stringify(json));
  }

  // Creator application + approve
  let applicationId = '';
  {
    const { res, json } = await api('/creator-applications', {
      method: 'POST',
      body: {
        fullName: 'E2E Creator',
        email: creatorEmail,
        country: 'USA',
        city: 'Austin',
        creatorType: 'ugc_creator',
        tiktokUrl: 'https://tiktok.com/@e2ecreator',
        instagramUrl: 'https://instagram.com/e2ecreator',
        followerCountRange: '1K-5K',
        hasUgcExperience: true,
        portfolioLink: 'https://e2e-creator.example/work',
        whyClothme: 'I want to grow a UGC business with brand deals.',
        interestedCreatorStore: 'yes',
        interestedAffiliate: 'maybe',
      },
    });
    if (res.ok && json?.data?.id) {
      applicationId = json.data.id;
      ok('Creator application submit', applicationId);
    } else fail('Creator application submit', JSON.stringify(json));
  }
  {
    const { res, json } = await api(
      `/creator-applications/${applicationId}/approve`,
      {
        method: 'PATCH',
        headers: { 'X-Admin-Api-Key': ADMIN_KEY },
        body: {},
      },
    );
    // 502 = account created but outbound email provider failed (common locally with bad RESEND key)
    if (res.ok) ok('Creator application approve');
    else if (
      res.status === 502 &&
      String(json?.error?.message || '').includes('account was created')
    ) {
      ok('Creator application approve', 'account created; email delivery skipped locally');
    } else fail('Creator application approve', JSON.stringify(json));
  }

  // Set known password for creator (email logs temp password; DB update for automation)
  try {
    await setCreatorPassword(creatorEmail, password);
    ok('Creator password set for E2E login');
  } catch (e) {
    fail('Creator password set for E2E login', String(e));
  }

  let creatorToken = '';
  let creatorUserId = '';
  {
    const { res, json } = await api('/auth/signin', {
      method: 'POST',
      body: { email: creatorEmail, password },
    });
    if (res.ok && json?.data?.accessToken) {
      creatorToken = json.data.accessToken;
      creatorUserId = json.data.user.id;
      ok('Creator sign-in', creatorEmail);
    } else fail('Creator sign-in', JSON.stringify(json));
  }

  // Creator profile (directory)
  {
    const { res, json } = await api('/profile/creator', {
      method: 'PUT',
      token: creatorToken,
      body: {
        displayName: 'E2E Creator',
        headline: 'Fashion UGC specialist',
        bio: 'I make TikToks that convert.',
        location: 'Austin, TX',
        website: 'https://e2e-creator.example',
        instagram: '@e2ecreator',
        tiktok: '@e2ecreator',
        youtube: '',
        niches: ['Fashion', 'Lifestyle'],
        rateRange: '$400-$800',
        turnaround: '7 days',
        portfolioUrl: 'https://e2e-creator.example/work',
      },
    });
    if (res.ok) ok('Creator profile save');
    else fail('Creator profile save', JSON.stringify(json));
  }

  // Brand creators directory sees creator
  {
    const { res, json } = await api('/creators', { token: brandToken });
    const creators = json?.data?.creators || [];
    const found = creators.find(
      (c) => c.id === creatorUserId || c.email === creatorEmail,
    );
    if (res.ok && found) ok('Brand creators directory', found.id);
    else fail('Brand creators directory', JSON.stringify(json));
  }

  // Favorites
  {
    const { res, json } = await api(`/creators/${creatorUserId}/favorite`, {
      method: 'POST',
      token: brandToken,
      body: {},
    });
    if (res.ok) ok('Creator favorite add');
    else fail('Creator favorite add', JSON.stringify(json));
  }

  // Campaign invite (inbox delivery)
  {
    const { res, json } = await api('/invites/campaign', {
      method: 'POST',
      token: brandToken,
      body: {
        campaignId,
        campaignName: 'E2E Summer Drop',
        brandName: 'E2E Brand Co',
        creatorId: creatorUserId,
        creatorEmail,
        creatorName: 'E2E Creator',
        external: false,
      },
    });
    if (res.ok && json?.data?.id) ok('Campaign invite (Novu+inbox)', json.data.id);
    else fail('Campaign invite (Novu+inbox)', JSON.stringify(json));
  }

  // Creator inbox has invite
  {
    const { res, json } = await api('/inbox', { token: creatorToken });
    const messages = json?.data?.messages || [];
    const notifs = json?.data?.notifications || [];
    const hasInvite =
      messages.some((m) => m.kind === 'invite') ||
      notifs.some((n) => n.type === 'campaign_invite');
    if (res.ok && hasInvite) {
      ok(
        'Creator inbox invite delivery',
        `${messages.length} msgs, ${notifs.length} notifs`,
      );
    } else fail('Creator inbox invite delivery', JSON.stringify(json));
  }

  // Marketplace apply + CRM link
  {
    const { res, json } = await api(`/marketplace/listings/${listingId}/apply`, {
      method: 'POST',
      token: creatorToken,
      body: {
        pitch: 'I would love to create TikToks for this drop.',
        addToCrm: true,
      },
    });
    if (res.ok) ok('Marketplace apply + CRM');
    else fail('Marketplace apply + CRM', JSON.stringify(json));
  }

  // Creator CRM aggregate has brand/deal
  let dealId = '';
  {
    const { res, json } = await api('/creator-crm', { token: creatorToken });
    const brands = json?.data?.brands || [];
    const deals = json?.data?.deals || [];
    if (res.ok && brands.length > 0 && deals.length > 0) {
      dealId = deals[0].id;
      ok(
        'Creator CRM pipeline from marketplace',
        `${brands.length} brands, ${deals.length} deals`,
      );
    } else fail('Creator CRM pipeline from marketplace', JSON.stringify(json));
  }

  // Move deal stage
  if (dealId) {
    const { res, json } = await api(`/creator-crm/deals/${dealId}/stage`, {
      method: 'PATCH',
      token: creatorToken,
      body: { stage: 'pitched' },
    });
    const deals = json?.data?.deals || [];
    if (res.ok && deals.some((d) => d.id === dealId && d.stage === 'pitched')) {
      ok('Creator CRM deal stage move');
    } else fail('Creator CRM deal stage move', JSON.stringify(json));
  } else {
    fail('Creator CRM deal stage move', 'no dealId');
  }

  // Platform brand invite
  {
    const { res, json } = await api('/invites/platform-brand', {
      method: 'POST',
      token: creatorToken,
      body: {
        brandName: 'Prospect Brand',
        brandEmail: `prospect.${stamp}@example.com`,
        invitedBy: 'E2E Creator',
        invitedByEmail: creatorEmail,
        message: 'Join Thesi!',
        addToCrm: true,
      },
    });
    if (res.ok) ok('Platform brand invite + CRM brand');
    else fail('Platform brand invite + CRM brand', JSON.stringify(json));
  }

  // Billing
  {
    const { res, json } = await api('/billing', {
      method: 'PUT',
      token: brandToken,
      body: {
        billingEmail: brandEmail,
        companyName: 'E2E Brand Co',
        addressLine1: '100 Market St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'United States',
        taxId: '12-3456789',
      },
    });
    if (res.ok && json?.data?.billing?.billingEmail === brandEmail)
      ok('Brand billing save');
    else fail('Brand billing save', JSON.stringify(json));
  }

  // Connect payout transfer (brand → creator Express)
  {
    const { res, json } = await api(`/campaigns/${campaignId}/pay-creator`, {
      method: 'POST',
      token: brandToken,
      body: { creatorUserId },
    });
    if (
      res.ok &&
      json?.data?.status === 'transferred' &&
      String(json?.data?.stripeTransferId || '').startsWith('tr_')
    ) {
      ok('Creator Connect payout transfer', json.data.stripeTransferId);
    } else fail('Creator Connect payout transfer', JSON.stringify(json));
  }

  // Stripe webhooks (unsigned local payload when STRIPE_WEBHOOK_SECRET unset)
  {
    const eventId = `evt_e2e_${stamp}`;
    const body = {
      id: eventId,
      object: 'event',
      api_version: '2024-01-01',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_e2e_local',
          object: 'account',
          details_submitted: true,
          charges_enabled: false,
          payouts_enabled: true,
        },
      },
    };
    const { res, json } = await api('/stripe/webhooks', {
      method: 'POST',
      body,
    });
    if (res.ok && json?.data?.received) ok('Stripe webhook accept', json.data.action);
    else fail('Stripe webhook accept', JSON.stringify(json));

    const again = await api('/stripe/webhooks', { method: 'POST', body });
    if (again.res.ok && again.json?.data?.duplicate)
      ok('Stripe webhook idempotent');
    else fail('Stripe webhook idempotent', JSON.stringify(again.json));
  }

  let invoiceId = '';
  {
    const { res, json } = await api('/billing/invoices', {
      method: 'POST',
      token: brandToken,
      body: {},
    });
    const history = json?.data?.paymentHistory || [];
    if (res.ok && history.length > 0) {
      invoiceId = history[0].id;
      ok('Brand invoice create', history[0].invoiceNumber);
    } else fail('Brand invoice create', JSON.stringify(json));
  }

  if (invoiceId) {
    const res = await fetch(`${API}/billing/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${brandToken}` },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && buf.subarray(0, 4).toString() === '%PDF')
      ok('Brand invoice PDF download', `${buf.length} bytes`);
    else fail('Brand invoice PDF download', `${res.status}`);
  } else {
    fail('Brand invoice PDF download', 'no invoiceId');
  }

  // Web BFF smoke for key routes
  const bffRoutes = [
    ['/api/campaigns', brandToken],
    ['/api/marketplace', brandToken],
    ['/api/creators', brandToken],
    ['/api/inbox', creatorToken],
    ['/api/creator-crm', creatorToken],
    ['/api/billing', brandToken],
    ['/api/invites/campaign', brandToken],
  ];
  for (const [path, token] of bffRoutes) {
    const { res, json } = await web(path, { token });
    if (res.ok && json && (json.data !== undefined || json.error === null)) {
      ok(`Web BFF ${path}`);
    } else
      fail(
        `Web BFF ${path}`,
        `${res.status} ${JSON.stringify(json)?.slice(0, 200)}`,
      );
  }

  // App pages (HTML)
  for (const path of [
    '/app/campaigns',
    '/app/marketplace',
    '/app/creators',
    '/app/inbox',
    '/app/crm/pipeline',
    '/app/settings/billing',
    '/app/settings/payment-history',
  ]) {
    const res = await fetch(`${WEB}${path}`, { redirect: 'manual' });
    // unauthenticated may redirect to sign-in — that's OK for page existence
    if (res.status === 200 || res.status === 307 || res.status === 302) {
      ok(`Web page ${path}`, String(res.status));
    } else fail(`Web page ${path}`, String(res.status));
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log('\n======== E2E SUMMARY ========');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Brand: ${brandEmail}`);
  console.log(`Creator: ${creatorEmail}`);
  console.log(`Password: ${password}`);
  if (brandUserId) console.log(`Brand user id: ${brandUserId}`);
  if (creatorUserId) console.log(`Creator user id: ${creatorUserId}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
