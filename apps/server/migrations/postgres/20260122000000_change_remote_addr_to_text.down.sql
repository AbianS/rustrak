-- Revert remote_addr column from TEXT back to INET
-- NULL out any values that are not valid INET to avoid cast failure
ALTER TABLE events ALTER COLUMN remote_addr TYPE INET
    USING CASE
        WHEN remote_addr IS NULL THEN NULL
        WHEN remote_addr ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}(/[0-9]+)?$'
          OR remote_addr ~ '^[0-9a-fA-F:]+(/[0-9]+)?$'
        THEN remote_addr::inet
        ELSE NULL
    END;
