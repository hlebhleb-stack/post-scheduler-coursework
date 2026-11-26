CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'))
);
CREATE TABLE IF NOT EXISTS channels (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  name text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('telegram','youtube')),
  destination text NOT NULL,
  credential text NOT NULL,
  UNIQUE(id, user_id),
  UNIQUE(user_id, platform, destination)
);
CREATE TABLE IF NOT EXISTS posts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  channel_id integer NOT NULL,
  body text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','published','failed','uncertain')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (channel_id, user_id) REFERENCES channels(id, user_id)
);
CREATE TABLE IF NOT EXISTS deliveries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  external_id text,
  error text
);
CREATE INDEX IF NOT EXISTS posts_due ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS posts_owner ON posts(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS deliveries_post ON deliveries(post_id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS telegram_html text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS silent boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS protect_content boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS attachments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video','audio','animation','document')),
  content bytea NOT NULL,
  size integer NOT NULL CHECK (size > 0),
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_post ON attachments(post_id);

-- Файлы медиатеки и копии вложений используют одну таблицу.
-- У файла медиатеки есть владелец, у копии публикации — post_id.
ALTER TABLE attachments ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id);
CREATE INDEX IF NOT EXISTS media_owner ON attachments(user_id) WHERE post_id IS NULL;

-- Миграция сохраняет существующие каналы и публикации.
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_platform_check;
ALTER TABLE channels ADD CONSTRAINT channels_platform_check CHECK (platform IN ('telegram','youtube'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS youtube_title text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS youtube_privacy text NOT NULL DEFAULT 'unlisted' CHECK (youtube_privacy IN ('private','unlisted','public'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS youtube_made_for_kids boolean NOT NULL DEFAULT false;

ALTER TABLE posts DROP COLUMN IF EXISTS image_url;
