# Complete Database Setup Guide

This guide will help you set up a fresh Supabase database for the Astro Match application.

## Quick Start

1. **Create a new Supabase project** (or use existing)
2. **Run the complete setup script**:
   - Go to Supabase Dashboard > SQL Editor
   - Copy and paste the contents of `complete_database_setup.sql`
   - Click "Run" to execute

3. **Set up Storage Bucket**:
   - Go to Storage in Supabase Dashboard
   - Click "New Bucket"
   - Name: `profile-photos`
   - Public: ✅ Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
   - Click "Create bucket"

4. **Verify Storage Policies**:
   - The storage policies are already included in the SQL script
   - They will be created automatically when you run the script
   - Verify in Storage > profile-photos > Policies

## What's Included

### Tables
- ✅ `profiles` - User profiles with photos, interests, profession, phone, city, salary
- ✅ `birth_details` - Birth information for kundli generation
- ✅ `kundli_data` - Generated astrological charts
- ✅ `match_interactions` - Swipe actions (pass/interest)
- ✅ `compatibility_scores` - Astrological compatibility scores
- ✅ `matches` - Mutual matches between users

### Security (RLS Policies)
- ✅ Row Level Security enabled on all tables
- ✅ Users can only view/edit their own data
- ✅ Public read access for profiles and kundli data
- ✅ Storage policies for photo uploads

### Functions & Triggers
- ✅ Auto-create profile on user signup
- ✅ Auto-update `updated_at` timestamp
- ✅ Auto-detect mutual matches
- ✅ Only creates matches between male-female pairs

### Indexes
- ✅ Performance indexes on frequently queried columns
- ✅ Indexes on foreign keys and search fields

## Testing the Setup

### 1. Create Test Users

```sql
-- Test user 1 (Male)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'male@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"name": "John Doe", "gender": "male"}'::jsonb
);

-- Test user 2 (Female)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'female@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"name": "Jane Smith", "gender": "female"}'::jsonb
);
```

### 2. Verify Tables

```sql
-- Check profiles were created
SELECT * FROM public.profiles;

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 3. Verify Functions

```sql
-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

### 4. Verify Triggers

```sql
-- Check triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## Storage Setup Verification

After creating the bucket, verify the policies:

```sql
-- Check storage policies
SELECT * FROM storage.policies 
WHERE bucket_id = 'profile-photos';
```

## Common Issues & Solutions

### Issue: Storage bucket not found
**Solution**: Create the bucket manually in Supabase Dashboard > Storage

### Issue: RLS policies blocking access
**Solution**: Verify you're authenticated and policies are correctly set

### Issue: Trigger not firing
**Solution**: Check that triggers are enabled and functions exist

### Issue: Mutual match not creating
**Solution**: 
- Verify both users have different genders (male/female)
- Check that both users showed "interest" (not "pass")
- Verify the trigger function exists and is enabled

## Schema Diagram

```
auth.users
    ↓
profiles (id, name, gender, photos[], interests[], profession, phone_number, city, salary_range)
    ↓
birth_details (user_id, date_of_birth, time_of_birth, place_of_birth)
    ↓
kundli_data (user_id, kundli_json)

match_interactions (user_id, target_user_id, action)
    ↓
matches (user1_id, user2_id) [mutual matches only]

compatibility_scores (user1_id, user2_id, score, details)
```

## Next Steps

1. ✅ Database setup complete
2. ✅ Storage bucket created
3. ✅ Test with sample users
4. ✅ Deploy your application
5. ✅ Monitor performance with indexes

## Support

If you encounter any issues:
1. Check Supabase logs in Dashboard
2. Verify all migrations ran successfully
3. Check RLS policies are correct
4. Ensure storage bucket exists and is public

