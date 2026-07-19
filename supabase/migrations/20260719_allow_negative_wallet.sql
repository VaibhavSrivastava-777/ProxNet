-- Update charge_session to allow negative balances (no restrictions)
CREATE OR REPLACE FUNCTION charge_session(p_user_id uuid, p_session_id uuid, amount integer)
RETURNS boolean AS $$
DECLARE
    session_charged boolean;
BEGIN
    -- Check if already charged
    SELECT is_charged INTO session_charged FROM chat_sessions WHERE id = p_session_id;
    IF session_charged THEN
        RETURN true; -- Already paid for
    END IF;

    -- Deduct credits regardless of current balance
    UPDATE users SET wallet = wallet - amount WHERE id = p_user_id;
    UPDATE chat_sessions SET is_charged = true WHERE id = p_session_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql;
