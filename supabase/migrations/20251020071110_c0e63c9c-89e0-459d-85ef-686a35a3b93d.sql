-- Add explicit DENY policies to prevent users from manipulating subscription data
-- Users cannot directly modify their plan or videos_remaining count
CREATE POLICY "Deny user modifications"
ON user_subscriptions FOR UPDATE
USING (false);

CREATE POLICY "Deny user inserts"
ON user_subscriptions FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny user deletes"
ON user_subscriptions FOR DELETE
USING (false);