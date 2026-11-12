# Gubiter

Gubiter is a social and video platform under development using HTML, CSS,
JavaScript, Go and Supabase. This checkout currently serves the original
frontend with a hardened HTTP foundation and Supabase Auth account flows.
It is not a production-ready platform.

## Run locally

Install Go 1.22.2 or newer and run from the repository root:

```powershell
go run .
```

Open http://127.0.0.1:8080. Optionally set `$env:HTTP_ADDR` before starting.
Go reads process environment variables; `.env.example` is documentation and is
not automatically loaded. No secrets belong in source control.

## Database preparation

The selected backend is hosted Supabase. A local PostgreSQL installation is
not required. Browser Auth is configured in
`web/static/js/supabase-config.js` using the supplied project URL and publishable
key. These are public browser settings. `.env.example` remains a reference;
the current Go server does not read these Supabase environment variables.

Before testing email confirmation or password reset, add
`http://127.0.0.1:8080/login.html` to the project's Authentication > URL
Configuration > Redirect URLs in the Supabase dashboard. Set the Site URL to
`http://127.0.0.1:8080` for local development. If using `localhost` instead, also
allow `http://localhost:8080/login.html`. Production needs its own exact URLs.

Registration, email/password login, email confirmation handling, password reset,
Remember me, verified account display and logout are implemented using the
locally served official Supabase SDK 2.119.0. Email confirmation is enabled on
the supplied project. Signup does not claim success as a signed-in session when
confirmation is still needed. Username and account type are preferences stored
as Auth metadata; username uniqueness and privileged creator roles are not yet
implemented. Never use editable metadata as an authorization decision.

The initial `migrations/000001_initial.sql` is an earlier standalone PostgreSQL
draft. Do not apply it to Supabase as the current setup procedure. It must first
be adapted for Supabase Auth user IDs, profile relationships, and row-level
security policies. No Supabase migration has been applied by this project.

Use Supabase Auth for account management. Secret/service-role keys must stay
server-side. Never include them in frontend assets or commit them to Git.

## Verify

```powershell
go fmt ./...
go vet ./...
go test ./...
node --check web/static/js/app.js
node --check web/static/js/auth.js
node --test tests/auth.test.cjs
```

`GET /healthz` returns 200 when HTTP is running. `GET /readyz` deliberately returns
503 until database integration exists. Unimplemented `/api/` routes return 503.
The Go tests cover route boundaries, directory listing prevention and headers.
They remain blocked: the partial local Go extraction lacks standard-library
source files, and its archive did not pass checksum verification on resume.
Do not rely on that extraction as an installed toolchain.
Seven Node tests pass for account form handling using mocked Supabase responses.
The project's public Auth settings endpoint accepted the supplied URL/key.
No real signup, inbox confirmation, or browser end-to-end test was performed;
no browser is connected in this session.

## Development boundaries

Existing homepage sample content is still a design placeholder, not real platform
activity. The account page now shows the user verified through Supabase Auth;
it no longer shows the sample profile, statistics or upload controls.
The five themes remain in the shared CSS and JavaScript.
No verification, payment, upload, AI or Premium provider is connected. No badge
or paid entitlement may be granted without a validated backend event.

See PROJECT_STATUS.md for the audit, implementation order and current blockers.

## Persistent profiles (latest update)

The profile page now loads and saves a unique username, display name and bio in
Supabase. The hosted create_auth_profiles migration is applied; its schema
snapshot is in docs/supabase-profiles.sql. This supersedes earlier statements
that no Supabase migration exists. The standalone SQL draft remains unused.

Profiles reference Supabase Auth UUIDs and are private to their owner through
RLS. Username availability is enforced when saving a profile, rather than at
email signup. Editable profile fields cannot grant roles or paid entitlements.

All 10 Node tests pass, including profile editing and failure states. Hosted
transactional checks passed ownership isolation and unique username enforcement;
test data was rolled back. Security advisors returned no findings. Browser,
real email and Go verification remain outstanding.
