-- View to allow organizers to quickly see their upcoming events.
CREATE VIEW OrganizerUpcomingEvents AS
SELECT
    e.event_id,
    e.title,
    e.start_time,
    v.name AS VenueName,   
    v.city AS VenueCity,   
    u.user_id AS OrganizerID,
    CONCAT(u.first_name, ' ', u.last_name) AS OrganizerName
FROM
    event e
JOIN venue v ON e.venue_id = v.venue_id
JOIN user u ON e.organizer_id = u.user_id
WHERE
    e.status = 'Published'
    AND e.start_time > NOW();
    
-- The Demonstration Query 
SELECT 
    title AS EventTitle, 
    start_time, 
    VenueName,        
    VenueCity         
FROM 
    OrganizerUpcomingEvents
WHERE 
    OrganizerID = 4
LIMIT 0, 1000;