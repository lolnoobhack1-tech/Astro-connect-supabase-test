-- ============================================================================
-- COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- Astro Match - Astrology Powered Matrimony Web App
-- ============================================================================
-- This script sets up the complete database schema, RLS policies, functions,
-- triggers, and storage configuration for a new test database.
-- Run this script in your Supabase SQL Editor or via Supabase CLI
-- ============================================================================

-- ============================================================================
-- 1. CREATE EXTENSIONS
-- ============================================================================
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  profile_photo_url text,
  photos text[] default '{}',
  interests text[] default '{}',
  profession text,
  phone_number text,
  city text,
  salary_range text check (salary_range in ('below-5lakh', '5-10lakh', '10-20lakh', '20-50lakh', '50lakh-plus', 'prefer-not-to-say')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Birth details table
create table if not exists public.birth_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  date_of_birth date not null,
  time_of_birth time not null,
  place_of_birth text not null,
  created_at timestamp with time zone default now()
);

-- Kundli data table
create table if not exists public.kundli_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  kundli_json jsonb not null,
  generated_at timestamp with time zone default now()
);

-- Match interactions table
create table if not exists public.match_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_user_id uuid references public.profiles(id) on delete cascade not null,
  action text not null check (action in ('pass', 'interest')),
  created_at timestamp with time zone default now(),
  unique(user_id, target_user_id)
);

-- Compatibility scores table
create table if not exists public.compatibility_scores (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  score integer not null check (score >= 0 and score <= 100),
  details jsonb,
  calculated_at timestamp with time zone default now(),
  unique(user1_id, user2_id)
);

-- Matches table for mutual matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  matched_at timestamp with time zone default now(),
  unique(user1_id, user2_id)
);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.birth_details enable row level security;
alter table public.kundli_data enable row level security;
alter table public.match_interactions enable row level security;
alter table public.compatibility_scores enable row level security;
alter table public.matches enable row level security;

-- ============================================================================
-- 4. RLS POLICIES FOR PROFILES
-- ============================================================================
drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================================
-- 5. RLS POLICIES FOR BIRTH_DETAILS
-- ============================================================================
drop policy if exists "Users can view own birth details" on public.birth_details;
create policy "Users can view own birth details"
  on public.birth_details for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own birth details" on public.birth_details;
create policy "Users can insert own birth details"
  on public.birth_details for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own birth details" on public.birth_details;
create policy "Users can update own birth details"
  on public.birth_details for update
  using (auth.uid() = user_id);

-- ============================================================================
-- 6. RLS POLICIES FOR KUNDLI_DATA
-- ============================================================================
drop policy if exists "Users can view all kundli data" on public.kundli_data;
create policy "Users can view all kundli data"
  on public.kundli_data for select
  using (true);

drop policy if exists "Users can insert own kundli" on public.kundli_data;
create policy "Users can insert own kundli"
  on public.kundli_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own kundli" on public.kundli_data;
create policy "Users can update own kundli"
  on public.kundli_data for update
  using (auth.uid() = user_id);

-- ============================================================================
-- 7. RLS POLICIES FOR MATCH_INTERACTIONS
-- ============================================================================
drop policy if exists "Users can view own interactions" on public.match_interactions;
create policy "Users can view own interactions"
  on public.match_interactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own interactions" on public.match_interactions;
create policy "Users can insert own interactions"
  on public.match_interactions for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- 8. RLS POLICIES FOR COMPATIBILITY_SCORES
-- ============================================================================
drop policy if exists "Users can view compatibility with others" on public.compatibility_scores;
create policy "Users can view compatibility with others"
  on public.compatibility_scores for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "System can insert compatibility scores" on public.compatibility_scores;
create policy "System can insert compatibility scores"
  on public.compatibility_scores for insert
  with check (true);

drop policy if exists "System can update compatibility scores" on public.compatibility_scores;
create policy "System can update compatibility scores"
  on public.compatibility_scores for update
  using (true);

-- ============================================================================
-- 9. RLS POLICIES FOR MATCHES
-- ============================================================================
drop policy if exists "Users can view their own matches" on public.matches;
create policy "Users can view their own matches"
  on public.matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- ============================================================================
-- 10. FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
drop function if exists public.handle_updated_at() cascade;
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Function to handle new user signup (auto-create profile)
drop function if exists public.handle_new_user() cascade;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'gender', 'other')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Function to detect and create mutual matches
drop function if exists public.handle_mutual_match() cascade;
create or replace function public.handle_mutual_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reverse_match_exists boolean;
  user1_gender text;
  user2_gender text;
begin
  -- Only process 'interest' actions
  if new.action != 'interest' then
    return new;
  end if;

  -- Check if reverse match exists (target_user_id showed interest in user_id)
  select exists(
    select 1
    from public.match_interactions
    where user_id = new.target_user_id
      and target_user_id = new.user_id
      and action = 'interest'
  ) into reverse_match_exists;

  -- If mutual match exists, create a match record
  if reverse_match_exists then
    -- Get genders to ensure male-female match
    select gender into user1_gender from public.profiles where id = new.user_id;
    select gender into user2_gender from public.profiles where id = new.target_user_id;
    
    -- Only create match if genders are different (male-female)
    if (user1_gender = 'male' and user2_gender = 'female') or 
       (user1_gender = 'female' and user2_gender = 'male') then
      insert into public.matches (user1_id, user2_id)
      values (
        least(new.user_id, new.target_user_id),
        greatest(new.user_id, new.target_user_id)
      )
      on conflict (user1_id, user2_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 11. TRIGGERS
-- ============================================================================

-- Trigger to auto-update updated_at on profiles
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Trigger to auto-create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger to detect mutual matches
drop trigger if exists on_mutual_match on public.match_interactions;
create trigger on_mutual_match
  after insert on public.match_interactions
  for each row
  execute function public.handle_mutual_match();

-- ============================================================================
-- 12. STORAGE SETUP (Profile Photos Bucket)
-- ============================================================================
-- Note: Storage buckets must be created via Supabase Dashboard or CLI
-- The following SQL can be run in Supabase SQL Editor to set up storage policies

-- Create storage bucket (run this in Supabase Dashboard > Storage > New Bucket)
-- Bucket name: profile-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage RLS Policies (run after creating the bucket)
-- These policies allow authenticated users to upload/read/delete their own photos

-- Policy: Users can upload their own photos
drop policy if exists "Users can upload their own photos" on storage.objects;
create policy "Users can upload their own photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read all photos (public bucket)
drop policy if exists "Users can read photos" on storage.objects;
create policy "Users can read photos"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-photos');

-- Policy: Public read access for photos
drop policy if exists "Public can read photos" on storage.objects;
create policy "Public can read photos"
on storage.objects for select
to public
using (bucket_id = 'profile-photos');

-- Policy: Users can delete their own photos
drop policy if exists "Users can delete their own photos" on storage.objects;
create policy "Users can delete their own photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own photos
drop policy if exists "Users can update their own photos" on storage.objects;
create policy "Users can update their own photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos' 
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- 13. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for match_interactions
create index if not exists idx_match_interactions_user_id on public.match_interactions(user_id);
create index if not exists idx_match_interactions_target_user_id on public.match_interactions(target_user_id);
create index if not exists idx_match_interactions_action on public.match_interactions(action);

-- Indexes for compatibility_scores
create index if not exists idx_compatibility_scores_user1_id on public.compatibility_scores(user1_id);
create index if not exists idx_compatibility_scores_user2_id on public.compatibility_scores(user2_id);

-- Indexes for matches
create index if not exists idx_matches_user1_id on public.matches(user1_id);
create index if not exists idx_matches_user2_id on public.matches(user2_id);
create index if not exists idx_matches_matched_at on public.matches(matched_at desc);

-- Indexes for profiles
create index if not exists idx_profiles_gender on public.profiles(gender);
create index if not exists idx_profiles_city on public.profiles(city);
create index if not exists idx_profiles_created_at on public.profiles(created_at desc);

-- ============================================================================
-- 14. COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on table public.profiles is 'User profiles with personal information and photos';
comment on table public.birth_details is 'Birth details required for kundli generation';
comment on table public.kundli_data is 'Generated kundli (astrological chart) data for users';
comment on table public.match_interactions is 'User swipe actions (pass/interest) on other profiles';
comment on table public.compatibility_scores is 'Astrological compatibility scores between user pairs';
comment on table public.matches is 'Mutual matches when both users show interest (male-female only)';

comment on column public.profiles.photos is 'Array of photo URLs (up to 6 photos)';
comment on column public.profiles.interests is 'Array of user interests';
comment on column public.profiles.phone_number is 'Phone number visible only to matched users';
comment on column public.profiles.salary_range is 'Income range: below-5lakh, 5-10lakh, 10-20lakh, 20-50lakh, 50lakh-plus, prefer-not-to-say';

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Create storage bucket 'profile-photos' in Supabase Dashboard
-- 2. Set bucket to public
-- 3. Storage policies are already configured above
-- 4. Test the application with sample users
-- ============================================================================

