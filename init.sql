-- Create Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'print_center')
BEGIN
    CREATE DATABASE print_center;
END
GO

USE print_center;
GO

-- Create Users Table
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(10) DEFAULT 'customer',
    created_at DATETIME DEFAULT GETDATE(),
    is_locked BIT,
    goodleId VARCHAR(MAX),
    name NVARCHAR(MAX),
    phone VARCHAR(13),
    adress NVARCHAR(MAX)
);
GO

-- Create Order Statuses Table
CREATE TABLE order_statuses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    status_name NVARCHAR(50) UNIQUE NOT NULL
);
GO

-- Create Orders Table
CREATE TABLE orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    status_id INT NOT NULL,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES order_statuses(id)
);
GO

-- Create Services Table
CREATE TABLE services (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(MAX),
    price DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- Create Order Items Table
CREATE TABLE order_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL,
    service_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
);
GO

-- Create Payments Table
CREATE TABLE payments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method NVARCHAR(10) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status NVARCHAR(10) DEFAULT 'pending',
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
GO

-- Insert Initial Order Statuses
use print_center;
INSERT INTO order_statuses (status_name) VALUES ('Pending'), ('Completed'), ('Cancelled');
GO
INSERT INTO users (username, email, password_hash, role) 
VALUES ('lexa', 'lexa@lexa', '$2b$10$JzHnCqs5tnycp17R/M19FuzBToeB34LQXwVZcK6m0pnWYEkG2MB3m', 'admin');
GO
