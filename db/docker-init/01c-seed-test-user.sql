-- Dev-only seeded non-admin test account. Login password is set via
-- SEED_TEST_USER_PASSWORD (see .env.example); do not use in production.
INSERT INTO `user` (`user_id`, `first_name`, `last_name`, `email`, `role`, `status`, `password_hash`) VALUES
    (998, 'Test', 'Attendee', 'attendee@eventify.dev', 'Attendee', 'Active', '$2b$12$ZPCWe6xPuO0qNda6TzrLeu6K8i9sxQ0/ewXUlsXIpUgC17u/bwBJK');
