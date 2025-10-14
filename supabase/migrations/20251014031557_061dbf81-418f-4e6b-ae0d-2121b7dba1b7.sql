-- Drop the current policy
DROP POLICY IF EXISTS "Users can create import jobs for their org or admins can create for any org" ON import_jobs;

-- Create a simplified policy that directly checks the is_platform_admin column
-- This combines both checks in a single EXISTS clause for better evaluation
CREATE POLICY "Users can create import jobs for their org or admins can create for any org" 
ON import_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      -- Regular users: can create for their own org
      profiles.org_id = import_jobs.org_id 
      OR 
      -- Platform admins: can create for any org
      profiles.is_platform_admin = true
    )
  )
);