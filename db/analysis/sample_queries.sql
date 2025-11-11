SELECT
    c.name AS Category,
    SUM(t.price) AS TotalRevenue 
FROM
    category c
JOIN event_category ec ON c.category_id = ec.category_id
JOIN event e ON ec.event_id = e.event_id
JOIN ticket t ON t.event_id = e.event_id  
JOIN orders o ON t.order_id = o.order_id  
WHERE
    o.status = 'Completed' -- Filter out pending or refunded orders
GROUP BY c.name
ORDER BY TotalRevenue DESC; -- 1. Total Revenue by Event Category *Aggregate and Join*

SELECT
    e.title, e.start_time, v.name AS VenueName, u.name AS Organizer
FROM
    event e
JOIN venue v ON e.venue_id = v.venue_id
JOIN user u ON e.organizer_id = u.user_id
WHERE
    e.status = 'Published'
    AND v.city = 'New Braunfels'
    AND e.start_time > NOW()
ORDER BY e.start_time ASC; -- 2. Upcoming Events in New Braunfels *Multi-Join*

SELECT
    e.title,
    e.capacity AS MaxCapacity,
    COUNT(t.ticket_id) AS TicketsSold,
    (e.capacity - COUNT(t.ticket_id)) AS RemainingSeats
FROM
    event e
LEFT JOIN ticket t ON e.event_id = t.event_id AND t.status = 'Purchased'
GROUP BY e.event_id
ORDER BY TicketsSold DESC;  -- 3. Tickets Sold vs. Event Capacity *Aggregate*

-- INSERT INTO user (name, email, role, status) 
-- VALUES ('Sam Adams', 'sam.admin@eventify.com', 'Admin', 'Active'); -- 4. Insert a new user

SELECT 
    o.order_id, 
    o.total_amount, 
    o.order_date, 
    o.status 
FROM 
    orders o
WHERE 
    o.user_id = 5; -- 5. Find all Orders for a specific attendee 

-- Attempting to insert a ticket for the Canceled event (e.g., ID 1003)
-- This should fail due to the trigger check_event_status_before_sale
INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status)
VALUES ('TKT-TRIGGERTEST', 5001, 1003, 1, 25.00, 'Purchased');