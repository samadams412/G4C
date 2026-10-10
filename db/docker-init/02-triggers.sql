-- Init-time extract of db/automation/triggers.sql: DDL only.
-- The source file also contains a demo INSERT (test order 5006) that assumes
-- seed data already exists; that's for manual runs, not container boot, so
-- it's left out here to avoid an FK failure before db/dummy_data.sql loads.

DELIMITER //

CREATE TRIGGER check_event_status_before_sale
BEFORE INSERT ON ticket
FOR EACH ROW
BEGIN
    DECLARE event_status_check VARCHAR(50);

    SELECT status INTO event_status_check
    FROM event
    WHERE event_id = NEW.event_id;

    IF event_status_check = 'Completed' OR event_status_check = 'Canceled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Cannot purchase a ticket for an event that is Canceled or Completed.';
    END IF;
END //

CREATE TRIGGER update_order_status_on_ticket_purchase
AFTER INSERT ON ticket
FOR EACH ROW
BEGIN
    IF NEW.status = 'Purchased' THEN
        UPDATE orders
        SET status = 'Completed'
        WHERE order_id = NEW.order_id
          AND status = 'Pending';
    END IF;
END //

DELIMITER ;
