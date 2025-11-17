USE eventify_db;

# Using event_id 1011 for single-event specific events
# Using organizer_id 27 for organizer-based queries

# Get all available events in order of start time (Upcoming prioritized)
# Should only grab events with later dates than the current date
SELECT * FROM event WHERE status="published" AND start_time > NOW()
ORDER BY start_time;

# Get all events set up by specific organizer
SELECT * FROM event WHERE organizer_id=27;

# Get Top 5 Events by Revenue
SELECT 
    e.title AS event_title,
    SUM(t.price) AS total_revenue
FROM
    event e
JOIN ticket t ON e.event_id = t.event_id
JOIN orders o ON t.order_id = o.order_id
WHERE o.status = 'Completed'
GROUP BY e.event_id, e.title
ORDER BY total_revenue DESC
LIMIT 5;

# Total Revenue by Event Category
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
    
# Sales Summary for a Single Event (Using Stored Procedure)
CALL GetEventSalesSummary(1050);

# Upcoming Events in a Specific City (New Braunfels)
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
