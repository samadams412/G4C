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
ORDER BY e.start_time ASC; -- 2. Upcoming Events in a specific city *Multi-Join*

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

SELECT v.name AS VenueName,			
v.city AS City,			
COUNT(e.event_id) AS TotalPublishedEvents			
FROM venue v			
JOIN event e ON v.venue_id = e.venue_id			
WHERE e.status = 'Published'			
GROUP BY v.venue_id, v.name, v.city			
ORDER BY TotalPublishedEvents DESC; -- 6. Count total published events by each Venue.

SELECT
    e.title,
    e.start_time,
    v.name AS Venue
FROM
    event e
JOIN 
    venue v ON e.venue_id = v.venue_id
JOIN 
    event_category ec ON e.event_id = ec.event_id
JOIN 
    category c ON ec.category_id = c.category_id
WHERE
    c.name = 'Music'
    AND e.status = 'Published'
    AND e.start_time > NOW()
ORDER BY
    e.start_time ASC; -- 7. Upcoming events by event category. 
    
SELECT
    e.title,
    COUNT(DISTINCT t.user_id) AS UniqueAttendees
FROM
    event e
JOIN 
    ticket t ON e.event_id = t.event_id
WHERE
    e.event_id = 1018 
    AND t.status = 'Purchased'
GROUP BY 
    e.title; -- 8. Show number of unique ticker purchasers for a specific event 
    
SELECT
    e.event_id,
    e.title,
    e.start_time,
    e.status,
    COUNT(t.ticket_id) AS TotalTicketsSold
FROM
    event e
JOIN
    ticket t ON e.event_id = t.event_id
WHERE
    t.status = 'Purchased' -- Only count actual purchased tickets
GROUP BY
    e.event_id, e.title, e.start_time, e.status
ORDER BY
    TotalTicketsSold DESC
LIMIT 10;   -- 9. List the top 10 most attended events 

SELECT
    e.title,
    e.start_time,
    v.name AS VenueName,
    v.city
FROM
    event e
JOIN
    venue v ON e.venue_id = v.venue_id
WHERE
    e.status = 'Published'
    AND e.start_time > NOW()
ORDER BY
    e.start_time ASC; -- 10. Show all upcoming events. 
    
SELECT
    v.name AS VenueName,
    v.city AS City,
    SUM(t.price) AS TotalRevenue,
    AVG(t.price) AS AverageTicketPrice
FROM
    venue v
JOIN
    event e ON v.venue_id = e.venue_id
JOIN
    ticket t ON t.event_id = e.event_id
JOIN
    orders o ON t.order_id = o.order_id
WHERE
    o.status = 'Completed'
    AND t.status = 'Purchased'
GROUP BY
    v.venue_id, v.name, v.city
ORDER BY
    TotalRevenue DESC;  -- 11. Venue revenue performance, shows total revenue for a venue as well as the average ticket price 

-- Attempting to insert a ticket for the Canceled event (e.g., ID 1003)
-- This should fail due to the trigger check_event_status_before_sale
INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status)
VALUES ('TKT-TRIGGERTEST', 5001, 1003, 1, 25.00, 'Purchased');