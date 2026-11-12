# Gubiter project status

Updated: 2026-11-11

## Latest continuation: persistent profiles

Applied hosted Supabase migration create_auth_profiles after confirming the
public schema was empty. Schema snapshot: docs/supabase-profiles.sql.
Profiles reference Auth UUIDs, enforce unique lowercase usernames and constrain
display name/bio lengths. RLS restricts reads, inserts and updates to the owner;
column grants prevent changing ownership or creation timestamps. No anonymous
access, delete permission or editable privileged roles are provided.

The profile editor now loads/saves username, display name and bio. It supports
first-time setup, duplicate username feedback and safe text rendering. Existing
themes and account flows remain. Profiles are currently private.

Validation: all 10 Node tests pass, JS syntax and whitespace checks pass.
Hosted transactional tests passed owner create/edit, cross-user isolation,
insert protection and unique usernames. Test records were rolled back.
Supabase security advisors returned no findings. Browser, real email flow and
Go verification remain outstanding; the previous incomplete Go extraction is
not a trusted toolchain. No deployment was performed.

Management access is now available and a migration has been applied; earlier
notes saying otherwise are historical. Next: browser/account verification and
database-backed feed/content with RLS and honest empty states.

## Current direction — Supabase

User confirmed Supabase is the agreed backend. This supersedes the standalone
PostgreSQL setup and custom authentication plan below, which are historical
notes. Do not require a local PostgreSQL installation to continue.

Connected browser Auth to the supplied hosted project using its public URL/key
in `web/static/js/supabase-config.js`. An approved read of `/auth/v1/settings`
succeeded: email signup is enabled and email confirmation is required.

Implemented signup with confirmation messaging, email/password login, session
refresh and Remember me, recovery email and password update, verified account
identity display, and logout using the locally vendored official Supabase JS SDK
2.119.0. Removed the old disabled-auth handler and sample account profile. Native
form fallback uses POST so credentials cannot become URL query parameters.
The CSP permits connections only to this project's HTTPS origin and self.
User metadata stores username/account preference only; it grants no roles.

Validation: seven mocked Auth-flow tests pass (`node --test tests/auth.test.cjs`),
JavaScript syntax and whitespace checks pass, Go source formatted. No connected
browser was available, and no real test account or email was created. A local Go
executable exists but its extraction is incomplete (standard-library files are
missing); the archive did not pass checksum verification. Go test/vet therefore
remain blocked. Go is still needed for the existing server, independently of
Supabase. A temporary Node preview server was used only for HTTP asset checks.

Next: configure dashboard redirect URLs as documented in README, verify a real
email signup/login/reset flow, adapt the schema to Auth UUIDs and profiles, and
add row-level security policies before exposing application tables. No database
migration was applied. The old SQL draft must not be applied unchanged.
No Supabase management connector or privileged access is available in this
session; never request a secret key in chat. Historical notes below describe the
earlier standalone plan and do not override this Supabase direction.

## Phase 1 — Audit complete

Original tracked application structure:

```text
main.go
 go.mod
web/
  index.html
  login.html
  register.html
  profile.html
  static/css/style.css
  static/js/app.js
```

Inspected all eight application files. Original server served the web directory
without API routes, timeouts or database connectivity. No dependencies beyond
Go standard library. No README, migrations, tests or environment configuration.

Existing useful work: responsive CSS, shared five-theme variables and persistent
localStorage selection, navigation and auth/profile page structure. Preserved.

Missing/broken: search is an alert, auth forms lack backend handling, profile is
hardcoded, cards and metrics are examples, multiple links are placeholders,
profile styling/frame was missing. No accounts, media, social records, permissions,
recovery, moderation, verification or subscriptions. Sample content is not real
activity and must be removed when database-backed rendering replaces it.

## Phase 2 — In progress

Implemented:
- HTTP package with explicit page routes and static asset directory guards.
- Server timeouts, graceful Ctrl+C shutdown and configurable loopback listener.
- Security headers and restrictive content security policy.
- Separate liveness and intentionally unavailable database readiness endpoints.
- Explicit unavailable API responses; no simulated API success.
- Initial transactional PostgreSQL migration for users/profiles/roles/sessions,
  account tokens, content/media/jobs, comments/replies, likes/follows/saves/history,
  views/notifications, verification/subscriptions/payments, reports/audit logs.
- Foreign keys, uniqueness/check constraints and initial query indexes.
- Auth submission guard to prevent default GET credential submission.
- Theme menu Escape handling and expanded state; keyboard focus/reduced motion.
- Reusable metallic four-point frame CSS with a square image area. Not yet wired
  to a database-backed profile. Verification badges remain separate future work.
- Route/security tests, environment example, ignore rules and setup documentation.

Validation: JavaScript syntax check passed. Git diff whitespace check passed
(with normal Windows line ending warnings). Go tests and SQL execution NOT run.
No runtime or visual QA has been completed. Schema is a starting design requiring
validation against PostgreSQL before API implementation.

Environment: Git exists at C:/Program Files/Git/cmd/git.exe but is absent from
PATH. Node is available. Go, psql, Python and FFmpeg are unavailable through PATH.
Official Go release download failed DNS resolution both normally and after an
escalated retry. No tools were installed and no external service was provisioned.

## Ordered roadmap

### Resume check — 2026-11-11

- Rechecked the working tree and preserved all existing changes.
- JavaScript syntax (`node --check web/static/js/app.js`) and Git whitespace
  checks passed; Git reported only Windows line-ending warnings.
- Go and PostgreSQL remain unavailable through PATH and their usual installation
  folders. No Docker or winget command was found.
- An approved request reached the official Go release service, but the archive
  download stalled and a retry lost its connection. Both attempts were stopped.
  An incomplete archive may remain in ignored `.tools/`; it is not a usable or
  verified toolchain. No toolchain was installed or executed.
- Next action remains installing/locating Go and PostgreSQL, then running the
  Go checks and validating the initial migration against a fresh test database.

1. Finish foundation: install/locate Go and PostgreSQL, run formatter/vet/tests,
   apply migration to a fresh test database, add pgx driver and migration runner,
   database readiness, repositories and shared layouts. pgx will supply PostgreSQL
   connectivity; a maintained password hashing package will supply Argon2id.
2. Core: real registration/login/logout, opaque hashed sessions, CSRF protection,
   rate limits, email/recovery delivery adapter, profile editing, public search,
   mixed feed and top reels. Remove placeholder users/content/counters.
3. Social: persistent likes/comments/replies/follows/notifications/history/saves,
   visibility enforcement and pagination. Add authorization/integration tests.
4. Creator: protected dashboards, validated streaming uploads to private object
   storage, queued FFmpeg/Python processing, renditions/thumbnails, analytics.
5. Verification: unavailable-provider interface, consent/retention, signed provider
   callbacks, backend-derived badges. Owner approval before provider activation.
6. Premium/SMILES: disabled checkout until payment-provider approval, validated
   payment events/expiry, rights-aware quality/downloads; navigation assistant
   interface with explicit permissions and no recording by default.
7. Administration: role checks, moderation queue, reports/copyright workflows,
   audited decisions, age/consent policies and identity-data deletion controls.
8. Deployment: integration/security/mobile QA, storage and DB backups, TLS,
   monitoring, production configuration. Obtain approval before deployment.

Phases 3–9 have not started. No authentication or upload feature is claimed to
work. Never deploy this development build publicly as a functioning platform.

## Run and test

See README.md for exact commands. Current source expects the repository root as
working directory. Immediate blocker is a usable Go toolchain and PostgreSQL;
compilation and database validation are required before progressing to Phase 3.
