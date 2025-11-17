from faker import Faker
import random
from datetime import datetime, timedelta

# Initialize Faker
fake = Faker('en_US')  # consistent US-style names and addresses

# --- Configuration ---
NUM_USERS = 50
NUM_VENUES = 20
NUM_EVENTS = 100
NUM_ORDERS = 80
TICKETS_PER_ORDER_RANGE = (1, 5)

# --- Local focus configuration ---
LOCAL_CITIES = [
    'San Antonio', 'New Braunfels', 'Boerne', 'San Marcos',
    'Seguin', 'Universal City', 'Schertz', 'Cibolo'
]

# --- Data storage (for PKs) ---
user_ids = []
venue_ids = []
category_ids = []
event_ids = []
order_ids = []

# =================================================================
# SQL Formatting Function
# =================================================================
def dict_to_sql_inserts(table_name, data):
    if not data:
        return f"-- No data generated for {table_name}\n"
    columns = list(data[0].keys())
    sql_template = f"INSERT INTO `{table_name}` ({', '.join(f'`{col}`' for col in columns)}) VALUES\n"
    values_list = []
    for row in data:
        formatted_values = []
        for col in columns:
            value = row[col]
            if isinstance(value, (str, datetime)):
                formatted_values.append(f"'{str(value).replace('\'','\'\'')}'")
            elif value is None:
                formatted_values.append("NULL")
            else:
                formatted_values.append(str(value))
        values_list.append(f"    ({', '.join(formatted_values)})")
    return sql_template + ',\n'.join(values_list) + ';\n\n'

# =================================================================
# 1. USER TABLE
# =================================================================
user_data = []
roles = ['Organizer', 'Attendee', 'Admin']
statuses = ['Active', 'Suspended']

for i in range(1, NUM_USERS + 1):
    user_id = i
    user_ids.append(user_id)
    user_data.append({
        'user_id': user_id,
        'first_name': fake.first_name(),
        'last_name': fake.last_name(),
        'email': fake.unique.email(),
        'role': random.choice(roles),
        'status': random.choice(statuses)
    })

# =================================================================
# 2. VENUE TABLE
# =================================================================
venue_data = []
for i in range(1, NUM_VENUES + 1):
    venue_id = i + 100
    venue_ids.append(venue_id)
    local_city = random.choice(LOCAL_CITIES)
    venue_data.append({
        'venue_id': venue_id,
        'name': f"{local_city} {random.choice(['Community Center', 'Theater', 'Auditorium', 'Convention Hall', 'Park Pavilion'])}",
        'capacity': random.randint(50, 15000),
        'address': fake.street_address(),
        'city': local_city
    })

# =================================================================
# 3. CATEGORY TABLE
# =================================================================
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
# 4. EVENT TABLE
# =================================================================
def generate_description(title, category_name):
    base = f"Join us for {title}, an amazing event! "
    if 'Music' in category_name:
        return (base + fake.sentence(nb_words=10))[:200]
    elif 'Tech' in category_name:
        return (base + "Explore tech with leaders and demos.")[:200]
    elif 'Food' in category_name:
        return (base + "Taste the best local food.")[:200]
    elif 'Sport' in category_name:
        return (base + "Enjoy exciting sports activities.")[:200]
    elif 'Arts' in category_name or 'Theater' in category_name:
        return (base + "Experience live arts and performances.")[:200]
    elif 'Workshop' in category_name:
        return (base + "Learn new skills hands-on.")[:200]
    else:
        return (base + fake.sentence(nb_words=12))[:200]

event_data = []
event_statuses = ['Draft', 'Published', 'Completed', 'Canceled']
organizer_ids = [u['user_id'] for u in user_data if u['role'] == 'Organizer'] or user_ids

for i in range(1, NUM_EVENTS + 1):
    event_id = i + 1000
    event_ids.append(event_id)
    start_time = fake.date_time_between(start_date='-1y', end_date='+2y')
    end_time = start_time + timedelta(hours=random.randint(2, 8))
    venue_id = random.choice(venue_ids)
    venue_capacity = next(v['capacity'] for v in venue_data if v['venue_id'] == venue_id)
    category_id = random.choice(category_ids)
    category_name = next(c['name'] for c in category_data if c['category_id'] == category_id)
    event_data.append({
        'event_id': event_id,
        'organizer_id': random.choice(organizer_ids),
        'venue_id': venue_id,
        'title': fake.catch_phrase() + ' Festival',
        'description': generate_description(fake.catch_phrase(), category_name),
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': end_time.strftime('%Y-%m-%d %H:%M:%S'),
        'capacity': random.randint(50, int(venue_capacity*0.9)),
        'status': random.choice(event_statuses)
    })

# =================================================================
# 5. EVENT_CATEGORY TABLE
# =================================================================
event_category_data = []
seen = set()
for event in event_data:
    min_categories = 1 if event['status'] == 'Published' else 0
    num_categories = random.randint(min_categories, 2)
    for category_id in random.sample(category_ids, k=num_categories):
        key = (event['event_id'], category_id)
        if key not in seen:
            event_category_data.append({
                'event_id': event['event_id'],
                'category_id': category_id
            })
            seen.add(key)

# =================================================================
# 6. ORDERS TABLE
# =================================================================
order_data = []
order_statuses = ['Completed', 'Pending', 'Refunded']
attendee_ids = [u['user_id'] for u in user_data if u['role'] == 'Attendee'] or user_ids

for i in range(1, NUM_ORDERS + 1):
    order_id = i + 5000
    order_ids.append(order_id)
    order_data.append({
        'order_id': order_id,
        'user_id': random.choice(attendee_ids),
        'total_amount': round(random.uniform(20, 500), 2),
        'order_date': fake.date_time_between(start_date='-6m', end_date='now').strftime('%Y-%m-%d %H:%M:%S'),
        'status': random.choice(order_statuses)
    })

# =================================================================
# 7. TICKET TABLE
# =================================================================
ticket_data = []
ticket_statuses = ['Purchased', 'Reserved', 'Refunded']
ticket_counter = 1

for order in order_data:
    if order['status'] == 'Completed':
        num_tickets = random.randint(*TICKETS_PER_ORDER_RANGE)
        available_events = [e for e in event_data if e['status'] != 'Canceled']
        if not available_events:
            continue
        event_id = random.choice([e['event_id'] for e in available_events])
        price_per_ticket = round(order['total_amount']/num_tickets, 2)
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
# 8. GENERATE SQL
# =================================================================
sql_output = ""
sql_output += dict_to_sql_inserts("user", user_data)
sql_output += dict_to_sql_inserts("venue", venue_data)
sql_output += dict_to_sql_inserts("category", category_data)
sql_output += dict_to_sql_inserts("event", event_data)
sql_output += dict_to_sql_inserts("event_category", event_category_data)
sql_output += dict_to_sql_inserts("orders", order_data)
sql_output += dict_to_sql_inserts("ticket", ticket_data)

with open("dummy_data.sql", "w", encoding="utf-8") as f:
    f.write(sql_output)

print("✅ SQL data generated and saved to dummy_data.sql")
