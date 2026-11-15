# Audit findings ledger

Original baseline: 0e28268bc50417fb54ce744d0a673f42396bfceb. Current main was identical at start. IDs P0/P1 match the conversation audit. P2/P3 had no numeric IDs in that report; stable IDs below follow its table order. OPEN means the baseline defect remains or has not yet received a verified fix, not that it was fixed. Tests below refer to magic_app/tests/security/p0.test.js unless stated otherwise.

| ID | Priority | Status | Finding / changed files | Verification / next work |
|---|---|---|---|---|
| P0-01 | P0 | FIXED | register.js, auth.js, psychologist-access.js, psychologist-chat.js: remove signup admin and legacy privilege paths | signup user JWT; legacy admin denied; own psychologist allowed; foreign chat/stats denied; child and directory-squatting denied |
| P0-02 | P0 | FIXED | generate.js: verified parent family context only | unauthenticated mom/dad and child rejected; body foreign email ignored in captured mocked provider payload; guest retained |
| P1-01 | P1 | FIXED | profile-update.js: explicit parent DTO including child field allowlist | GET/POST child denied; parent POST excludes nested/top-level secret fields; stored hashes retained |
| P1-02 | P1 | PARTIAL | parent-pin.js, verify-pin.js, 7 cabinet handlers, parent-access.js, parent-dashboard.js, login/register jti, CORS header | 28 server + 7 client tests and route-mocked browser smoke; 5-minute grant bound to login token and current credentials. Remaining parent AI/chat/booking/report routes, local-only data and session revocation are not covered by this stage. |
| P1-03 | P1 | FIXED | delete-account.js, auth.js: child cannot delete family | both role=child and mode=child return 403; fixture retained; parent PIN covered separately by P1-02 |
| P1-04 | P1 | FIXED | api-base.js: remove URL override | actual module ignores attacker query; mock fetch target stays trusted origin |
| P1-05 | P1 | OPEN | external QR receives child bearer | local QR; one-use exchange/revocation |
| P1-06 | P1 | FIXED | psychologist-reviews.js: public DTO | unauthenticated GET excludes email and unexpected private fields |
| P1-07 | P1 | OPEN | client systemPrompt replacement | server operation templates + mandatory policy |
| P1-08 | P1 | OPEN | flagged dangerous response still spoken; crisis handling | server safety gates; mock scenarios; real-model review separate |
| P1-09 | P1 | OPEN | unsigned JWT AI limiter and spend | shared authenticated atomic budgets, concurrency, kill switch |
| P1-10 | P1 | OPEN | account deletion residual data | schema inventory and cascade/retention; no production deletion |
| P1-11 | P1 | OPEN | unscoped persistent local storybook | family/child namespace and cleanup |
| P1-12 | P1 | FIXED | parent-dashboard.js advice HTML sink | execute actual render block with HTML payload; innerHTML setter throws; textContent preserved |
| P1-13 | P1 | OPEN | privacy claims disagree with flows | technical map and owner-reviewed policy; no invented retention/regions |
| P2-01 | P2 | OPEN | JWT not revoked on logout/reset | server sessions/versioning, compatibility |
| P2-02 | P2 | OPEN | static-answer recovery | verified one-use email recovery; owner sender setup |
| P2-03 | P2 | OPEN | unlimited HTTP body buffering | stream byte cap and 413 tests |
| P2-04 | P2 | OPEN | AI/STT/TTS input caps | text/audio/schema bounds |
| P2-05 | P2 | OPEN | provider deadlines absent | timeout/cancel, bounded retries |
| P2-06 | P2 | OPEN | generation failure returns success | typed errors and fallback status |
| P2-07 | P2 | OPEN | sync stubs and disconnected server dialog history | implement persistence and dialog→stats→deletion test |
| P2-08 | P2 | OPEN | Android sync missing bearer | authenticated client; dedicated child scope after DTO guard |
| P2-09 | P2 | OPEN | local rename loses birthday and history | stable IDs, compatibility migration, server write |
| P2-10 | P2 | OPEN | Cyrillic JWT decoding | proper base64url + TextDecoder |
| P2-11 | P2 | OPEN | switchPlan local/staging fatal | fix dev helper and test browser |
| P2-12 | P2 | OPEN | stale PWA JS | release-specific cache/update test |
| P2-13 | P2 | OPEN | drawing image not sent to vision model | preserve game; truthful supported mechanics or approved vision |
| P2-14 | P2 | OPEN | story truncation | preserve full text and reader |
| P2-15 | P2 | OPEN | non-atomic Redis read/modify/write | atomic structures and concurrency test |
| P2-16 | P2 | OPEN | Worker credentialed CORS | trusted allowlist + integration tests |
| P2-17 | P2 | OPEN | Android WebView debugging enabled | release hardening + actual APK inspection |
| P2-18 | P2 | OPEN | unpinned Capacitor and fixed versionCode | lockfile, reproducible monotonic builds |
| P2-19 | P2 | OPEN | brittle microphone patch | deterministic native implementation + build/device test |
| P2-20 | P2 | OPEN | development dependency advisories | safe toolchain upgrades and regression; prod advisory audit previously 0 |
| P2-21 | P2 | PARTIAL | test coverage/lint/checkJs/CI gaps | 19 offline security regressions added; existing skipped API tests/lint/type limits remain |
| P2-22 | P2 | OPEN | ineffective uptime job | fail on HTTP/network, valid schedule, notifications |
| P3-01 | P3 | OPEN | outdated deployment docs | canonical runbook |
| P3-02 | P3 | OPEN | Cyrillic slang word-boundary filter | Unicode-aware matcher tests |
| ADD-01 | P3 | OPEN | unused users.ts typed facade | align actual runtime type coverage |
| ADD-02 | P3 | OPEN | disconnected file analytics append path | choose canonical store and tests |
| ADD-03 | P3 | OPEN | legacy/current Android application IDs differ | owner confirms published identity before updates |
| OBS-01 | P2 | OPEN | remaining raw name/AI HTML sinks | examine each source→sink chain; no broad XSS clearance claimed |
| OBS-02 | P2 | OPEN | body/email/tokens and Redis key validation, localStorage bearer | central session/tenant policy and targeted review |
| OBS-03 | P2 | OPEN | auth limiter forwarded headers/process memory | trusted proxy/shared limiter; VPS config unknown |
| OBS-04 | P2 | OPEN | AI role/age/PII policy inconsistent | mandatory server policy across modes; specialist review |

## Non-findings and external limits

SQL/Mongo string-query injection and exploitable CSRF were NOT established by the audit; do not relabel absence of proof as FIXED. Existing SameSite/HttpOnly/scrypt protections remain. Production security headers, provider moderation/retention, actual regions, VPS backups, Android artifact/store state remain UNVERIFIED. The original report's 12 explicitly untested areas remain unverified except the narrow local tests listed in AUDIT_PROGRESS.md. No ALREADY FIXED claim: main equalled the audit baseline at the start.
