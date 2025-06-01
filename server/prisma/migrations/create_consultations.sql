-- Check if table exists and create if it doesn't
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[consultations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[consultations] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [fullName] NVARCHAR(255) NOT NULL,
        [email] NVARCHAR(255) NOT NULL,
        [service] NVARCHAR(100) NOT NULL,
        [description] NVARCHAR(MAX) NOT NULL,
        [urgent] BIT NOT NULL DEFAULT 0,
        [referenceFile] NVARCHAR(255) NULL,
        [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [updatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    -- Create index on email for faster lookups
    CREATE INDEX [IX_consultations_email] ON [dbo].[consultations]([email]);

    -- Create trigger to automatically update updatedAt
    EXEC('CREATE TRIGGER [TR_consultations_UpdatedAt] ON [dbo].[consultations]
    AFTER UPDATE AS 
    BEGIN
        SET NOCOUNT ON;
        IF NOT UPDATE([updatedAt])
        BEGIN
            UPDATE [dbo].[consultations]
            SET [updatedAt] = GETDATE()
            FROM [dbo].[consultations] t
            INNER JOIN inserted i ON t.id = i.id;
        END
    END');

    PRINT 'Consultations table created successfully';
END
ELSE
BEGIN
    PRINT 'Consultations table already exists';
END 