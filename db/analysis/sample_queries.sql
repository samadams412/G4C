
-- 1. Total Revenue by Event Category
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
    o.status = 'Completed' -- Only completed orders count as revenue
GROUP BY
    c.name
ORDER BY
    TotalRevenue DESC;

-- 2. Upcoming Events in a Specific City (New Braunfels)
SELECT
    e.title AS EventTitle,
    e.start_time,
    v.name AS VenueName,
    CONCAT(u.first_name, ' ', u.last_name) AS OrganizerName
FROM
    event e
JOIN venue v ON e.venue_id = v.venue_id
JOIN user u ON e.organizer_id = u.user_id
WHERE
    e.status = 'Published'
    AND v.city = 'New Braunfels'
    AND e.start_time > NOW()
ORDER BY
    e.start_time ASC;

-- 3. Tickets Sold vs. Event Capacity
SELECT
    e.title AS EventTitle,
    e.capacity AS MaxCapacity,
    COUNT(t.ticket_id) AS TicketsSold,
    (e.capacity - COUNT(t.ticket_id)) AS RemainingSeats
FROM
    event e
LEFT JOIN ticket t 
    ON e.event_id = t.event_id 
    AND t.status = 'Purchased'
GROUP BY
    e.event_id, e.title, e.capacity
ORDER BY
    TicketsSold DESC;

-- 4. Insert a New User
INSERT INTO user (first_name, last_name, email, role, status)
VALUES ('Kosha', 'Antala', 'kosha.admin@eventify.com', 'Admin', 'Active');

-- 5. Find All Orders for a Specific Attendee
SELECT 
    o.order_id, 
    o.total_amount, 
    o.order_date, 
    o.status 
FROM 
    orders o
WHERE 
    o.user_id = 5;

-- 6. Attempting to Insert a Ticket for a Canceled Event (Trigger Test)
-- This should fail due to the check_event_status_before_sale trigger
INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status)
VALUES ('TKT-TRIGGERTEST', 5001, 1003, 1, 25.00, 'Purchased');

-- 7. Top 5 Events by Revenue
SELECT 
    e.title AS EventTitle,
    SUM(t.price) AS TotalRevenue
FROM
    event e
JOIN ticket t ON e.event_id = t.event_id
JOIN orders o ON t.order_id = o.order_id
WHERE o.status = 'Completed'
GROUP BY e.event_id, e.title
ORDER BY TotalRevenue DESC
LIMIT 5;

-- 8. Sales Summary for a Single Event (Using Stored Procedure)
CALL GetEventSalesSummary(1005);

