USE eventify_db;

# Using user_id 21
# Using event_id 1074

# Get an user's purchased tickets (id, order_id, event title, date, venue name)
SELECT 
	ticket_id,
    order_id,
    price,
    title AS event_title,
    start_time AS date,
    v.name AS venue_name,
    address AS venue_address
FROM ticket AS t
INNER JOIN event AS e ON t.event_id=e.event_id
INNER JOIN venue AS v ON v.venue_id=e.venue_id
WHERE user_id=21;

# Get all of the tickets for a certain event with user id, name, and contact information

SELECT 
	ticket_id,
    price,
    u.user_id,
    first_name,
    last_name,
    email
FROM ticket AS t
INNER JOIN user AS u ON t.user_id=u.user_id
WHERE event_id=1074;


# Tickets Sold vs. Event Capacity
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


# Find All Orders for a Specific Attendee
SELECT 
    o.order_id, 
    o.total_amount, 
    o.order_date, 
    o.status 
FROM 
    orders o
WHERE 
    o.user_id=21;


# Attempting to Insert a Ticket for a Canceled Event (Trigger Test)
# This should fail due to the check_event_status_before_sale trigger
# event_id 1013 is a canceled event
INSERT INTO ticket (ticket_id, order_id, event_id, user_id, price, status)
VALUES ('TKT-TRIGGERTEST', 5001, 1013, 1, 25.00, 'Purchased');



