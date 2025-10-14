-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Users can create import jobs for their org" ON import_jobs;

-- Create a new policy that supports both regular users and platform admin impersonation
CREATE POLICY "Users can create import jobs for their org or admins can create for any org" 
ON import_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- Regular users: can create for their own org
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.org_id = import_jobs.org_id
    )
    OR
    -- Platform admins: can create for any org
    is_platform_admin(auth.uid())
  )
);