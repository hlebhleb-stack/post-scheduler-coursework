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
  platform text NOT NULL CHECK (platform IN ('telegram','instagram')),
  destination text NOT NULL,
  credential text NOT NULL,
  UNIQUE(id, user_id),
  UNIQUE(user_id, platform, destination)
);
CREATE TABLE IF NOT EXISTS templates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  name text NOT NULL,
  body text NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  channel_id integer NOT NULL,
  body text NOT NULL,
  image_url text,
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
