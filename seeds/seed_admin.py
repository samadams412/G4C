import os
import bcrypt

# Dev-only seeded admin account. Password comes from env so it's never
# hardcoded here; SEED_ADMIN_PASSWORD documents the default in .env.example.
EMAIL = "admin@eventify.dev"
PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
USER_ID = 999  # outside the 1-500 range used by dummy_data.sql

password_hash = bcrypt.hashpw(PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

sql = f"""-- Dev-only seeded admin account. Login password is set via
-- SEED_ADMIN_PASSWORD (see .env.example); do not use in production.
INSERT INTO `user` (`user_id`, `first_name`, `last_name`, `email`, `role`, `status`, `password_hash`) VALUES
    ({USER_ID}, 'Admin', 'User', '{EMAIL}', 'Admin', 'Active', '{password_hash}');
"""

output_path = "db/docker-init/01b-seed-admin.sql"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(sql)

print(f"Wrote seeded admin ({EMAIL}) to {output_path}")
