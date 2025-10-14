-- =================================================================
-- SCHEMA.SQL
-- Database Schema for Eventify Local Event Ticketing System (MySQL)
-- =================================================================

-- 1. DATABASE SETUP
-- Create the database if it doesn't exist and switch to it.
CREATE DATABASE IF NOT EXISTS eventify_db;
USE eventify_db;

-- Set character set and collation for Unicode support
SET NAMES utf8mb4;

-- Disable foreign key checks temporarily for bulk table creation/dropping
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if they exist to allow for clean re-creation
DROP TABLE IF EXISTS ticket;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS event_category;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS event;
DROP TABLE IF EXISTS venue;
DROP TABLE IF EXISTS user;

-- =================================================================
-- 2. CORE TABLES (No FKs)
-- =================================================================

-- 2.1. USER Table (PK: user_id)
CREATE TABLE user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('Attendee', 'Organizer', 'Admin') NOT NULL 
        COMMENT 'Defines user type',
    status ENUM('Active', 'Suspended') NOT NULL 
        DEFAULT 'Active' COMMENT 'Indicates account status',
    -- Ensures 'role' integrity
    CONSTRAINT CHK_UserRole CHECK (role IN ('Attendee', 'Organizer', 'Admin'))
) ENGINE=InnoDB;

-- 2.2. VENUE Table (PK: venue_id)
CREATE TABLE venue (
    venue_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    -- capacity must be non-negative
    CONSTRAINT CHK_VenueCapacity CHECK (capacity >= 0),
    -- The name, address, and city combination should be unique
    UNIQUE KEY UQ_VenueLocation (name, address, city)
) ENGINE=InnoDB;

-- 2.3. CATEGORY Table (PK: category_id)
CREATE TABLE category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL 
        COMMENT 'Category name (e.g., Music, Workshop)',
    -- Ensures category name is unique
    CONSTRAINT UQ_CategoryName UNIQUE (name)
) ENGINE=InnoDB;

-- =================================================================
-- 3. INTERMEDIATE TABLES (Requires user and venue FKs)
-- =================================================================

-- 3.1. EVENT Table (PK: event_id)
CREATE TABLE event (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    organizer_id INT NOT NULL COMMENT 'FK to user (Organizer)',
    venue_id INT NOT NULL COMMENT 'FK to venue',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    capacity INT NOT NULL COMMENT 'Max number of tickets available',
    status ENUM('Draft', 'Published', 'Completed', 'Canceled') NOT NULL,

    -- Foreign Keys
    CONSTRAINT FK_EventOrganizer FOREIGN KEY (organizer_id) REFERENCES user(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_EventVenue FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE RESTRICT,

    -- Constraints
    CONSTRAINT CHK_EventTime CHECK (start_time < end_time),
    CONSTRAINT CHK_EventCapacity CHECK (capacity >= 0),
    -- Note: The check capacity <= venue.capacity is typically enforced by application logic or a trigger, not standard MySQL CHECK constraint.

    -- Status constraint
    CONSTRAINT CHK_EventStatus CHECK (status IN ('Draft', 'Published', 'Completed', 'Canceled'))
) ENGINE=InnoDB;

-- 3.2. EVENT_CATEGORY Table (Composite PK: event_id, category_id)
CREATE TABLE event_category (
    event_id INT NOT NULL,
    category_id INT NOT NULL,

    -- Primary Key: composite key ensures event-category pair is unique
    PRIMARY KEY (event_id, category_id), 

    -- Foreign Keys
    CONSTRAINT FK_ECCategoryID FOREIGN KEY (category_id) REFERENCES category(category_id) ON DELETE CASCADE,
    CONSTRAINT FK_ECEventID FOREIGN KEY (event_id) REFERENCES event(event_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =================================================================
-- 4. DEPENDENT TABLES (Requires event and user FKs)
-- =================================================================

-- 4.1. ORDERS Table (PK: order_id)
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'FK to user (Buyer)',
    total_amount DECIMAL(10, 2) NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status ENUM('Pending', 'Completed', 'Refunded') NOT NULL,

    -- Foreign Key
    CONSTRAINT FK_OrderUser FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT,

    -- Constraints
    CONSTRAINT CHK_OrderAmount CHECK (total_amount >= 0),
    CONSTRAINT CHK_OrderStatus CHECK (status IN ('Pending', 'Completed', 'Refunded'))
) ENGINE=InnoDB;

-- 4.2. TICKET Table (PK: ticket_id)
CREATE TABLE ticket (
    ticket_id VARCHAR(50) PRIMARY KEY COMMENT 'Unique string identifier for ticket',
    order_id INT NOT NULL COMMENT 'FK to orders',
    event_id INT NOT NULL COMMENT 'FK to event',
    user_id INT NOT NULL COMMENT 'FK to user (Owner/Attendee)',
    price DECIMAL(10, 2) NOT NULL,
    status ENUM('Reserved', 'Purchased', 'Refunded') NOT NULL,

    -- Foreign Keys
    CONSTRAINT FK_TicketOrder FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_TicketEvent FOREIGN KEY (event_id) REFERENCES event(event_id) ON DELETE RESTRICT,
    CONSTRAINT FK_TicketUser FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT,

    -- Constraints
    CONSTRAINT CHK_TicketPrice CHECK (price >= 0),
    CONSTRAINT CHK_TicketStatus CHECK (status IN ('Reserved', 'Purchased', 'Refunded'))
) ENGINE=InnoDB;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;