import os
import bcrypt

# Dev-only seeded non-admin account, for exercising role-checking middleware.
# Password comes from env so it's never hardcoded here; SEED_TEST_USER_PASSWORD
# documents the default in .env.example.
EMAIL = "attendee@eventify.dev"
PASSWORD = os.environ.get("SEED_TEST_USER_PASSWORD", "ChangeMe123!")
USER_ID = 998  # outside the 1-500 range used by dummy_data.sql, distinct from the admin (999)

password_hash = bcrypt.hashpw(PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

sql = f"""-- Dev-only seeded non-admin test account. Login password is set via
-- SEED_TEST_USER_PASSWORD (see .env.example); do not use in production.
INSERT INTO `user` (`user_id`, `first_name`, `last_name`, `email`, `role`, `status`, `password_hash`) VALUES
    ({USER_ID}, 'Test', 'Attendee', '{EMAIL}', 'Attendee', 'Active', '{password_hash}');
"""

output_path = "db/docker-init/01c-seed-test-user.sql"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(sql)

print(f"Wrote seeded test user ({EMAIL}) to {output_path}")
