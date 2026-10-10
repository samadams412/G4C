-- Dev-only seeded admin account. Login password is set via
-- SEED_ADMIN_PASSWORD (see .env.example); do not use in production.
INSERT INTO `user` (`user_id`, `first_name`, `last_name`, `email`, `role`, `status`, `password_hash`) VALUES
    (999, 'Admin', 'User', 'admin@eventify.dev', 'Admin', 'Active', '$2b$12$6glR8egXOqHeFQM.y//Wq.TkgCcCJ7.okASXzHvsFkBDDzA8xr8E2');
