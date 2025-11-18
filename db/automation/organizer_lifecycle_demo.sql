-- ============================================================
-- File: organizer_lifecycle_demo.sql
-- Purpose:
--   Demonstrates a basic organizer lifecycle in eventify_db:
--     1) Create a new Organizer user
--     2) Use an existing venue from the dataset
--     3) Organizer creates a new event at that venue
--
-- Notes:
--   - Uses demo values (title, capacity, etc.) for clarity.
--   - Relies on venue rows loaded by dummy_data.sql.
-- ============================================================

USE eventify_db;

-- ------------------------------------------------------------
-- STEP 1: Create a demo organizer user
-- ------------------------------------------------------------
INSERT INTO `user` (
    first_name,
    last_name,
    email,
    role,
    status
) VALUES (
    'Organizer',
    'LifecycleDemo',
    CONCAT('organizer.demo.', UNIX_TIMESTAMP(), '@example.com'),
    'Organizer',
    'Active' 
);

SET @organizer_id := LAST_INSERT_ID();

-- Optional: inspect organizer
-- SELECT * FROM `user` WHERE user_id = @organizer_id;


-- ------------------------------------------------------------
-- STEP 2: Use an existing venue from the dataset
--   We just pick the lowest venue_id as a stable choice.
-- ------------------------------------------------------------
SELECT venue_id
INTO @venue_id
FROM `venue`
ORDER BY venue_id
LIMIT 1;

-- Optional: inspect venue
-- SELECT * FROM `venue` WHERE venue_id = @venue_id;


-- ------------------------------------------------------------
-- STEP 3: Organizer creates a new event at that venue
-- ------------------------------------------------------------
SET @start_time := NOW() + INTERVAL 2 DAY;
SET @end_time   := @start_time + INTERVAL 3 HOUR;

INSERT INTO `event` (
    organizer_id,
    venue_id,
    title,
    description,
    start_time,
    end_time,
    capacity,
    status
) VALUES (
    @organizer_id,
    @venue_id,
    'Organizer Lifecycle Demo Event',
    'Event created by organizer_lifecycle_demo.sql to demonstrate organizer workflow.',
    @start_time,
    @end_time,
    150,
    'Draft'
);

SET @event_id := LAST_INSERT_ID();

-- Optional: inspect created event
-- SELECT * FROM `event` WHERE event_id = @event_id;


-- ------------------------------------------------------------
-- DONE: Return summary of created organizer and event
-- ------------------------------------------------------------
SELECT 
    'Organizer lifecycle demo completed.' AS info,
    @organizer_id AS organizer_id,
    @event_id     AS event_id;
