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
