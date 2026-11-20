# Security audit remediation checkpoint

## Scope and refs

Source: Russian technical audit in this conversation for `0e28268bc50417fb54ce744d0a673f42396bfceb` and the owner's uploaded remediation instructions. No separate report attachment was supplied; the complete conversation report is the source of the ledger below.

- Initial HEAD and fetched origin/main: `0e28268bc50417fb54ce744d0a673f42396bfceb` (unchanged since audit).
- Backup: `backup/pre-security-audit-2026`, verified locally at exactly the initial SHA.
- Working branch: `fix/security-audit-2026`.
- P0 checkpoint: `8bce25b24915b6f4d513b936730cac78106cf3bb`.
- Current implementation checkpoint: `e5a94a548f120913a964770d084e9d136785fc46`.
- The subsequent documentation-only checkpoint contains this file; obtain its exact SHA using `git rev-parse HEAD`.
- Remote backup publication FAILED: git push HTTP 403; GitHub create-branch API HTTP 403 Resource not accessible by integration. Remote lookup before creation returned 404. Do not claim remote backup or publication of the working branch.
- main was not modified. No force push, merge, PR, deploy, VPS change, production Redis access or paid provider call.
- Git branch backup is NOT a Redis/VPS/user data backup.

## Completed stages

A: P0-01/P0-02 fixed and tested (11 target tests before advancing to B).
B: PARTIAL, only the independently tested fixes listed below. Do not treat parent guard as PIN elevation or session revocation.
C/D/E: OPEN except the advice HTML sink fixed alongside data-exposure work.

All 19 security tests run real handlers/helpers with real JWT signatures, in-memory Redis and mocked fetch; no provider network. Remaining production dependencies, rate limiter and real model behavior are NOT covered by these mocks.

## Changes and compatibility

- Public signup always starts as role=user; verified partner-code role assignment remains. Legacy admin family JWTs no longer grant administrator privileges; use the existing dedicated admin login/token. Existing accounts and stored roles are not rewritten.
- Partner directory membership alone no longer authorizes a public account. An existing database role=psychologist is required; an explicitly inactive profile is denied. Directory-only historical partners require owner review/provisioning; do not auto-elevate them by email.
- Parent AI context requires a real authenticated parent account, ignores request-body family emails, and no longer uses global counts as family statistics. Guest Lucik chat remains available.
- Profile GET/POST rejects child tokens; parent responses use an allowlisted DTO. Password/PIN/recovery hashes remain stored unchanged but are not returned. Child conversation profile-sync requires a future dedicated child-scoped endpoint (OPEN).
- Child tokens cannot delete family accounts. Parent deletion still lacks recent PIN and cascade cleanup: DO NOT RELEASE.
- Public review DTO omits email and parent identity; submitted author data is retained internally.
- URL API override removed for every environment. Local development remains same-origin; Capacitor routing is unchanged.
- Advice is rendered as literal text with preserved newlines.

## Tests run on implementation checkpoint

- `npm test -- tests/security/p0.test.js`: 19 passed.
- `npm test`: 26 passed, 2 skipped (the existing opt-in real API tests).
- `npm run test:syntax`: 117 files passed.
- `npm run type-check`: passed; checkJs=false remains a coverage limitation.
- `git diff --check`: passed.
- First P0 test run failed because the NEW synthetic fixture used unsupported question key first_pet; corrected fixture to supported pet and rerun passed. No application validation weakened.
- Dependencies reused from separate audit-run installation; no package or lockfile change. Temporary node_modules symlink is not part of commits.
- Browser smoke rerun result is recorded in the final checkpoint validation addendum below; do not infer success from baseline audit results.

## Resume procedure and next concrete step

Read this file and AUDIT_FINDINGS.md. Check status/HEAD/recent commits and backup SHA. Recheck remote main before integration; never reset or overwrite local changes. Do not merge/deploy.

Next: finish stage B by designing a short-lived server-verifiable parent elevation bound to the current session, integrating the PIN success flow, and enforcing it consistently on sensitive APIs. Add tests for old parent/child tokens, wrong/expired PIN grants and cross-session reuse. Then implement session revocation on reset/delete/logout and child link exchange/revocation, followed by local QR and safe recovery. Do not silently disable existing accounts or require manual production data edits.

After B: C server-owned AI operation templates, mandatory input/output safety, shared verified-identity budgets, timeouts and concurrency; D storage/child-ID compatibility migration and remaining functional fixes; E truthful policies and owner decisions. Run staged target tests before broad regression.

## Open risks and owner decisions

- Work is PARTIALLY COMPLETE. No GO for families/public launch; only isolated synthetic staging review of these changes.
- No reliable daily quota remaining information is available. No claim of quota exhaustion or background automatic continuation.
- Remote write permission is needed to publish backup and work without touching main. Both available write methods returned 403; no permission bypass attempted.
- Before production: owner must review legacy privileged accounts, decide verified recovery sender/provider, confirm retention/regions/provider processing terms, and validate actual backups. Do not invent these facts in privacy policy.
- No production migration executed. Future child-ID/session data changes need backward-compatible planning and staging restore tests.
- Real provider safety, Android build/device, RuStore, VPS, backups, load/races and live end-to-end auth were not checked in this remediation checkpoint.

## Browser validation addendum

Rerun on the implementation changes with Chromium/Playwright: 12/12 games PASS_OPEN plus menu close; login/register and four parent guards PASS. Production-mode app boots without captured errors; localhost still reproduces the known switchPlan fatal (P2-11 OPEN). All browser requests fulfilled from local source or synthetic API errors, external origins aborted, service workers blocked. No game completion, authenticated live backend, real mic, Android device or PWA upgrade test. No claim of successful local-mode app boot.

Exporting to the prescribed /codex/.../output directory was attempted but this runtime mounts /codex read-only. Git commits, progress and ledger remain in the workspace; no remote publication is claimed.


## P1-02 stage 1 — resumed from GitHub draft PR #4

Fetched `fix/security-audit-2026` from origin; PR #4 is open/draft and its head matched `fd285f501f6409a89490187a0e2854d41996b8da`. The old publication-failure notes above describe the previous session. This stage changes neither main nor backup and performs no deploy. Its commit SHA is the HEAD containing this section (`git rev-parse HEAD`).

Implemented:
- Correct PIN now issues a separately keyed HS256 grant (audience geroy:parent-pin), maximum lifetime 300 seconds. Bound to SHA-256 of the exact verified login JWT and a fingerprint of the current password/PIN hashes. PIN grant cannot authenticate as a login JWT. A missing grant, wrong session/family, expired/modified proof, missing user or changed credentials fails closed. Protected responses and issuance use Cache-Control:no-store.
- Login/register add random JWT jti so simultaneous logins are distinct. Existing signed parent JWTs without jti remain usable, but must submit PIN to obtain their own short-lived proof. Old child tokens remain forbidden. No account migration or credential rewrite.
- Enforced on profile-update GET/POST, delete-account, child-token, weekly-stats, weekly-digest, parent-consent and psychologist-help. Other parent routes are explicitly NOT secured by this stage: generate mom/dad, parent side of psychologist-chat, booking/review/report and local-only history. P1-02 remains PARTIAL until the route matrix is completed.
- A profile without parentPinHash no longer receives elevated access via noPin; it gets an explicit support/configuration error. Do not silently manufacture a PIN. A verified recovery/enrolment path is future work.
- Dashboard sends X-Parent-Authorization from memory only. Same appearance and existing PIN overlay; wrong PIN remains locked, expiry/server rejection relocks, pagehide clears proof and BFCache return relocks. Five minutes is an absolute lifetime, not extended by activity. CORS allow-header lists in backend/Worker include this header; existing Worker credentialed-CORS issue remains OPEN.

Validation on this stage:
- `npm test -- tests/security/parent-pin.test.js tests/security/parent-access.test.js tests/security/p0.test.js`: initially 53 passed (28 server, 6 client, 19 previous regressions). An additional cross-origin proof-leak regression was then added and passed in the final full run (7 client cases).
- `npm test`: 61 passed, 2 skipped (existing opt-in API tests).
- `npm run test:syntax`: 119 JS files passed.
- `npm run type-check`: passed; checkJs=false limitation unchanged.
- Browser: `PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node tests/browser/parent-pin-smoke.cjs` from magic_app. Initial PIN, wrong PIN denial, correct PIN unlock, proof header, no persistent proof, expiry hiding cabinet: all passed, no page errors. All routes locally fulfilled/aborted, synthetic API responses; this is client integration smoke, not live Redis/provider E2E.
- `git diff --check`: passed. Dependencies reused from the prior isolated audit install, no package/lock changes.

Limits: stateless proof follows current login token validity. Logout does not yet revoke a copied login/proof server-side; both are required and the proof expires in at most five minutes. General session revocation is still P2-01 OPEN. Existing PIN-attempt counters are not yet atomic under concurrent requests (P2-15/OBS-03). Existing PWA cache may retain old dashboard JS, so isolated staging must use a clean context; no production rollout is claimed.

Next step after owner's review: finish P1-02 route matrix for remaining parent paths, then session revocation. Stop after this first tested stage as requested; do not start further audit fixes. Any failed push must be reported without repeated retries.

## P1-02 and P2-01 follow-up on 7099734

Started from `fix/security-audit-2026` at `7099734456baceb32312af04b2fe7f76f0d9a422`. The full independent QA report was unavailable in this workspace and the discussion of GitHub PR #4. The PR was verified open and draft. Confirmed baseline: 54 security tests PASS, 61 full-suite PASS, 2 SKIP, and P1-02 PARTIAL. See AUDIT_FINDINGS.md for the route matrix and confirmation assessment.

- Sensitive parent branches now require the existing session-bound grant. The dashboard sends it from tab memory. Legacy parent chat in the main app opens the parent dashboard when the server requires PIN.
- A five-minute Redis window admits three PIN comparisons per family, including successful comparisons. The fourth request gets 429 until expiry. Existing profile lock timestamps are honored until expiry.
- Logout revokes presented cookie and bearer JWTs until expiry. Other independent sessions, including independently issued child links, remain active. Password reset and deletion invalidate all previous family tokens, including legacy child links, by rotating the generation. Logout failure is surfaced to the client for retry.
- Redis storage adds a persistent generation key per affected family, a TTL-bound revocation key per logged-out JWT, and a five-minute PIN attempt key per active family. Missing generation supports legacy valid HS256 JWTs with expiry. Reset/delete write account state and generation in one Redis script. Profile writes based on an earlier generation fail. No backfill or bulk migration is necessary. Keep generation keys across account recreation, and confirm EVAL and MGET support and key retention on an isolated Redis instance. Older service builds do not enforce revocation, so mixed-version rollout or rollback needs explicit coordination.
- P1-02 remains PARTIAL for browser-local family data and the proposed dedicated deletion confirmation. P1-10 cascade cleanup, legacy recovery, one-use child links, and live client/Redis integration remain open. Requests already authorized and in flight can finish after revocation.
- Initial in-sandbox Vitest runs failed during esbuild config loading with Windows Access Denied. Validation results for subsequent runs are recorded below.

Validation on the local follow-up changes:

- `npm test -- tests/security`: 68 PASS, including 14 additional regressions. The tests use synthetic fixtures and an in-memory Redis double for session and PIN operations.
- `npm test`: 75 PASS, 2 SKIP. The opt-in server API cases were explicitly disabled.
- `npm run type-check`: PASS. `npm run test:syntax`: 119 files PASS. `git diff --check`: PASS.
- Vitest passed outside the sandbox after adjusting three existing fixtures for the account-existence and Redis-write checks. No browser or live Redis integration was run on this follow-up.
- Local changes are on the requested branch. HEAD remains `7099734`. No push, merge, deployment, or production API call. The bundle remains untracked.
