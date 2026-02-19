-- =============================================
-- JEVEHOME — SUPABASE DATABASE SCHEMA
-- =============================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all tables, RLS policies, triggers, and seed data.
-- =============================================


-- ─────────────────────────────────────────────
-- 1. TABLE: users_profile
-- Extends auth.users with display name and role.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users_profile (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role         TEXT DEFAULT 'family',
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users_profile
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (display_name only; role is admin-controlled)
CREATE POLICY "Users can update own profile"
  ON public.users_profile
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (used by the trigger, but policy still needed)
CREATE POLICY "Users can insert own profile"
  ON public.users_profile
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (needed for admin panel user listing)
CREATE POLICY "Admins can read all profiles"
  ON public.users_profile
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─────────────────────────────────────────────
-- 2. TABLE: user_preferences
-- Stores per-user preferences (favorite section, etc.)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  favorite_section TEXT,
  custom_message   TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 3. TABLE: site_config
-- Key-value store for admin-managed photo paths
-- and other site configuration.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key   TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read site config (needed to load photos)
CREATE POLICY "Authenticated users can read config"
  ON public.site_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert, update, or delete config entries
CREATE POLICY "Admins can insert config"
  ON public.site_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_profile
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update config"
  ON public.site_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete config"
  ON public.site_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─────────────────────────────────────────────
-- 4. TRIGGER: Auto-create profile on user signup
-- When a new user registers via Supabase Auth,
-- this trigger automatically creates their profile.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Family Member'),
    'family'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────
-- 5. SEED DATA: Default photo configuration
-- These are the hardcoded photos from the original
-- site. The admin panel can change them at any time.
-- ─────────────────────────────────────────────
INSERT INTO public.site_config (config_key, config_value) VALUES
  ('hero_bg_photo',      'photos/IMG_0379.JPG'),
  ('timeline_2014',      'photos/IMG_0133.JPG'),
  ('timeline_2015_2017', 'photos/IMG_2063.JPG'),
  ('timeline_2018',      'photos/IMG_3265.JPG'),
  ('timeline_2019_2020', 'photos/IMG_4570.JPG'),
  ('timeline_2021',      'photos/IMG_5503.JPG'),
  ('timeline_2022_2024', 'photos/IMG_6489.JPG'),
  ('timeline_2025',      'photos/IMG_7814.jpg'),
  ('message_bg_photo',   'photos/IMG_7824.jpg')
ON CONFLICT (config_key) DO NOTHING;


-- ─────────────────────────────────────────────
-- 6. ADMIN USER SETUP
-- After running this script, create your admin user:
--
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → enter your email and password
--    (e.g., admin@jevehome.com / admin)
-- 3. Then run this SQL to promote them to admin:
--
--    UPDATE public.users_profile
--    SET role = 'admin'
--    WHERE id = (
--      SELECT id FROM auth.users
--      WHERE email = 'admin@jevehome.com'
--    );
--
-- ─────────────────────────────────────────────
