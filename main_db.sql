-- Create Database
IF NOT EXISTS (SELECT name
               FROM sys.databases
               WHERE name = 'print_center')
    BEGIN
        CREATE DATABASE print_center;
    END;
GO

USE print_center;
GO

-- Users table
CREATE TABLE users
(
    id            INT IDENTITY (1,1) PRIMARY KEY,
    username      NVARCHAR(50)                                                   NOT NULL UNIQUE,
    email         NVARCHAR(100)                                                  NOT NULL UNIQUE,
    password_hash NVARCHAR(255)                                                  NOT NULL,
    role          NVARCHAR(10) CHECK (role IN ('customer', 'admin', 'employee')) NOT NULL DEFAULT 'customer',
    created_at    DATETIME2                                                               DEFAULT GETDATE()
);
GO

-- Services table
CREATE TABLE services
(
    id          INT IDENTITY (1,1) PRIMARY KEY,
    name        NVARCHAR(100)  NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    price       DECIMAL(10, 2) NOT NULL,
    created_at  DATETIME2 DEFAULT GETDATE()
);
GO

-- Order Status table
CREATE TABLE order_statuses
(
    id          INT IDENTITY (1,1) PRIMARY KEY,
    status_name NVARCHAR(50) NOT NULL UNIQUE
);
GO

-- Orders table
CREATE TABLE orders
(
    id          INT IDENTITY (1,1) PRIMARY KEY,
    user_id     INT            NOT NULL,
    status_id   INT            NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at  DATETIME2               DEFAULT GETDATE(),
    updated_at  DATETIME2               DEFAULT GETDATE(),
    CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT FK_orders_status FOREIGN KEY (status_id) REFERENCES order_statuses (id) ON DELETE NO ACTION
);
GO

-- Order Items table
CREATE TABLE order_items
(
    id         INT IDENTITY (1,1) PRIMARY KEY,
    order_id   INT            NOT NULL,
    service_id INT            NOT NULL,
    quantity   INT            NOT NULL CHECK (quantity > 0),
    price      DECIMAL(10, 2) NOT NULL,
    CONSTRAINT FK_order_items_orders FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT FK_order_items_services FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE NO ACTION
);
GO

-- Payments table
CREATE TABLE payments
(
    id             INT IDENTITY (1,1) PRIMARY KEY,
    order_id       INT                                                                       NOT NULL,
    payment_method NVARCHAR(10) CHECK (payment_method IN ('cash', 'card', 'online'))         NOT NULL,
    amount         DECIMAL(10, 2)                                                            NOT NULL,
    payment_status NVARCHAR(10) CHECK (payment_status IN ('pending', 'completed', 'failed')) NOT NULL DEFAULT 'pending',
    created_at     DATETIME2                                                                          DEFAULT GETDATE(),
    CONSTRAINT FK_payments_orders FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);
GO

-- Insert default order statuses
INSERT INTO order_statuses (status_name)
VALUES ('Pending'),
       ('Processing'),
       ('Completed'),
       ('Cancelled');
GO

alter table users add goodleId varchar(max)
alter table users add is_locked bit;

alter table users drop column goodleId