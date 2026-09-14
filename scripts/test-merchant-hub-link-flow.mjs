// Exercises the actual Hub browser handshake helper with a mocked transport.
// No browser network requests, accounts or persistent data are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { webcrypto, createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'thesi-api/package.json'));
const ts = require('typescript');
const filename = path.resolve(root, '../fashion-merchants-hub/src/lib/thesi/linking.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const stored = new Map(); const requests = []; let redirect = '';
const location = { hash: '', pathname: '/app/settings/integrations/thesi', assign: value => { redirect = value; } };
const modules = {
  '@/network/http': { apiClient: {
    post: async (url, body) => { requests.push({ url, body }); return { status: 200, data: { data: { url: 'https://thesi.example.test/merchant-link#code=example' } } }; },
    get: async () => { throw new Error('Unexpected GET'); },
  } },
  '@/network/envelope': { unwrapEnvelope: (body, status) => ({ result: body.data, status, errorMessage: null }) },
};
const sandbox = { exports: {}, require: id => { if (!modules[id]) throw new Error(id); return modules[id]; }, crypto: webcrypto, TextEncoder, Uint8Array, URL, URLSearchParams, btoa: value => Buffer.from(value, 'binary').toString('base64'), process: { env: { NODE_ENV: 'production' } }, window: { location, history: { replaceState: () => { location.hash = ''; } } }, sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) } };
vm.runInNewContext(output, sandbox, { filename });
const flow = sandbox.exports;
await flow.startThesi('vendor', 'brand', 'link');
const pending = JSON.parse(stored.get('clothme_thesi_link:vendor'));
assert.equal(requests[0].url, '/v1/brands/brand/thesi/start');
assert.equal(requests[0].body.challenge, createHash('sha256').update(pending.verifier).digest('base64url'));
assert.equal(requests[0].body.state, pending.state);
assert(!JSON.stringify(requests[0].body).includes(pending.verifier));
assert(redirect.startsWith('https://thesi.example.test/merchant-link'));
location.hash = `#code=${'c'.repeat(43)}&state=wrong`;
assert.throws(() => flow.readThesiCallback('vendor'), /verification failed/);
location.hash = `#code=${'c'.repeat(43)}&state=${pending.state}`;
const callback = flow.readThesiCallback('vendor');
assert.equal(callback.code, 'c'.repeat(43)); assert.equal(callback.brandId, 'brand');
assert.equal(location.hash, '');
assert.equal(flow.readThesiCallback('vendor').code, callback.code, 'reload preserves a verified callback');
assert.throws(() => flow.readThesiCallback('another-vendor'), /no active connection/);
stored.set('clothme_thesi_link:vendor', JSON.stringify({ ...pending, expiresAt: Date.now() - 1 }));
assert.throws(() => flow.readThesiCallback('vendor'), /no active connection/);
flow.clearThesiFlow('vendor'); assert(!stored.has('clothme_thesi_link:vendor'));
console.log('PASS: actual Merchant Hub browser helper generates PKCE, keeps verifier local, checks state/vendor/expiry, removes URL codes and supports callback reload');
