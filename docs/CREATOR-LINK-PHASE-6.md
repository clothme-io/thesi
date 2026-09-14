# Phase 6 — creator links and mobile destinations

Implementation is local. No production deployment, production migration, real checkout payment or payout has been performed. A successful browser demonstration does not certify an installed native app or store-delivered deferred link.

## Implemented flow

1. Each accepted creator/product keeps its existing opaque public URL, `https://get-thesi.com/r/{code}`. Previewing it creates no attribution.
2. With the durable mobile rollout enabled, **Open ClothME** opens `clothme://creator-campaign/{code}`. The original public link remains available for copying. Existing short-lived handoff routing remains supported.
3. Expo Router's native-intent handler maps the public HTTPS URL to the creator campaign route. The parser rejects other hosts, credentials, ports, malformed codes and unexpected query/fragment payloads. Direct native handling does not require an attribution SDK callback; provider-delivered creator links are also supported. The optional Airbridge adapter now uses SDK 4.9's named `Airbridge.setOnDeeplinkReceived` API, instead of nonexistent default-export initialization methods. Teardown invalidates late callbacks.
4. The app stores the public link for up to 30 days while the shopper signs in or selects a profile. This is local link retention, **not a change to campaign attribution windows**. Storage hydration cannot overwrite a more recently captured link or resurrect a cancellation.
5. After login, the shopper explicitly selects **Continue to product**. Customer API's new authenticated `POST /v1/customer/creator-attribution/prepare` resolves the JWT account's owned person, validates the public code, and calls Thesi's fixed public click endpoint. It returns only a validated 15-minute grant. It creates no buyer touchpoint itself.
6. The app replaces the pending share with that grant before claiming it. A retry reuses the same grant; it does not automatically create a new click or renew the attribution window. Existing server-side buyer binding and expiry remain authoritative.
7. The existing claim endpoint resolves the verified product. Account/profile changes, cancellation and a newer pending link stop the old operation from navigating or clearing the new state.
8. After installing the app, shoppers can reopen the original link or use **Account → Open a creator product link** to paste it. This explicit continuation is implemented. The optional provider path now generates a durable install link and can receive its deferred URL. **Real automatic cross-install delivery is not verified**: the actual provider app/channel, native SDK credentials and store configuration must be supplied and exercised.

## Web and native release configuration

All new web configuration is server-side and disabled/unset by default:

| Setting | Purpose |
| --- | --- |
| `CLOTHME_DURABLE_CREATOR_LINKS_ENABLED=true` | Switch public web buttons to the new durable native route, after a compatible mobile build is available |
| `CLOTHME_ANDROID_APP_LINKS_ENABLED=true` | Publish Android association at `/.well-known/assetlinks.json` |
| `CLOTHME_ANDROID_SIGNING_SHA256` | Comma-separated SHA-256 fingerprints of certificates signing the distributed app; malformed/missing values publish no association |
| `CLOTHME_IOS_APP_LINKS_ENABLED=true` | Publish iOS association for `A765V39MA5.io.patheos.clothme`, restricted to `/r/*` |
| `CLOTHME_IOS_STORE_URL` | Verified Apple App Store listing; missing/invalid URLs hide the button |
| `CLOTHME_ANDROID_STORE_URL` | Google Play listing for `io.patheos.clothme`; missing/invalid URLs hide the button |
| `CLOTHME_DEFERRED_LINKS_ENABLED=true` | Opt in to provider install routing, only alongside the durable mobile route |
| `CLOTHME_AIRBRIDGE_APP_NAME`, `CLOTHME_AIRBRIDGE_CHANNEL` | Actual provider app and channel used to construct a documented `abr.ge` tracking URL |

Mobile still requires `EXPO_PUBLIC_THESI_ATTRIBUTION_ENABLED=true`; Customer API still requires its existing attribution/service-key/database prerequisites. Both Expo app configuration and the local native manifests declare `get-thesi.com` creator links. Generated iOS files are ignored in the repository, so the tracked Expo configuration is the regeneration source.

Optional Airbridge delivery requires `EXPO_PUBLIC_AIRBRIDGE_ENABLED=true`, `EXPO_PUBLIC_AIRBRIDGE_APP_NAME` and `EXPO_PUBLIC_AIRBRIDGE_APP_TOKEN`. The new dynamic Expo configuration adds the native `airbridge-expo-sdk` config plugin only on explicit activation and rejects missing/placeholder credentials. Existing plugins are preserved. No real provider values are configured by this change.

When enabled, the web install link carries `clothme://creator-campaign/{publicCode}` and provider-managed store fallbacks; desktop fallback is the original Thesi URL. It uses the documented long-link format and creates no Thesi handoff merely by rendering the page. The browser never receives the SDK token or internal shopper identity. Airbridge store settings must point to the real ClothME listings before activation. See [Airbridge tracking-link parameters](https://help.airbridge.io/en/guides/tracking-link-structure-and-parameters) and [SDK listener documentation](https://help.airbridge.io/en/developers/react-native-sdk-v4).

The disposable certificate from the earlier check was deleted. It is not release configuration. Host the association documents over HTTPS without redirects and test the installed build's actual signing identity before enabling live verified links. Store URLs are not guessed.

## Local browser purchase demonstration

The demo page is `/local-creator-demo`; its proxy and page are disabled in production regardless of the flag. The fixture API binds loopback only, requires a local-demo header, and uses randomly named disposable databases on the existing Docker PostgreSQL at `127.0.0.1:5844`. The browser proxy accepts only named operations and same-origin local POSTs. It cannot proxy an arbitrary destination.

The browser exercises product preview, durable app-link presentation, fixture sign-in across reload, actual preparation/claim services and actual transactional order creation. It shows an unpaid pending order with the persisted creator/product/brand identity. Repeated demo checkout returns the same order. **No captured sale or commission is fabricated.** Catalog data and sign-in are fixtures; the tracking-to-commerce service bridge is in-process. Separate HTTP tests exercise the actual Customer controller, JWT guard, owned-person resolver, DTO validation and response envelopes.

Start the three commands from the Thesi root with Node available:

```sh
node scripts/test-creator-attribution.mjs /path/to/@electric-sql/pglite/dist/index.js --rules --docker --browser-demo
node scripts/creator-demo-web.mjs
node scripts/creator-demo-browser.mjs --keep-open
```

Open `http://127.0.0.1:3016/local-creator-demo`. Stop the fixture API with Ctrl-C to close connections and drop its disposable databases. The Docker option uses a fixed local fixture connection and never reads a production database URL. PGlite remains a required installed module for this shared test runner, even in Docker mode.

## Verification

- Customer API build and 83 suites / 218 tests passed.
- Web TypeScript passed; the final full web run passed all 134 tests across 36 suites, including demo isolation and provider URLs. They confirm the demo cannot activate in production and rejects foreign-origin mutations.
- Mobile helper tests execute the actual source: trusted URL mapping, expiry, nonrenewing replay, replacement/cancellation races, account changes, retries and asynchronous storage hydration.
- Optional provider tests verify the installed SDK listener contract, deferred public-URL normalization, host rejection, teardown and reinitialization. No live provider attribution is claimed.
- Docker regression executes actual Thesi tracking, Customer attribution and order repositories with migrated disposable schemas. Product/variant/person isolation, revocation, replay, transactional pending-order attribution and absence of payments pass.
- Actual Customer HTTP/JWT tests reject missing/invalid tokens, foreign profiles and extra DTO identity fields; preparation, claiming, replay and foreign-shopper denial pass.
- Visible Chrome walkthrough passed at desktop and mobile widths. Screenshots are in `/private/tmp/thesi-phase6/browser/`.
- Final Docker/HTTP regression passed with real PostgreSQL connection pools and successful disposable-database cleanup.
- Android debug APK built and installed on the isolated API 31 emulator. The actual app displayed the creator consent screen from a warm custom-scheme link and opened its existing login screen. After force-stop and reopening the development bundle, opening `/creator-link` without another code restored the pending share. Cancelling and reopening showed no active handoff. UI evidence is in `/private/tmp/thesi-phase6/{current,login,recovered,cancelled}.xml`.

## Native and release acceptance still requiring evidence

- Android release cold-start and full authenticated login-to-product navigation remain unverified. The development client requires selecting its local bundle after force-stop; this is not evidence of a store build's cold start. The local demo API now emulates setup/auth and `/v1/customer/me` for handoff walkthroughs, but it is not a full customer/account/catalog backend. No real customer account was used.
- Installed iOS: same matrix on a compatible build environment. This Mac has Xcode 15.2; the declared Expo SDK 56 requires Xcode 26.4+.
- HTTPS domain verification using the actual distributed Android/iOS builds and release configuration.
- Actual store destinations and end-to-end provider deferred-install recovery. The opt-in URL/configuration/listener path is implemented; explicit reopen/paste continuation is available without it.
- A production web checkout is outside this demo implementation and remains unavailable.

The mobile dependencies were restored from the existing lockfile (previously installed Expo 55 versus declared Expo 56), without changing the dependency manifest or lockfile. App-wide TypeScript checking still reports errors outside the creator-link implementation; native build results must be recorded separately. Do not mark the entire original Phase 6 complete solely from these local service/browser checks.

Native build preparation additionally exposed an existing API-24/API-26 minimum mismatch in the pose-exercise dependency, a SecureStore/Airbridge manifest conflict, and a missing generated locale resource. Testing uses a command-line API-26 minimum and a temporary debug manifest override that retains the app's SecureStore rules. The locale resource reflects the already declared English/Japanese configuration. These test accommodations do not establish that the normal release build is ready.

Android bootstrap was also updated from the removed `ReactNativeHostWrapper` to Expo 56’s `ExpoReactHostFactory`. Creator screens dismiss the native splash on layout because direct links bypass the home screen’s normal splash dismissal.

The final Android build succeeded (1,249 tasks). The temporary debug manifest override was restored after building; the generated APK is a test artifact, not a release candidate. The disposable signing certificate was deleted and was never published in domain association configuration.
