# Supabase Setup — Required Actions

Run these SQL statements once in your Supabase **SQL Editor** to fix role-change permissions and add font preference columns.

---

## 1. Add missing columns to `profiles`

```sql
-- Font preferences (stored in DB, not just auth metadata)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'inter';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS font_size   INTEGER DEFAULT 16;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar      TEXT;
```

---

## 2. RLS policy — allow superadmin to update any profile's role

By default Supabase RLS only allows a user to update their OWN row.
This policy lets superadmins change anyone's role:

```sql
CREATE POLICY "superadmin can update any profile"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.id = auth.uid() AND me.role = 'superadmin'
  )
)
WITH CHECK (true);
```

Also allow admins to update viewer/editor roles:

```sql
CREATE POLICY "admin can update viewer and editor profiles"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.id = auth.uid() AND me.role IN ('admin', 'superadmin')
  )
  AND
  -- Admins cannot escalate to admin or superadmin (only superadmin can)
  (NEW.role IN ('viewer', 'editor') OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'superadmin'
  ))
)
WITH CHECK (true);
```

---

## 3. Optional: Postgres function for role changes (bypasses RLS cleanly)

This is the cleanest approach — create a SECURITY DEFINER function:

```sql
CREATE OR REPLACE FUNCTION set_user_role(target_id UUID, new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Get the calling user's role
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();

  -- Only superadmin can set any role; admin can only set viewer/editor
  IF caller_role = 'superadmin' THEN
    UPDATE profiles SET role = new_role WHERE id = target_id;
  ELSIF caller_role = 'admin' AND new_role IN ('viewer', 'editor', 'pending') THEN
    UPDATE profiles SET role = new_role WHERE id = target_id;
  ELSE
    RAISE EXCEPTION 'Insufficient permissions to change role';
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION set_user_role(UUID, TEXT) TO authenticated;
```

> **Recommended:** Use option 3 (the function). It's the cleanest and most secure.
> The app tries the RPC first, then falls back to direct UPDATE.

---

## 4. Check existing RLS policies

Run this to see what policies currently exist on profiles:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

If you see a policy like `"Users can update own profile"` that restricts to `auth.uid() = id`,
that is blocking role changes. Either drop it or add the superadmin override above.
