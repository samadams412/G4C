DELIMITER //

CREATE TRIGGER check_event_status_before_sale
BEFORE INSERT ON ticket
FOR EACH ROW
BEGIN
    -- Declares a local variable to hold the event status
    DECLARE event_status_check VARCHAR(50);
    
    -- 1. Get the status of the event being linked to the new ticket (NEW.event_id)
    -- NEW.event_id refers to the event_id value being inserted in the new row
    SELECT status INTO event_status_check
    FROM event
    WHERE event_id = NEW.event_id;
    
    -- 2. Check if the event is completed or canceled
    IF event_status_check = 'Completed' OR event_status_check = 'Canceled' THEN
        -- Prevent the INSERT by signalling a custom error (SQLSTATE '45000' is a generic error code)
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Cannot purchase a ticket for an event that is Canceled or Completed.';
    END IF;
END //

-- **Documentation: This trigger ensures that tickets cannot be sold for events that are either 'Completed' or 'Canceled'. 
-- **Functionality: It activates before any INSERT operation on the `ticket` table, checks the status of the associated event, and raises an error if the event is not in a valid state for ticket sales.

-- **Execution: This trigger is automatically invoked on every INSERT into the `ticket` table. No manual execution is required. It sets the order status to 'Completed' when a ticket is purchased.
DELIMITER //

CREATE TRIGGER update_order_status_on_ticket_purchase
AFTER INSERT ON ticket
FOR EACH ROW
BEGIN
    -- Only proceed if the new ticket being inserted is marked as 'Purchased'
    IF NEW.status = 'Purchased' THEN
        -- Update the corresponding order status to 'Completed'
        -- Note: We must check the existing order status to avoid overwriting a 'Refunded' status
        UPDATE orders
        SET status = 'Completed'
        WHERE order_id = NEW.order_id
          AND status = 'Pending'; -- Only update if the order is still pending
    END IF;
END //

DELIMITER ;

-- Demonstration Queries for Triggers
-- NOTE: You will need valid IDs. We assume Order ID 5006 is set to 'Pending' for testing.

-- 1. Check current order status for a test order (e.g., order_id 5006)
SELECT 
    order_id, 
    total_amount, 
    status 
FROM 
    orders 
WHERE 
    order_id = 5006; 

-- 2. INSERT a new test ticket associated with that order, setting status to 'Purchased'
-- This action fires the AFTER INSERT trigger and should update the order status.
INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status)
VALUES ('TKT-ORDERTEST1', 5006, 1050, 1, 35.00, 'Purchased');

-- 3. Check the order status again - it should be updated to 'Completed'
SELECT 
    order_id, 
    total_amount, 
    status 
FROM 
    orders 
WHERE 
    order_id = 5006;