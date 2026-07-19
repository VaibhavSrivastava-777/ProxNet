-- 1. Add new columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_credits_granted boolean NOT NULL DEFAULT false;

-- 2. Add is_charged to chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_charged boolean NOT NULL DEFAULT false;

-- 3. Create charge_session RPC
CREATE OR REPLACE FUNCTION charge_session(p_user_id uuid, p_session_id uuid, amount integer)
RETURNS boolean AS $$
DECLARE
    current_balance integer;
    session_charged boolean;
BEGIN
    -- Check if already charged
    SELECT is_charged INTO session_charged FROM chat_sessions WHERE id = p_session_id;
    IF session_charged THEN
        RETURN true; -- Already paid for
    END IF;

    -- Lock the user row for update to prevent race conditions
    SELECT wallet INTO current_balance FROM users WHERE id = p_user_id FOR UPDATE;
    
    IF current_balance >= amount THEN
        UPDATE users SET wallet = wallet - amount WHERE id = p_user_id;
        UPDATE chat_sessions SET is_charged = true WHERE id = p_session_id;
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for granting initial credits
CREATE OR REPLACE FUNCTION grant_initial_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if profile is complete (name, email, company, title, photo, linkedin, location)
    IF NEW.initial_credits_granted = false AND
       NEW.full_name IS NOT NULL AND NEW.full_name != '' AND
       NEW.email IS NOT NULL AND NEW.email != '' AND
       NEW.company IS NOT NULL AND NEW.company != '' AND
       NEW.job_title IS NOT NULL AND NEW.job_title != '' AND
       NEW.profile_photo_url IS NOT NULL AND NEW.profile_photo_url != '' AND
       NEW.linkedin_profile_url IS NOT NULL AND NEW.linkedin_profile_url != '' AND
       NEW.home_lat IS NOT NULL AND NEW.home_lng IS NOT NULL THEN
       
       NEW.wallet = NEW.wallet + 100;
       NEW.initial_credits_granted = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_grant_initial_credits ON users;

CREATE TRIGGER trigger_grant_initial_credits
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION grant_initial_credits();

-- 5. Backfill existing users
-- Force an update on users who meet the criteria so the trigger grants them credits.
UPDATE users 
SET updated_at = now() 
WHERE 
    initial_credits_granted = false AND
    full_name IS NOT NULL AND full_name != '' AND
    email IS NOT NULL AND email != '' AND
    company IS NOT NULL AND company != '' AND
    job_title IS NOT NULL AND job_title != '' AND
    profile_photo_url IS NOT NULL AND profile_photo_url != '' AND
    linkedin_profile_url IS NOT NULL AND linkedin_profile_url != '' AND
    home_lat IS NOT NULL AND home_lng IS NOT NULL;
