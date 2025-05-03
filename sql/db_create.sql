use print_center
create table Changelog
(
    id        int identity (1,1),
    userId    int foreign key references users (id),
    field     nvarchar(max),
    oldValue  nvarchar(max),
    newValue  nvarchar(max),
    changedAt datetime default sysdatetime(),
    changedBy int foreign key references users (id)
)