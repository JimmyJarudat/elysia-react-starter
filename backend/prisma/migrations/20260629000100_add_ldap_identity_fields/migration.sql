BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[users] ADD
    [auth_source] VARCHAR(20) NOT NULL CONSTRAINT [DF_users_auth_source] DEFAULT 'LOCAL',
    [external_id] NVARCHAR(255),
    [ldap_dn] NVARCHAR(500),
    [ldap_synced_at] DATETIME;

CREATE NONCLUSTERED INDEX [IX_users_auth_source_external_id] ON [dbo].[users]([auth_source], [external_id]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
