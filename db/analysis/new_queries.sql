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