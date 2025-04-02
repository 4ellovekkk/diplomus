use master
DECLARE @filename VARCHAR(255)
SELECT @FileName = SUBSTRING(path, 0, LEN(path)-CHARINDEX('\', REVERSE(path))+1)
FROM sys.traces   
WHERE is_default = 1;  

SELECT gt.HostName, 
       gt.ApplicationName, 
       gt.NTUserName, 
       gt.NTDomainName, 
       gt.LoginName, 
       gt.SPID, 
       gt.EventClass, 
       te.Name AS EventName,
       gt.EventSubClass,      
       gt.TEXTData, 
       gt.StartTime, 
       gt.EndTime, 
       gt.ObjectName, 
       gt.DatabaseName, 
       gt.FileName, 
       gt.IsSystem
FROM [fn_trace_gettable](@filename, DEFAULT) gt 
JOIN sys.trace_events te ON gt.EventClass = te.trace_event_id 
WHERE EventClass in (164) 
ORDER BY StartTime DESC;



use print_center
 DECLARE @login_name NVARCHAR(200)
   SELECT  @login_name = loginame
   FROM  sys.sysprocesses
   WHERE   spid = @@SPID