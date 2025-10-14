-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can create their own import jobs" ON import_jobs;

-- Create a more flexible policy that allows authenticated users to create import jobs
-- for their organization as long as they set themselves as the user_id
CREATE POLICY "Users can create import jobs for their org" 
ON import_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.org_id = import_jobs.org_id
  )
);