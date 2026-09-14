// Server-only release configuration. Never infer a release certificate from a debug key.
export function androidAssetLinks(env: Record<string, string | undefined>) {
  if (env.CLOTHME_ANDROID_APP_LINKS_ENABLED !== 'true') return [];
  const fingerprints = [...new Set((env.CLOTHME_ANDROID_SIGNING_SHA256 ?? '')
    .split(',').map(value => value.trim().toUpperCase()).filter(Boolean))];
  if (!fingerprints.length || fingerprints.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value))) {
    // A partial or malformed configuration must not publish any association.
    return [];
  }
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'io.patheos.clothme',
      sha256_cert_fingerprints: fingerprints,
    },
  }];
}
