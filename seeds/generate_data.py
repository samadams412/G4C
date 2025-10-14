from faker import Faker
import random
from datetime import datetime, timedelta

# Initialize Faker
# Set locale to en_US for consistent American addressing
fake = Faker('en_US') 

# --- Configuration ---
NUM_USERS = 50
NUM_VENUES = 20
NUM_EVENTS = 100
NUM_ORDERS = 80
TICKETS_PER_ORDER_RANGE = (1, 5) 

# --- LOCAL FOCUS CONFIGURATION (San Antonio, TX Area) ---
# Define the specific cities/towns where all your events will take place.
LOCAL_CITIES = [
    'San Antonio', 
    'New Braunfels', 
    'Boerne', 
    'San Marcos', 
    'Seguin', 
    'Universal City', 
    'Schertz', 
    'Cibolo'
] 

# --- Data Storage (for PKs) ---
user_ids = []
venue_ids = []
category_ids = []
event_ids = []
order_ids = []

# =================================================================
# SQL Formatting Function
# =================================================================

def dict_to_sql_inserts(table_name, data):
    """Converts a list of dictionaries into a MySQL INSERT statement string."""
    if not data:
        return f"-- No data generated for {table_name}\n"

    # Get column names from the first dictionary
    columns = list(data[0].keys())
    
    # Start the INSERT statement template
    sql_template = f"INSERT INTO `{table_name}` ({', '.join(f'`{col}`' for col in columns)}) VALUES\n"
    
    values_list = []
    for row in data:
        # Format values: convert strings/dates to quoted strings, numbers as-is
        formatted_values = []
        for col in columns:
            value = row[col]
            if isinstance(value, (str, datetime)):
                # Escape single quotes and wrap in quotes for SQL
                formatted_values.append(f"'{str(value).replace("'", "''")}'")
            elif value is None:
                formatted_values.append("NULL")
            else:
                formatted_values.append(str(value))
        
        values_list.append(f"    ({', '.join(formatted_values)})")

    # Combine values and end the statement with a semicolon
    return sql_template + ',\n'.join(values_list) + ';\n\n'


# =================================================================
# 1. CORE TABLES (No FKs)
# =================================================================

# 1.1. user Table
print("--- Generating user data ---")
user_data = []
roles = ['organizer', 'attendee', 'admin'] # Added 'admin' role
statuses = ['Active', 'Suspended'] # Using schema status examples
for i in range(1, NUM_USERS + 1):
    user_id = i
    user_ids.append(user_id)
    user_data.append({
        'user_id': user_id,
        'name': fake.name(),
        'email': fake.unique.email(), # Ensure emails are unique
        'role': random.choice(roles),
        'status': random.choice(statuses)
    })

# 1.2. venue Table
print("--- Generating venue data ---")
venue_data = []
for i in range(1, NUM_VENUES + 1):
    venue_id = i + 100 
    venue_ids.append(venue_id)
    
    local_city = random.choice(LOCAL_CITIES)
    
    venue_data.append({
        'venue_id': venue_id,
        'name': local_city + ' ' + random.choice(['Community Center', 'Theater', 'Auditorium', 'Convention Hall', 'Park Pavilion']),
        'capacity': random.randint(50, 15000),
        'address': fake.street_address(),
        'city': local_city 
    })

# 1.3. category Table
print("--- Generating category data ---")
category_data = []
category_names = ['Music', 'Tech Conference', 'Food Festival', 'Sport', 'Arts & Theater', 'Workshop', 'Comedy', 'Exhibition'] 
for i, name in enumerate(category_names):
    category_id = i + 1
    category_ids.append(category_id)
    category_data.append({
        'category_id': category_id,
        'name': name # CORRECTED: matches 'name' column in schema
    })

# =================================================================
# 2. EVENT-RELATED TABLES (Requires user and venue FKs)
# =================================================================
# --- NEW FUNCTION TO GENERATE MEANINGFUL DESCRIPTION ---
def generate_meaningful_description(title, category_name):
    base_description = f"Join us for {title}, a premier event in the heart of San Antonio! "
    
    # Customize the description based on the category
    if 'Music' in category_name:
        description = base_description + fake.sentence(nb_words=10) + " Featuring local bands, rising stars, and a dynamic sound system. Get your tickets now before they sell out!"
    elif 'Tech' in category_name:
        description = base_description + "Explore the future of technology with industry leaders and groundbreaking demonstrations. This year's focus is on AI and sustainable computing. " + fake.sentence(nb_words=12)
    elif 'Food' in category_name:
        description = base_description + "A gastronomic journey awaits! Sample delicious offerings from the best local chefs and food trucks. Limited VIP tasting tickets available. " + fake.sentence(nb_words=8)
    elif 'Sport' in category_name:
        description = base_description + "High-octane action! Cheer on your favorite team or participate in the city-wide fun run. All skill levels welcome. " + fake.sentence(nb_words=9)
    elif 'Arts' in category_name or 'Theater' in category_name:
        description = base_description + "Immerse yourself in creativity with local artists, live performances, and stunning theatrical acts. Perfect for a cultural evening out. " + fake.sentence(nb_words=11)
    elif 'Workshop' in category_name:
        description = base_description + "Boost your skills with our hands-on workshop focused on " + fake.word() + " and digital marketing. Bring your laptop and your learning hat! " + fake.sentence(nb_words=7)
    else:
        # Fallback for generic events
        description = base_description + fake.paragraph(nb_sentences=3) 
        
    # Ensure the description doesn't exceed 200 characters (as defined in your schema notes)
    return description[:200]

# 2.1. event Table
print("--- Generating event data ---")
event_data = []
event_statuses = ['Draft', 'Published', 'Completed', 'Canceled']
organizer_ids = [u['user_id'] for u in user_data if u['role'] == 'organizer']
if not organizer_ids:
    organizer_ids = user_ids

for i in range(1, NUM_EVENTS + 1):
    event_id = i + 1000
    event_ids.append(event_id)
    
    start_time = fake.date_time_between(start_date='-1y', end_date='+2y', tzinfo=None)
    end_time = start_time + timedelta(hours=random.randint(2, 8))
    
    chosen_venue_id = random.choice(venue_ids)
    chosen_venue_capacity = next((v['capacity'] for v in venue_data if v['venue_id'] == chosen_venue_id), 1000)
    
    event_title = fake.catch_phrase() + ' Festival'
    
    # --- STEP 1: Determine a primary category for the description ---
    # We must pick a category *before* adding the event to the event_data list,
    # so we can use it to generate the description.
    random_category_id = random.choice(category_ids)
    
    # Find the category name
    category_info = next(c for c in category_data if c['category_id'] == random_category_id)
    primary_category_name = category_info['name'] 

    # --- STEP 2: Generate the custom description ---
    custom_description = generate_meaningful_description(event_title, primary_category_name)
    
    event_data.append({
        'event_id': event_id,
        'organizer_id': random.choice(organizer_ids),
        'venue_id': chosen_venue_id,
        'title': event_title,
        'description': custom_description, # <-- NOW USES MEANINGFUL DATA
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': end_time.strftime('%Y-%m-%d %H:%M:%S'),
        'capacity': random.randint(50, int(chosen_venue_capacity * 0.9)), 
        'status': random.choice(['Draft', 'Published', 'Completed', 'Canceled']) # Use schema status examples
    })
    
    # NOTE: The logic for populating event_category (Section 2.2) 
    # must still run afterward to assign 1-2 categories.

# 2.2. event_category Table (Junction Table)
print("--- Generating event_category data ---")
event_category_data = []
seen_event_categories = set()

for event in event_data:
    event_id = event['event_id']
    
    # Ensure event marked 'Published' has at least one category (as per schema constraint)
    min_categories = 1 if event['status'] == 'Published' else 0
    num_categories = random.randint(min_categories, 2)

    categories_to_assign = random.sample(category_ids, k=num_categories)
    for category_id in categories_to_assign:
        key = (event_id, category_id)
        if key not in seen_event_categories:
            event_category_data.append({
                'event_id': event_id,
                'category_id': category_id
            })
            seen_event_categories.add(key)

# =================================================================
# 3. ORDER & TICKET TABLES (Requires user, event FKs)
# =================================================================

# 3.1. orders Table
print("--- Generating orders data ---")
order_data = []
order_statuses = ['Completed', 'Pending', 'Refunded']
attendee_ids = [u['user_id'] for u in user_data if u['role'] == 'attendee']

for i in range(1, NUM_ORDERS + 1):
    order_id = i + 5000
    order_ids.append(order_id)
    
    order_data.append({
        'order_id': order_id,
        'user_id': random.choice(attendee_ids) if attendee_ids else random.choice(user_ids),
        'total_amount': round(random.uniform(20.0, 500.0), 2),
        'order_date': fake.date_time_between(start_date='-6m', end_date='now', tzinfo=None).strftime('%Y-%m-%d %H:%M:%S'),
        'status': random.choice(order_statuses)
    })

# 3.2. ticket Table
print("--- Generating ticket data ---")
ticket_data = []
ticket_statuses = ['Purchased', 'Reserved', 'Refunded']
ticket_counter = 1

for order in order_data:
    # Only generate tickets for 'Completed' orders for realism
    if order['status'] == 'Completed':
        num_tickets = random.randint(*TICKETS_PER_ORDER_RANGE)
        
        # Select an event that is *not* cancelled
        available_events = [e for e in event_data if e['status'] != 'Canceled']
        if not available_events: continue
            
        event_id = random.choice([e['event_id'] for e in available_events])
        
        if order['total_amount'] > 0 and num_tickets > 0:
            price_per_ticket = round(order['total_amount'] / num_tickets, 2)
        else:
            price_per_ticket = 0.00
            
        
        for _ in range(num_tickets):
            ticket_data.append({
                'ticket_id': f"TKT-{ticket_counter:05d}", # CORRECTED: Changed 'unique_id' to 'ticket_id'
                'order_id': order['order_id'],
                'event_id': event_id,
                'user_id': order['user_id'],
                'price': price_per_ticket,
                'status': random.choice(ticket_statuses)
            })
            ticket_counter += 1

# =================================================================
# 4. REVIEW AND OUTPUT (Display a sample and generate SQL)
# =================================================================

print("\n--- SAMPLE OUTPUT ---")
print(f"Total users generated: {len(user_data)}")
print(f"Sample user: {user_data[0]}")
print(f"Total events generated: {len(event_data)}")
print(f"Sample event: {event_data[0]}")
print(f"Total orders generated: {len(order_data)}")
print(f"Sample order: {order_data[0]}")
print(f"Total tickets generated: {len(ticket_data)}")
print(f"Sample ticket: {ticket_data[0]}")


# 4.1. Generate SQL
print("\n--- Generating SQL INSERT Statements ---")
sql_output = ""

# Order of insertion is CRITICAL due to FK constraints
sql_output += dict_to_sql_inserts("user", user_data)
sql_output += dict_to_sql_inserts("venue", venue_data)
sql_output += dict_to_sql_inserts("category", category_data)
sql_output += dict_to_sql_inserts("event", event_data)
sql_output += dict_to_sql_inserts("event_category", event_category_data)
sql_output += dict_to_sql_inserts("orders", order_data)
sql_output += dict_to_sql_inserts("ticket", ticket_data)

# 4.2. Save to a file
output_filename = 'dummy_data.sql'
try:
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(sql_output)
    print(f"✅ Success! SQL data saved to {output_filename}. Ready for database import.")
except IOError as e:
    print(f"❌ Error saving file: {e}")