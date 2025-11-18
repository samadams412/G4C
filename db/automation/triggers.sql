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