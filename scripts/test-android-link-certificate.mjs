// Generates a disposable signing identity and tests the real association handler.
// Does not sign/install an app, contact a domain, or change release configuration.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'thesi-web/package.json'));
const ts = require('typescript');
const keytool = process.env.THESI_TEST_KEYTOOL ?? '/usr/local/opt/openjdk@17/bin/keytool';
const directory = mkdtempSync(path.join(tmpdir(), 'thesi-android-certificate-'));
const password = randomBytes(24).toString('hex');
const environment = { ...process.env, THESI_TEMP_KEY_PASSWORD: password };
const command = args => execFileSync(keytool, args, { env: environment, stdio: 'pipe' });
const compile = (file, imports, env = {}) => {
  const source = ts.transpileModule(readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, process: { env }, Response };
  vm.runInNewContext(source, sandbox);
  return sandbox.exports;
};
try {
  const keystore = path.join(directory, 'local-test.p12');
  command(['-genkeypair', '-alias', 'thesi-local-only', '-keyalg', 'RSA', '-keysize', '2048',
    '-sigalg', 'SHA256withRSA', '-validity', '1', '-dname', 'CN=Thesi Disposable Local Test',
    '-storetype', 'PKCS12', '-keystore', keystore, '-storepass:env', 'THESI_TEMP_KEY_PASSWORD', '-noprompt']);
  const certificate = new X509Certificate(command(['-exportcert', '-rfc', '-alias', 'thesi-local-only',
    '-keystore', keystore, '-storepass:env', 'THESI_TEMP_KEY_PASSWORD']));
  assert.ok(certificate.verify(certificate.publicKey));
  const library = compile('thesi-web/src/lib/android-app-links.ts', {});
  const route = env => compile('thesi-web/src/app/.well-known/assetlinks.json/route.ts', {
    '@/lib/android-app-links': library,
  }, env);
  const response = route({
    CLOTHME_ANDROID_APP_LINKS_ENABLED: 'true',
    CLOTHME_ANDROID_SIGNING_SHA256: certificate.fingerprint256,
  }).GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: 'io.patheos.clothme', sha256_cert_fingerprints: [certificate.fingerprint256] },
  }]);
  assert.deepEqual(await route({}).GET().json(), []);
  console.log('PASS: disposable certificate signature and actual assetlinks handler, certificate fingerprint, package identity, JSON headers and disabled default.');
} finally {
  rmSync(directory, { recursive: true, force: true });
  assert.equal(existsSync(directory), false);
  console.log('Disposable Android keystore and certificate files deleted. No release configuration changed.');
}
