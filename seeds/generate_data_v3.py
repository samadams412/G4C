from faker import Faker
import random
from datetime import datetime, timedelta

# Initialize Faker
# Set locale to en_US for consistent American addressing
fake = Faker('en_US') 

# --- Configuration ---
NUM_USERS = 500     
NUM_VENUES = 50     
NUM_EVENTS = 200   
NUM_ORDERS = 1000    
TICKETS_PER_ORDER_RANGE = (1, 5)

# --- LOCAL FOCUS CONFIGURATION (San Antonio, TX Area) ---
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
roles = ['organizer', 'attendee', 'admin'] 
statuses = ['Active', 'Suspended'] # Using schema status examples
for i in range(1, NUM_USERS + 1):
    user_id = i
    user_ids.append(user_id)
    user_data.append({
        'user_id': user_id,
        'first_name': fake.first_name(), 
        'last_name': fake.last_name(),   
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
        'name': name 
    })

# =================================================================
# 2. EVENT-RELATED TABLES (Requires user and venue FKs)
# =================================================================
# --- CURATED WORD LISTS FOR CATEGORY-AWARE TITLES ---
MUSIC_BAND_ADJ = ['Crimson', 'Electric', 'Velvet', 'Neon', 'Golden', 'Midnight', 'Wild', 'Silver', 'Rebel', 'Echo']
MUSIC_BAND_NOUN = ['Wolves', 'Collective', 'Tide', 'Riot', 'Horizon', 'Static', 'Pulse', 'Parade', 'Revival', 'Theory']
MUSIC_SUFFIX = ['Live', 'Live in {city}', 'Unplugged', 'World Tour Stop', 'Homecoming Show', 'Acoustic Session']

TECH_THEME = ['AI & Automation', 'Cloud Native Engineering', 'Startup Growth', 'Developer Experience',
              'Cybersecurity', 'Future of Work', 'Data & Analytics']
TECH_FORMAT = ['Summit', 'Conference', 'Expo', 'Forum', 'Meetup']

FOOD_THEME = ['Street Food', 'BBQ & Brews', 'Taco Trail', 'Farm to Table', 'Night Market', 'Dessert & Sweets', 'Craft Beer']
FOOD_FORMAT = ['Festival', 'Fest', 'Food Crawl', 'Tasting Tour']

SPORT_EVENT = ['5K Run', 'Basketball Classic', 'Soccer Showdown', 'Charity Golf Tournament',
               'Youth League Finals', 'Cycling Challenge', 'Rivalry Game', 'Fun Run']

ARTS_SHOW = ['Shadows & Light', 'The Last Encore', 'Painted Skies', 'Echoes of Tomorrow',
             'A Midsummer Revue', 'Borrowed Time', 'Second Act']
ARTS_FORMAT = ['A Theatrical Experience', 'Live on Stage', 'One Night Only', 'Student Showcase',
               'Community Theater Production']

WORKSHOP_SKILL = ['Pottery', 'Photography', 'Watercolor Painting', 'Public Speaking', 'Personal Finance',
                   'Woodworking', 'Coding for Beginners', 'Yoga', 'Creative Writing', 'Floral Design']

COMEDY_FORMAT = ['Comedy Night', 'Stand-Up Showcase', 'Open Mic Night', 'Laugh Fest', 'Improv Jam']

EXHIBIT_THEME = ['Modern Art', 'Local Photography', 'Vintage Cars', 'Science & Innovation',
                  'Handmade Crafts', 'Historic San Antonio', 'Student Art']
EXHIBIT_FORMAT = ['Exhibition', 'Showcase', 'Gallery Opening', 'Open House']


def generate_title(category_name, city):
    """Builds a category-aware title from curated word lists instead of Faker's jargon generators."""
    if category_name == 'Music':
        band_name = f"{random.choice(MUSIC_BAND_ADJ)} {random.choice(MUSIC_BAND_NOUN)}"
        suffix = random.choice(MUSIC_SUFFIX).format(city=city)
        return f"{band_name}: {suffix}"
    elif category_name == 'Tech Conference':
        return f"{random.choice(TECH_THEME)} {random.choice(TECH_FORMAT)}"
    elif category_name == 'Food Festival':
        return f"{city} {random.choice(FOOD_THEME)} {random.choice(FOOD_FORMAT)}"
    elif category_name == 'Sport':
        return f"{city} {random.choice(SPORT_EVENT)}"
    elif category_name == 'Arts & Theater':
        return f"{random.choice(ARTS_SHOW)}: {random.choice(ARTS_FORMAT)}"
    elif category_name == 'Workshop':
        return f"{random.choice(WORKSHOP_SKILL)} Workshop"
    elif category_name == 'Comedy':
        return f"{fake.last_name()} Presents: {random.choice(COMEDY_FORMAT)}"
    elif category_name == 'Exhibition':
        return f"{random.choice(EXHIBIT_THEME)} {random.choice(EXHIBIT_FORMAT)}"
    else:
        return f"{city} Community Festival"


# --- CATEGORY-VARIED DESCRIPTION TEMPLATES WITH VENUE/CITY/DATE SLOTS ---
DESCRIPTION_TEMPLATES = [
    "{title} comes to {venue} in {city} on {date}. {flavor}",
    "Mark your calendar: {title} takes over {venue} in {city} starting {date}. {flavor}",
    "{city} welcomes {title} to {venue} on {date}. {flavor}",
    "Doors open for {title} at {venue} ({city}) on {date}. {flavor}",
    "{title} returns to {city} this {date}, hosted at {venue}. {flavor}",
]

CATEGORY_FLAVOR = {
    'Music': [
        "Expect a full lineup of local and touring acts plus a late set.",
        "Bring your dancing shoes for a night of live sound and surprise guests.",
    ],
    'Tech Conference': [
        "Sessions run from hands-on workshops to panel talks with working engineers.",
        "Expect deep-dive sessions, demo booths, and plenty of hallway networking.",
    ],
    'Food Festival': [
        "Sample dishes from dozens of local vendors and food trucks.",
        "VIP tasting passes include early entry and a chef's table.",
    ],
    'Sport': [
        "All skill levels are welcome, and registration includes a finisher's shirt.",
        "Come cheer on the home team or sign up to compete yourself.",
    ],
    'Arts & Theater': [
        "A small cast and an intimate venue make for a night you won't forget.",
        "Tickets include a post-show talk with the cast and director.",
    ],
    'Workshop': [
        "Bring your own materials, or rent a kit at the door.",
        "Space is limited to a small group so everyone gets hands-on time.",
    ],
    'Comedy': [
        "Doors open early for a full bar and a lineup of local favorites.",
        "Expect a mix of headliners and up-and-comers testing new material.",
    ],
    'Exhibition': [
        "Free admission for students, with guided tours running throughout the day.",
        "Pieces from local and regional artists will be available for purchase.",
    ],
}


def generate_description(title, category_name, venue_name, city, start_time):
    template = random.choice(DESCRIPTION_TEMPLATES)
    flavor_options = CATEGORY_FLAVOR.get(category_name, ["Come see what all the buzz is about."])
    flavor = random.choice(flavor_options)
    date_str = start_time.strftime('%B %d, %Y')
    return template.format(title=title, venue=venue_name, city=city, date=date_str, flavor=flavor)

# 2.1. event Table
print("--- Generating event data ---")
event_data = []
event_statuses = ['Draft', 'Published', 'Completed', 'Canceled']
organizer_ids = [u['user_id'] for u in user_data if u['role'] == 'organizer']
if not organizer_ids:
    organizer_ids = user_ids

event_primary_category = {}

for i in range(1, NUM_EVENTS + 1):
    event_id = i + 1000
    event_ids.append(event_id)

    # --- DATE SKEWING LOGIC ---
    if random.random() < 0.7:
        start_time = fake.date_time_between(start_date='+1M', end_date='+2y', tzinfo=None)
    else:
        start_time = fake.date_time_between(start_date='-1y', end_date='-1M', tzinfo=None)

    end_time = start_time + timedelta(hours=random.randint(2, 8))

    chosen_venue_id = random.choice(venue_ids)
    chosen_venue = next(v for v in venue_data if v['venue_id'] == chosen_venue_id)

    # --- Category, Title, and Description ---
    random_category_id = random.choice(category_ids)
    category_info = next(c for c in category_data if c['category_id'] == random_category_id)
    primary_category_name = category_info['name']
    event_primary_category[event_id] = random_category_id

    event_title = generate_title(primary_category_name, chosen_venue['city'])
    custom_description = generate_description(
        event_title, primary_category_name, chosen_venue['name'], chosen_venue['city'], start_time
    )

    # --- STATUS SKEWING LOGIC ---
    if start_time < datetime.now():
        status_choice = random.choice(['Completed'] * 8 + ['Canceled', 'Draft'] * 1)
    else:
        status_choice = random.choice(['Published'] * 7 + ['Draft'] * 2 + ['Canceled'] * 1)

    event_data.append({
        'event_id': event_id,
        'organizer_id': random.choice(organizer_ids),
        'venue_id': chosen_venue_id,
        'title': event_title,
        'description': custom_description,
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': end_time.strftime('%Y-%m-%d %H:%M:%S'),
        'capacity': random.randint(50, int(chosen_venue['capacity'] * 0.9)),
        'status': status_choice
    })

# 2.2. event_category Table (Junction Table)
print("--- Generating event_category data ---")
event_category_data = []
seen_event_categories = set()

for event in event_data:
    event_id = event['event_id']
    primary_category_id = event_primary_category[event_id]

    min_categories = 1 if event['status'] == 'Published' else 0
    num_categories = random.randint(min_categories, 2)

    categories_to_assign = set()
    if num_categories >= 1:
        categories_to_assign.add(primary_category_id)
    while len(categories_to_assign) < num_categories:
        categories_to_assign.add(random.choice(category_ids))

    for category_id in categories_to_assign:
        key = (event_id, category_id)
        if key not in seen_event_categories:
            event_category_data.append({
                'event_id': event_id,
                'category_id': category_id
            })
            seen_event_categories.add(key)

# --- Hit Event Weighting ---
# The ticket table's trigger only allows tickets for Published events, so both
# pools below are restricted to Published event ids.
published_event_ids = [e['event_id'] for e in event_data if e['status'] == 'Published']
NUM_POPULAR_EVENTS = min(20, len(published_event_ids))
popular_event_ids = random.sample(published_event_ids, k=NUM_POPULAR_EVENTS)
AVAILABLE_TICKET_EVENTS = popular_event_ids * 7 + published_event_ids * 3

# =================================================================
# 3. ORDER & TICKET TABLES (Requires user, event FKs)
# =================================================================

# 3.1. orders Table
print("--- Generating orders data ---")
order_data = []
order_statuses_weighted = ['Completed'] * 7 + ['Pending'] * 2 + ['Refunded'] * 1 
attendee_ids = [u['user_id'] for u in user_data if u['role'] == 'attendee']

for i in range(1, NUM_ORDERS + 1):
    order_id = i + 5000
    order_ids.append(order_id)
    
    order_data.append({
        'order_id': order_id,
        'user_id': random.choice(attendee_ids) if attendee_ids else random.choice(user_ids),
        'total_amount': round(random.uniform(20.0, 500.0), 2),
        'order_date': fake.date_time_between(start_date='-6m', end_date='now', tzinfo=None).strftime('%Y-%m-%d %H:%M:%S'),
        'status': random.choice(order_statuses_weighted)
    })

# 3.2. ticket Table
print("--- Generating ticket data ---")
ticket_data = []
ticket_statuses = ['Purchased', 'Reserved', 'Refunded']
ticket_counter = 1

for order in order_data:
    if order['status'] == 'Completed':
        num_tickets = random.randint(*TICKETS_PER_ORDER_RANGE)
        
        if not AVAILABLE_TICKET_EVENTS: continue

        event_id = random.choice(AVAILABLE_TICKET_EVENTS)
        
        if order['total_amount'] > 0 and num_tickets > 0:
            price_per_ticket = round(order['total_amount'] / num_tickets, 2)
        else:
            price_per_ticket = 0.00
            
        
        for _ in range(num_tickets):
            ticket_data.append({
                'ticket_id': f"TKT-{ticket_counter:05d}",
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
print(f"Sample user: {user_data[0]}") # Will now show first_name and last_name
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
output_filename = 'db/dummy_data.sql'
try:
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(sql_output)
    print(f"✅ Success! SQL data saved to {output_filename}. Ready for database import.")
except IOError as e:
    print(f"❌ Error saving file: {e}")