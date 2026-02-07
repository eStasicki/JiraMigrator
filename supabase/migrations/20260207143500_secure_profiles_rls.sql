-- Drop the overly permissive public view policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;

-- Create a new policy that only allows users to see their own profile
CREATE POLICY "Users can view own profile." ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Note: The update and insert policies are already correctly scoped to auth.uid() = id
-- in the initial migration, so we don't need to change them.
