-- ============================================================
-- File: user_lifecycle_demo.sql
-- Purpose:
--   Demonstrates a full attendee account lifecycle in eventify_db:
--     1) Create a new Attendee user
--     2) User buys a ticket for an existing event
--     3) User account is suspended
--     4) User account and related data are deleted
--
-- Notes:
--   - Uses demo values so the flow is predictable and repeatable.
--   - Uses an existing event from the dataset (via ORDER BY ... LIMIT 1).
--   - Cleans up its own data (ticket -> order -> user) at the end.
-- ============================================================

USE eventify_db;

-- ------------------------------------------------------------
-- STEP 1: Create a demo attendee user
-- ------------------------------------------------------------
INSERT INTO `user` (
    first_name,
    last_name,
    email,
    role,
    status
) VALUES (
    'Lifecycle',
    'DemoUser',
    CONCAT('lifecycle.demo.', UNIX_TIMESTAMP(), '@example.com'),
    'Attendee',    -- valid value from ENUM('Attendee','Organizer','Admin')
    'Active'       -- valid value from ENUM('Active','Suspended')
);

SET @user_id := LAST_INSERT_ID();

-- Optional: inspect the created user
-- SELECT * FROM `user` WHERE user_id = @user_id;


-- ------------------------------------------------------------
-- STEP 2: Choose an existing event for this user to attend
--   We simply pick the earliest event by start_time from dummy_data.
-- ------------------------------------------------------------
SELECT event_id
INTO @event_id
FROM `event`
ORDER BY start_time
LIMIT 1;

-- Optional: inspect chosen event
-- SELECT * FROM `event` WHERE event_id = @event_id;


-- ------------------------------------------------------------
-- STEP 3: Create an order for this user
-- ------------------------------------------------------------
INSERT INTO `orders` (
    user_id,
    total_amount,
    order_date,
    status
) VALUES (
    @user_id,
    50.00,        -- demo ticket price for this order
    NOW(),
    'Completed'   
);

SET @order_id := LAST_INSERT_ID();

-- Optional: inspect the created order
-- SELECT * FROM `orders` WHERE order_id = @order_id;


-- ------------------------------------------------------------
-- STEP 4: Create a ticket linked to that order + event + user
-- ------------------------------------------------------------
INSERT INTO `ticket` (
    ticket_id,
    order_id,
    event_id,
    user_id,
    price,
    status
) VALUES (
    CONCAT('LC-', @order_id, '-', @event_id),  -- unique demo ticket_id
    @order_id,
    @event_id,
    @user_id,
    50.00,        -- same as total_amount for this simple demo
    'Purchased'  
);

-- Optional: inspect the created ticket
-- SELECT * FROM `ticket` WHERE order_id = @order_id;


-- ------------------------------------------------------------
-- STEP 5: Suspend the user account
-- ------------------------------------------------------------
UPDATE `user`
SET status = 'Suspended'   
WHERE user_id = @user_id;


-- ------------------------------------------------------------
-- STEP 6: Clean up demo data
--   Delete in FK-safe order:
--     1) ticket (FK to orders, event, user)
--     2) orders (FK to user)
--     3) user
-- ------------------------------------------------------------

DELETE FROM `ticket`
WHERE user_id = @user_id;

DELETE FROM `orders`
WHERE user_id = @user_id;

DELETE FROM `user`
WHERE user_id = @user_id;


-- ------------------------------------------------------------
-- DONE: Return confirmation
-- ------------------------------------------------------------
SELECT 'User lifecycle demo completed.' AS info;
