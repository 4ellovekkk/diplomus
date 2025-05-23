-- Create order statuses table if it doesn't exist
use print_center
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_statuses' AND xtype='U')
BEGIN
    CREATE TABLE order_statuses (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(50) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

    -- Insert default statuses
    INSERT INTO order_statuses (name) VALUES
        ('PENDING'),
        ('PROCESSING'),
        ('COMPLETED'),
        ('CANCELLED');
END

-- Create payments table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payments' AND xtype='U')
BEGIN
    CREATE TABLE payments (
        id INT PRIMARY KEY IDENTITY(1,1),
        payment_method NVARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_status NVARCHAR(50) NOT NULL,
        stripe_payment_id NVARCHAR(255),
        stripe_session_id NVARCHAR(255),
        currency NVARCHAR(10) NOT NULL,
        payment_details NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
END

-- Create orders table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
BEGIN
    CREATE TABLE orders (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL,
        payment_id INT,
        total_price DECIMAL(10,2) NOT NULL,
        status_id INT NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (status_id) REFERENCES order_statuses(id)
    );
END

-- Create order_items table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' AND xtype='U')
BEGIN
    CREATE TABLE order_items (
        id INT PRIMARY KEY IDENTITY(1,1),
        order_id INT NOT NULL,
        service_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        options NVARCHAR(MAX),
        subtotal DECIMAL(10,2) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
    );
END

-- Add indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_orders_user_id' AND object_id = OBJECT_ID('orders'))
BEGIN
    CREATE INDEX IX_orders_user_id ON orders(user_id);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_orders_payment_id' AND object_id = OBJECT_ID('orders'))
BEGIN
    CREATE INDEX IX_orders_payment_id ON orders(payment_id);
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_order_items_order_id' AND object_id = OBJECT_ID('order_items'))
BEGIN
    CREATE INDEX IX_order_items_order_id ON order_items(order_id);
END

-- Add triggers for updated_at timestamps
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_orders_update')
BEGIN
    EXEC('CREATE TRIGGER TR_orders_update ON orders AFTER UPDATE AS 
    BEGIN
        UPDATE orders
        SET updated_at = GETDATE()
        FROM orders
        INNER JOIN inserted ON orders.id = inserted.id
    END');
END

IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_payments_update')
BEGIN
    EXEC('CREATE TRIGGER TR_payments_update ON payments AFTER UPDATE AS 
    BEGIN
        UPDATE payments
        SET updated_at = GETDATE()
        FROM payments
        INNER JOIN inserted ON payments.id = inserted.id
    END');
END

IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_order_items_update')
BEGIN
    EXEC('CREATE TRIGGER TR_order_items_update ON order_items AFTER UPDATE AS 
    BEGIN
        UPDATE order_items
        SET updated_at = GETDATE()
        FROM order_items
        INNER JOIN inserted ON order_items.id = inserted.id
    END');
END 