-- Initial schema: apply once using psql -v ON_ERROR_STOP=1 -1.
-- This file is intentionally non-destructive. Never rerun on an existing schema.
CREATE TABLE schema_migrations (version bigint PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email text NOT NULL UNIQUE CHECK (email = lower(email)),
 username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,30}$'),
 password_hash text NOT NULL,
 email_verified_at timestamptz,
 suspended_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles (
 user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 display_name varchar(80) NOT NULL, biography varchar(1000) NOT NULL DEFAULT '', avatar_key text
);
CREATE TABLE roles (name text PRIMARY KEY);
INSERT INTO roles VALUES ('user'), ('creator'), ('moderator'), ('admin');
CREATE TABLE user_roles (user_id bigint REFERENCES users(id) ON DELETE CASCADE, role text REFERENCES roles(name), PRIMARY KEY(user_id,role));
CREATE TABLE sessions (token_hash bytea PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE account_tokens (token_hash bytea PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL CHECK(purpose IN ('email','recovery')), expires_at timestamptz NOT NULL, used_at timestamptz);
CREATE TABLE content (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 creator_id bigint NOT NULL REFERENCES users(id),
 kind text NOT NULL CHECK(kind IN ('video','photo','post','reel')),
 title varchar(200) NOT NULL, body varchar(10000) NOT NULL DEFAULT '',
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','unlisted','private')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','processing','ready','failed','removed')),
 category varchar(80), downloads_allowed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_feed_idx ON content(created_at DESC,id DESC) WHERE visibility='public' AND status='ready';
CREATE INDEX content_creator_idx ON content(creator_id,created_at DESC);
CREATE TABLE media_assets (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE, object_key text UNIQUE NOT NULL, purpose text NOT NULL CHECK(purpose IN ('original','thumbnail','rendition','photo')), mime_type text NOT NULL, byte_size bigint NOT NULL CHECK(byte_size>0), width integer CHECK(width>0), height integer CHECK(height>0), duration_seconds numeric CHECK(duration_seconds>=0));
CREATE TABLE processing_jobs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE, kind text NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')), attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX jobs_queue_idx ON processing_jobs(available_at) WHERE status='queued';
CREATE TABLE comments (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE, author_id bigint NOT NULL REFERENCES users(id), parent_id bigint, body varchar(3000) NOT NULL CHECK(length(trim(body))>0), removed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,content_id), FOREIGN KEY(parent_id,content_id) REFERENCES comments(id,content_id));
CREATE INDEX comments_content_idx ON comments(content_id,created_at);
CREATE TABLE likes (user_id bigint REFERENCES users(id) ON DELETE CASCADE, content_id bigint REFERENCES content(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,content_id));
CREATE INDEX likes_content_idx ON likes(content_id);
CREATE TABLE follows (follower_id bigint REFERENCES users(id) ON DELETE CASCADE, followed_id bigint REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(follower_id,followed_id), CHECK(follower_id<>followed_id));
CREATE INDEX follows_followed_idx ON follows(followed_id);
CREATE TABLE saved_content (user_id bigint REFERENCES users(id) ON DELETE CASCADE, content_id bigint REFERENCES content(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,content_id));
CREATE TABLE viewing_history (user_id bigint REFERENCES users(id) ON DELETE CASCADE, content_id bigint REFERENCES content(id) ON DELETE CASCADE, watched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,content_id));
CREATE TABLE view_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE, viewer_id bigint REFERENCES users(id) ON DELETE SET NULL, dedup_hash bytea NOT NULL, viewed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(content_id,dedup_hash));
CREATE TABLE notifications (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, recipient_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id bigint REFERENCES users(id) ON DELETE SET NULL, kind text NOT NULL, content_id bigint REFERENCES content(id) ON DELETE CASCADE, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_recipient_idx ON notifications(recipient_id,created_at DESC);
-- Store provider references and decisions only: no document images or biometrics.
CREATE TABLE verification_checks (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id), provider text NOT NULL, provider_reference text UNIQUE NOT NULL, kind text NOT NULL CHECK(kind IN ('face','document_match')), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired','revoked')), consented_at timestamptz NOT NULL, valid_until timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE subscriptions (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id), provider text NOT NULL, provider_reference text UNIQUE NOT NULL, status text NOT NULL CHECK(status IN ('pending','active','cancelled','expired')), paid_until timestamptz);
CREATE TABLE payments (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, subscription_id bigint REFERENCES subscriptions(id), provider_event_id text NOT NULL UNIQUE, amount_minor bigint NOT NULL CHECK(amount_minor>=0), currency char(3) NOT NULL, status text NOT NULL CHECK(status IN ('pending','succeeded','failed','refunded')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE reports (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, reporter_id bigint REFERENCES users(id), content_id bigint REFERENCES content(id), comment_id bigint REFERENCES comments(id), reported_user_id bigint REFERENCES users(id), reason varchar(2000) NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')), created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(content_id,comment_id,reported_user_id)=1));
CREATE TABLE audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id bigint REFERENCES users(id), action text NOT NULL, target_type text NOT NULL, target_id bigint, created_at timestamptz NOT NULL DEFAULT now());
-- Badges and analytics must be derived from approved checks, paid entitlements,
-- and actual interaction records; no manually selectable badge or counter fields.
INSERT INTO schema_migrations(version) VALUES (1);
