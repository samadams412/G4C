DELIMITER //

CREATE DEFINER=`root`@`localhost` PROCEDURE `GetEventSalesSummary`(
    IN p_event_id INT
)
BEGIN
    SELECT
        e.title,
        e.capacity AS TotalCapacity,
        COUNT(t.ticket_id) AS TicketsSold,
        (e.capacity - COUNT(t.ticket_id)) AS RemainingCapacity
    FROM
        event e
    LEFT JOIN
        ticket t ON e.event_id = t.event_id AND t.status = 'Purchased'
    WHERE
        e.event_id = p_event_id
    GROUP BY
        e.event_id, e.title, e.capacity;
END //

-- **Documentation: Provides event organizers and admins with a real-time summary of sales and remaining inventory for a single event. 
-- **Functionality: Takes one input parameter (`p_event_id`) and executes a multi-table query with aggregate functions (`COUNT`) to calculate tickets sold and remaining capacity. 
-- **Execution: `CALL GetEventSalesSummary(1005);` (Using an event_id from the event table)