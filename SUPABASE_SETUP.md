# Supabase Setup Required

## 1. Fix `companytag` column on `hotels` table

Run this in **Supabase → SQL Editor**:

```sql
-- Add companytag column if it does not exist
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS companytag text;
```

If your column was previously created as `company_tag` (with underscore), rename it:
```sql
ALTER TABLE hotels RENAME COLUMN company_tag TO companytag;
```

After running this, hotel creation and updates will work.

---

## 2. Add `username` column to `profiles` table

Run this in **Supabase → SQL Editor**:

```sql
-- Add username column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

-- Make it unique so no two users share the same username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles (username);

-- Allow the app to read profiles by username (needed for login-by-username)
CREATE POLICY IF NOT EXISTS "Read profile by username"
  ON profiles FOR SELECT
  USING (true);
```

---

## 3. Ensure profiles INSERT is allowed for new signups

If new users cannot insert their own profile row, run:

```sql
CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

---

After all three steps, both hotel saving and user registration will work correctly.
