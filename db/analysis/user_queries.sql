USE eventify_db;

# List all users, sorted by last, first
SELECT * FROM user
ORDER BY 
	last_name, 
	first_name;

# List active admins and their available contact information (Email)
SELECT 
	first_name, 
	last_name,
    email
FROM user WHERE
	status="Active" AND role="Admin"
ORDER BY last_name, first_name;
    
# List all suspended users ordered by last, first
SELECT * FROM user WHERE status="suspended"
ORDER BY last_name, first_name