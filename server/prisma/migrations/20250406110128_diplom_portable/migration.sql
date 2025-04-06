BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[order_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [order_id] INT NOT NULL,
    [service_id] INT NOT NULL,
    [quantity] INT NOT NULL,
    [price] DECIMAL(10,2) NOT NULL,
    CONSTRAINT [PK__order_it__3213E83FEA75D3F2] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[order_statuses] (
    [id] INT NOT NULL IDENTITY(1,1),
    [status_name] NVARCHAR(50) NOT NULL,
    CONSTRAINT [PK__order_st__3213E83F3827EE0F] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__order_st__501B37534F868B8D] UNIQUE NONCLUSTERED ([status_name])
);

-- CreateTable
CREATE TABLE [dbo].[orders] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [status_id] INT NOT NULL,
    [total_price] DECIMAL(10,2) NOT NULL CONSTRAINT [DF__orders__total_pr__44FF419A] DEFAULT 0.00,
    [created_at] DATETIME2 CONSTRAINT [DF__orders__created___45F365D3] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 CONSTRAINT [DF__orders__updated___46E78A0C] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__orders__3213E83FA76F9DF0] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[payments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [order_id] INT NOT NULL,
    [payment_method] NVARCHAR(10) NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [payment_status] NVARCHAR(10) NOT NULL CONSTRAINT [DF__payments__paymen__52593CB8] DEFAULT 'pending',
    [created_at] DATETIME2 CONSTRAINT [DF__payments__create__534D60F1] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__payments__3213E83FE6D010EC] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[services] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(max),
    [price] DECIMAL(10,2) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [DF__services__create__3F466844] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__services__3213E83FC8246582] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__services__72E12F1B328B0CA6] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(50) NOT NULL,
    [email] NVARCHAR(100) NOT NULL,
    [password_hash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(10) NOT NULL CONSTRAINT [DF__users__role__3A81B327] DEFAULT 'customer',
    [created_at] DATETIME2 CONSTRAINT [DF__users__created_a__3B75D760] DEFAULT CURRENT_TIMESTAMP,
    [is_locked] BIT,
    [goodleId] VARCHAR(max),
    [name] NVARCHAR(max),
    [phone] VARCHAR(13),
    [adress] NVARCHAR(max),
    CONSTRAINT [PK__users__3213E83F330722C6] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__users__F3DBC5729B67007B] UNIQUE NONCLUSTERED ([username]),
    CONSTRAINT [UQ__users__AB6E6164CEB82026] UNIQUE NONCLUSTERED ([email])
);

-- AddForeignKey
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [FK_order_items_orders] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[order_items] ADD CONSTRAINT [FK_order_items_services] FOREIGN KEY ([service_id]) REFERENCES [dbo].[services]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orders] ADD CONSTRAINT [FK_orders_status] FOREIGN KEY ([status_id]) REFERENCES [dbo].[order_statuses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[orders] ADD CONSTRAINT [FK_orders_users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [FK_payments_orders] FOREIGN KEY ([order_id]) REFERENCES [dbo].[orders]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
