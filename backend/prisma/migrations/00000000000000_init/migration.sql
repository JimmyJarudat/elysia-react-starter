BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [username] VARCHAR(100) NOT NULL,
    [email] VARCHAR(255) NOT NULL,
    [group_name] NCHAR(100),
    [password] VARCHAR(255) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [DF__users__is_active__70DDC3D8] DEFAULT 1,
    [is_email_verified] BIT NOT NULL CONSTRAINT [DF__users__is_email___71D1E811] DEFAULT 0,
    [email_verified_at] DATETIME,
    [failed_login_attempts] INT NOT NULL CONSTRAINT [DF__users__failed_lo__72C60C4A] DEFAULT 0,
    [locked_until] DATETIME,
    [last_login] DATETIME,
    [password_changed_at] DATETIME,
    [must_change_password] BIT NOT NULL CONSTRAINT [DF__users__must_chan__73BA3083] DEFAULT 0,
    [is_approved] BIT NOT NULL CONSTRAINT [DF__users__is_approv__74AE54BC] DEFAULT 0,
    [approved_by] INT,
    [approved_at] DATETIME,
    [creation_type] VARCHAR(50) NOT NULL CONSTRAINT [DF__users__creation___75A278F5] DEFAULT 'SELF_REGISTER',
    [last_password_reset_request_at] DATETIME,
    [password_reset_token] VARCHAR(255),
    [password_reset_code] VARCHAR(6),
    [password_reset_expiry] DATETIME,
    [last_terms_accepted] DATETIME,
    [terms_version] VARCHAR(20),
    [recovery_email] VARCHAR(255),
    [temporary_account] BIT NOT NULL CONSTRAINT [DF__users__temporary__7B5B524B] DEFAULT 0,
    [account_expiry] DATETIME,
    [is_deleted] BIT NOT NULL CONSTRAINT [DF__users__is_delete__7C4F7684] DEFAULT 0,
    [deleted_at] DATETIME,
    [created_at] DATETIME NOT NULL CONSTRAINT [DF__users__created_a__76969D2E] DEFAULT CURRENT_TIMESTAMP,
    [create_by] NCHAR(20),
    [updated_at] DATETIME NOT NULL CONSTRAINT [DF__users__updated_a__778AC167] DEFAULT CURRENT_TIMESTAMP,
    [update_by] NCHAR(20),
    [remarks] NVARCHAR(1000),
    [metadata] NVARCHAR(4000),
    [language] VARCHAR(10) NOT NULL CONSTRAINT [users_language_df] DEFAULT 'EN',
    CONSTRAINT [PK__users__3213E83F7DE6DB08] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__users__F3DBC572C270D0BA] UNIQUE NONCLUSTERED ([username]),
    CONSTRAINT [UQ__users__AB6E6164D7D9F4FE] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[profile] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [first_name] NVARCHAR(100),
    [last_name] NVARCHAR(100),
    [display_name] NVARCHAR(100),
    [avatar_url] NVARCHAR(255),
    [phone_number] VARCHAR(20),
    [department] VARCHAR(255),
    [address] NVARCHAR(255),
    [city] NVARCHAR(100),
    [state] NVARCHAR(100),
    [postal_code] VARCHAR(20),
    [country] VARCHAR(2),
    [date_of_birth] DATE,
    [gender] VARCHAR(1),
    [bio] NVARCHAR(1000),
    [website] VARCHAR(255),
    [created_at] DATETIME NOT NULL CONSTRAINT [profile_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [profile_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    [sub_district] VARCHAR(255),
    CONSTRAINT [profile_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [profile_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[user_roles] (
    [user_id] INT NOT NULL,
    [role_id] VARCHAR(50) NOT NULL,
    [assigned_by_id] INT,
    [remark] NVARCHAR(50),
    [assigned_at] DATETIME NOT NULL CONSTRAINT [user_roles_assigned_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_at] DATETIME NOT NULL CONSTRAINT [user_roles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [user_roles_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [user_roles_pkey] PRIMARY KEY CLUSTERED ([user_id],[role_id])
);

-- CreateTable
CREATE TABLE [dbo].[two_factor_auth] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [method] VARCHAR(20) NOT NULL,
    [secret] VARCHAR(255),
    [is_enabled] BIT NOT NULL CONSTRAINT [DF__two_facto__is_en__66603565] DEFAULT 0,
    [created_at] DATETIME NOT NULL CONSTRAINT [DF__two_facto__creat__6754599E] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [DF__two_facto__updat__68487DD7] DEFAULT CURRENT_TIMESTAMP,
    [backup_codes] NVARCHAR(1000),
    [backup_codes_used] NVARCHAR(1000),
    [recovery_method] VARCHAR(50),
    [last_verified_at] DATETIME,
    [verification_attempts] INT NOT NULL CONSTRAINT [DF__two_facto__verif__693CA210] DEFAULT 0,
    [phone_number] VARCHAR(20),
    [email_address] VARCHAR(255),
    [device_name] VARCHAR(100),
    [tfaSessionToken] NVARCHAR(255),
    CONSTRAINT [two_factor_auth_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__two_fact__B9BE370ED1174DE4] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[password_history] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [password_hash] VARCHAR(255) NOT NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [DF__password___creat__440B1D61] DEFAULT CURRENT_TIMESTAMP,
    [changed_by_user_id] INT,
    [change_reason] VARCHAR(100),
    [ip_address] VARCHAR(50),
    [user_agent] VARCHAR(255),
    CONSTRAINT [password_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[auth_history] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT,
    [username] VARCHAR(100) NOT NULL,
    [auth_type] VARCHAR(20) NOT NULL,
    [auth_status] VARCHAR(20) NOT NULL,
    [failure_reason] VARCHAR(100),
    [ip_address] VARCHAR(45),
    [user_agent] VARCHAR(255),
    [device_info] VARCHAR(255),
    [browser] VARCHAR(100),
    [os] VARCHAR(100),
    [location] VARCHAR(255),
    [auth_source] VARCHAR(50),
    [session_id] INT,
    [two_factor_used] BIT NOT NULL CONSTRAINT [auth_history_two_factor_used_df] DEFAULT 0,
    [remember_me] BIT NOT NULL CONSTRAINT [auth_history_remember_me_df] DEFAULT 0,
    [logout_time] DATETIME,
    [session_duration] INT,
    [additional_data] NVARCHAR(1000),
    [created_at] DATETIME NOT NULL CONSTRAINT [auth_history_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auth_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[session] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [access_token] NVARCHAR(512) NOT NULL,
    [refresh_token] NVARCHAR(512),
    [ip_address] NVARCHAR(45),
    [user_agent] NVARCHAR(255),
    [device_info] NVARCHAR(255),
    [location] NVARCHAR(4000),
    [login_source] NVARCHAR(50),
    [session_type] NVARCHAR(50),
    [is_active] BIT CONSTRAINT [DF__Session__is_acti__5812160E] DEFAULT 1,
    [revocation_reason] NVARCHAR(255),
    [created_at] DATETIME CONSTRAINT [DF__Session__created__59063A47] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME,
    [expires_at] DATETIME NOT NULL,
    [last_used_at] DATETIME,
    CONSTRAINT [session_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[session_history] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [access_token] NVARCHAR(512) NOT NULL,
    [refresh_token] NVARCHAR(512),
    [ip_address] NVARCHAR(45),
    [user_agent] NVARCHAR(255),
    [device_info] NVARCHAR(255),
    [location] NVARCHAR(4000),
    [login_source] NVARCHAR(50),
    [session_type] NVARCHAR(50),
    [is_active] BIT CONSTRAINT [DF__SessionHi__is_ac__5AEE82B9] DEFAULT 1,
    [status] NVARCHAR(50) NOT NULL,
    [revocation_reason] NVARCHAR(255),
    [created_at] DATETIME,
    [expired_at] DATETIME,
    [last_used_at] DATETIME,
    [moved_to_history_at] DATETIME CONSTRAINT [DF__SessionHi__moved__5BE2A6F2] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [session_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[roles] (
    [id] VARCHAR(50) NOT NULL,
    [name] VARCHAR(100) NOT NULL,
    [priority] INT CONSTRAINT [DF_roles_priority] DEFAULT 0,
    [description] VARCHAR(255),
    [created_at] DATETIME NOT NULL CONSTRAINT [roles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [roles_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [roles_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[role_hierarchy] (
    [parent_role_id] VARCHAR(50) NOT NULL,
    [child_role_id] VARCHAR(50) NOT NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [role_hierarchy_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [role_hierarchy_pkey] PRIMARY KEY CLUSTERED ([parent_role_id],[child_role_id])
);

-- CreateTable
CREATE TABLE [dbo].[role_permissions] (
    [role_id] VARCHAR(50) NOT NULL,
    [permission_id] VARCHAR(50) NOT NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [role_permissions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [role_permissions_pkey] PRIMARY KEY CLUSTERED ([role_id],[permission_id])
);

-- CreateTable
CREATE TABLE [dbo].[permissions] (
    [id] VARCHAR(50) NOT NULL,
    [name] VARCHAR(100) NOT NULL,
    [description] VARCHAR(255),
    [resource] VARCHAR(50) NOT NULL,
    [action] VARCHAR(50) NOT NULL,
    [created_at] DATETIME NOT NULL CONSTRAINT [permissions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [permissions_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [permissions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [permissions_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [UQ_permissions_resource_action] UNIQUE NONCLUSTERED ([resource],[action])
);

-- CreateTable
CREATE TABLE [dbo].[api_route_requirements] (
    [id] INT NOT NULL IDENTITY(1,1),
    [method] VARCHAR(10) NOT NULL,
    [path] NVARCHAR(255) NOT NULL,
    [role_id] VARCHAR(50),
    [permission_id] VARCHAR(50),
    [is_active] BIT NOT NULL CONSTRAINT [api_route_requirements_is_active_df] DEFAULT 1,
    [created_at] DATETIME NOT NULL CONSTRAINT [api_route_requirements_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [api_route_requirements_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [api_route_requirements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_api_route_requirements_method_path] UNIQUE NONCLUSTERED ([method],[path])
);

-- CreateTable
CREATE TABLE [dbo].[notifications] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT,
    [title] NVARCHAR(255) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [type] VARCHAR(20) NOT NULL,
    [priority] VARCHAR(10) NOT NULL CONSTRAINT [notifications_priority_df] DEFAULT 'NORMAL',
    [is_read] BIT NOT NULL CONSTRAINT [notifications_is_read_df] DEFAULT 0,
    [created_at] DATETIME NOT NULL CONSTRAINT [notifications_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notifications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification_archives] (
    [id] INT NOT NULL IDENTITY(1,1),
    [original_id] INT NOT NULL,
    [user_id] INT,
    [title] NVARCHAR(255) NOT NULL,
    [message] NVARCHAR(1000) NOT NULL,
    [type] VARCHAR(20) NOT NULL,
    [priority] VARCHAR(10) NOT NULL,
    [is_read] BIT NOT NULL,
    [original_created_at] DATETIME NOT NULL,
    [read_at] DATETIME,
    [archived_at] DATETIME NOT NULL CONSTRAINT [notification_archives_archived_at_df] DEFAULT CURRENT_TIMESTAMP,
    [archived_reason] VARCHAR(50) NOT NULL CONSTRAINT [notification_archives_archived_reason_df] DEFAULT 'AUTO_CLEANUP',
    CONSTRAINT [notification_archives_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[notification_settings] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [login_notifications] BIT NOT NULL CONSTRAINT [notification_settings_login_notifications_df] DEFAULT 1,
    [security_notifications] BIT NOT NULL CONSTRAINT [notification_settings_security_notifications_df] DEFAULT 1,
    [system_notifications] BIT NOT NULL CONSTRAINT [notification_settings_system_notifications_df] DEFAULT 0,
    [email_notifications] BIT NOT NULL CONSTRAINT [notification_settings_email_notifications_df] DEFAULT 1,
    [sound_notifications] BIT NOT NULL CONSTRAINT [notification_settings_sound_notifications_df] DEFAULT 1,
    [created_at] DATETIME NOT NULL CONSTRAINT [notification_settings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [notification_settings_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [notification_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_settings_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[request_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [request_logs_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [method] NVARCHAR(1000) NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [path] NVARCHAR(1000) NOT NULL,
    [query_params] NVARCHAR(1000),
    [user_id] INT,
    [username] NVARCHAR(1000),
    [ip_address] NVARCHAR(1000) NOT NULL,
    [user_agent] NVARCHAR(1000),
    [browser] NVARCHAR(1000),
    [os] NVARCHAR(1000),
    [device_type] NVARCHAR(1000),
    [platform] NVARCHAR(1000),
    [status_code] INT,
    [response_time] INT,
    [request_size] INT,
    [error_message] NVARCHAR(1000),
    [error_stack] NVARCHAR(1000),
    [referer] NVARCHAR(1000),
    [session_id] NVARCHAR(1000),
    CONSTRAINT [request_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[menu_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [path] NVARCHAR(255) NOT NULL,
    [label] NVARCHAR(100) NOT NULL,
    [icon_name] NVARCHAR(50) NOT NULL,
    [icon_library] NVARCHAR(20) CONSTRAINT [DF__menu_item__icon___322C6448] DEFAULT 'react-icons',
    [code] VARCHAR(100),
    [permission_id] VARCHAR(50),
    [parent_id] INT,
    [sort_order] INT CONSTRAINT [DF__menu_item__sort___33208881] DEFAULT 0,
    [is_active] BIT CONSTRAINT [DF__menu_item__is_ac__3414ACBA] DEFAULT 1,
    [created_at] DATETIME2 CONSTRAINT [DF__menu_item__creat__3508D0F3] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 CONSTRAINT [DF__menu_item__updat__35FCF52C] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__menu_ite__3213E83F68DF3A80] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_config] (
    [id] VARCHAR(50) NOT NULL,
    [value] NVARCHAR(4000) NOT NULL,
    [description] NVARCHAR(4000),
    [created_at] DATETIME NOT NULL CONSTRAINT [DF__security___creat__47DBAE45] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME NOT NULL CONSTRAINT [DF__security___updat__48CFD27E] DEFAULT CURRENT_TIMESTAMP,
    [category] VARCHAR(50) NOT NULL CONSTRAINT [DF__security___categ__49C3F6B7] DEFAULT 'GENERAL',
    [is_active] BIT NOT NULL CONSTRAINT [DF__security___is_ac__4AB81AF0] DEFAULT 1,
    [is_encrypted] BIT NOT NULL CONSTRAINT [DF__security___is_en__4BAC3F29] DEFAULT 0,
    [last_modified_by_id] INT,
    [display_name] VARCHAR(100),
    [data_type] VARCHAR(20) NOT NULL CONSTRAINT [DF__security___data___4CA06362] DEFAULT 'STRING',
    CONSTRAINT [PK__security__3213E83F4391DBE6] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[cron_run_history] (
    [id] INT NOT NULL IDENTITY(1,1),
    [job_name] VARCHAR(100) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [started_at] DATETIME NOT NULL CONSTRAINT [cron_run_history_started_at_df] DEFAULT CURRENT_TIMESTAMP,
    [finished_at] DATETIME,
    [duration_ms] INT,
    [archived_count] INT NOT NULL CONSTRAINT [cron_run_history_archived_count_df] DEFAULT 0,
    [deleted_count] INT NOT NULL CONSTRAINT [cron_run_history_deleted_count_df] DEFAULT 0,
    [error_message] NVARCHAR(4000),
    [config_snapshot] NVARCHAR(4000),
    CONSTRAINT [cron_run_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[personal_access_tokens] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [token_hash] VARCHAR(64) NOT NULL,
    [token_prefix] VARCHAR(20) NOT NULL,
    [expires_at] DATETIME,
    [last_used_at] DATETIME,
    [revoked_at] DATETIME,
    [created_at] DATETIME NOT NULL CONSTRAINT [personal_access_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [personal_access_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [personal_access_tokens_token_hash_key] UNIQUE NONCLUSTERED ([token_hash])
);

-- CreateTable
CREATE TABLE [dbo].[ip_blocklist] (
    [id] INT NOT NULL IDENTITY(1,1),
    [ip_address] NVARCHAR(45) NOT NULL,
    [reason] NVARCHAR(255),
    [created_at] DATETIME NOT NULL CONSTRAINT [ip_blocklist_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ip_blocklist_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ip_blocklist_ip_address_key] UNIQUE NONCLUSTERED ([ip_address])
);

-- CreateTable
CREATE TABLE [dbo].[activity_logs] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [timestamp] DATETIME NOT NULL CONSTRAINT [activity_logs_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [user_id] INT,
    [username] VARCHAR(100),
    [action] VARCHAR(50) NOT NULL,
    [resource_type] VARCHAR(100) NOT NULL,
    [resource_id] VARCHAR(100),
    [description] NVARCHAR(1000),
    [ip_address] VARCHAR(45),
    [user_agent] NVARCHAR(255),
    [status] VARCHAR(20) NOT NULL CONSTRAINT [activity_logs_status_df] DEFAULT 'success',
    [metadata] NVARCHAR(4000),
    CONSTRAINT [activity_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [timestamp] DATETIME NOT NULL CONSTRAINT [audit_logs_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [user_id] INT,
    [username] VARCHAR(100),
    [action] VARCHAR(50) NOT NULL,
    [table_name] VARCHAR(100) NOT NULL,
    [record_id] VARCHAR(100) NOT NULL,
    [before_data] NVARCHAR(max),
    [after_data] NVARCHAR(max),
    [changed_fields] NVARCHAR(1000),
    [ip_address] VARCHAR(45),
    [request_id] VARCHAR(100),
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[error_logs] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [timestamp] DATETIME NOT NULL CONSTRAINT [error_logs_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [level] VARCHAR(20) NOT NULL CONSTRAINT [error_logs_level_df] DEFAULT 'error',
    [message] NVARCHAR(2000) NOT NULL,
    [stack_trace] NVARCHAR(max),
    [source] VARCHAR(100),
    [code] VARCHAR(50),
    [user_id] INT,
    [username] VARCHAR(100),
    [request_path] VARCHAR(500),
    [request_method] VARCHAR(10),
    [ip_address] VARCHAR(45),
    [context] NVARCHAR(4000),
    [resolved] BIT NOT NULL CONSTRAINT [error_logs_resolved_df] DEFAULT 0,
    [resolved_at] DATETIME,
    CONSTRAINT [error_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_events] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [timestamp] DATETIME NOT NULL CONSTRAINT [system_events_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [event_type] VARCHAR(50) NOT NULL,
    [event_name] VARCHAR(100) NOT NULL,
    [status] VARCHAR(20) NOT NULL,
    [duration_ms] INT,
    [message] NVARCHAR(1000),
    [details] NVARCHAR(4000),
    [triggered_by] VARCHAR(100),
    CONSTRAINT [system_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_users_created_at] ON [dbo].[users]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_users_email_username] ON [dbo].[users]([email], [username]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_users_is_active_is_email_verified] ON [dbo].[users]([is_active], [is_email_verified]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_users_is_deleted_is_active] ON [dbo].[users]([is_deleted], [is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_profile_user_id] ON [dbo].[profile]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_user_roles_assigned_by_id] ON [dbo].[user_roles]([assigned_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_user_roles_role_id] ON [dbo].[user_roles]([role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_user_roles_user_id] ON [dbo].[user_roles]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_password_history_user_id_created_at] ON [dbo].[password_history]([user_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_auth_history_user_created] ON [dbo].[auth_history]([user_id], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_auth_history_type_status_created] ON [dbo].[auth_history]([auth_type], [auth_status], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_auth_history_ip] ON [dbo].[auth_history]([ip_address]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_auth_history_username_status] ON [dbo].[auth_history]([username], [auth_status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_auth_history_created] ON [dbo].[auth_history]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Session_AccessToken] ON [dbo].[session]([access_token]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Session_IsActive] ON [dbo].[session]([is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_Session_User] ON [dbo].[session]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SessionHistory_ExpiredAt] ON [dbo].[session_history]([expired_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SessionHistory_MovedAt] ON [dbo].[session_history]([moved_to_history_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SessionHistory_Status] ON [dbo].[session_history]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IDX_SessionHistory_User] ON [dbo].[session_history]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_role_hierarchy_child_role_id] ON [dbo].[role_hierarchy]([child_role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_role_hierarchy_parent_role_id] ON [dbo].[role_hierarchy]([parent_role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_role_permissions_permission_id] ON [dbo].[role_permissions]([permission_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_role_permissions_role_id] ON [dbo].[role_permissions]([role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_permissions_resource_action] ON [dbo].[permissions]([resource], [action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_api_route_requirements_permission_id] ON [dbo].[api_route_requirements]([permission_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_api_route_requirements_role_id] ON [dbo].[api_route_requirements]([role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_api_route_requirements_lookup] ON [dbo].[api_route_requirements]([method], [path], [is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notifications_user_id_is_read_created_at_idx] ON [dbo].[notifications]([user_id], [is_read], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_archives_user_id_original_created_at_idx] ON [dbo].[notification_archives]([user_id], [original_created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_archives_archived_at_idx] ON [dbo].[notification_archives]([archived_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_archives_original_id_idx] ON [dbo].[notification_archives]([original_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_archives_type_archived_at_idx] ON [dbo].[notification_archives]([type], [archived_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_timestamp_idx] ON [dbo].[request_logs]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_user_id_idx] ON [dbo].[request_logs]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_path_idx] ON [dbo].[request_logs]([path]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_status_code_idx] ON [dbo].[request_logs]([status_code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_ip_address_idx] ON [dbo].[request_logs]([ip_address]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [request_logs_method_idx] ON [dbo].[request_logs]([method]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_menu_items_code] ON [dbo].[menu_items]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_menu_items_permission_id] ON [dbo].[menu_items]([permission_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_menu_items_parent_sort] ON [dbo].[menu_items]([parent_id], [sort_order]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_system_config_category_is_active] ON [dbo].[system_config]([category], [is_active]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_cron_run_history_job_started] ON [dbo].[cron_run_history]([job_name], [started_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_cron_run_history_status_started] ON [dbo].[cron_run_history]([status], [started_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_pat_token_hash] ON [dbo].[personal_access_tokens]([token_hash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_pat_user_id] ON [dbo].[personal_access_tokens]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ip_blocklist_ip] ON [dbo].[ip_blocklist]([ip_address]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_timestamp_idx] ON [dbo].[activity_logs]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_user_id_timestamp_idx] ON [dbo].[activity_logs]([user_id], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_resource_type_resource_id_idx] ON [dbo].[activity_logs]([resource_type], [resource_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [activity_logs_action_status_idx] ON [dbo].[activity_logs]([action], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_timestamp_idx] ON [dbo].[audit_logs]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_user_id_timestamp_idx] ON [dbo].[audit_logs]([user_id], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_table_name_record_id_idx] ON [dbo].[audit_logs]([table_name], [record_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_action_timestamp_idx] ON [dbo].[audit_logs]([action], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [error_logs_timestamp_idx] ON [dbo].[error_logs]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [error_logs_level_timestamp_idx] ON [dbo].[error_logs]([level], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [error_logs_resolved_timestamp_idx] ON [dbo].[error_logs]([resolved], [timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [error_logs_source_idx] ON [dbo].[error_logs]([source]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_events_timestamp_idx] ON [dbo].[system_events]([timestamp]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_events_event_type_status_idx] ON [dbo].[system_events]([event_type], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [system_events_event_name_timestamp_idx] ON [dbo].[system_events]([event_name], [timestamp]);

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [FK_users_approved_by] FOREIGN KEY ([approved_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[profile] ADD CONSTRAINT [profile_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_assigned_by_id_fkey] FOREIGN KEY ([assigned_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [user_roles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[two_factor_auth] ADD CONSTRAINT [FK_two_factor_auth_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[password_history] ADD CONSTRAINT [FK_password_history_changed_by] FOREIGN KEY ([changed_by_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[password_history] ADD CONSTRAINT [FK_password_history_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[auth_history] ADD CONSTRAINT [auth_history_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[session] ADD CONSTRAINT [session_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[session_history] ADD CONSTRAINT [session_history_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[role_hierarchy] ADD CONSTRAINT [role_hierarchy_child_role_id_fkey] FOREIGN KEY ([child_role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[role_hierarchy] ADD CONSTRAINT [role_hierarchy_parent_role_id_fkey] FOREIGN KEY ([parent_role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_permission_id_fkey] FOREIGN KEY ([permission_id]) REFERENCES [dbo].[permissions]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[role_permissions] ADD CONSTRAINT [role_permissions_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[api_route_requirements] ADD CONSTRAINT [api_route_requirements_permission_id_fkey] FOREIGN KEY ([permission_id]) REFERENCES [dbo].[permissions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[api_route_requirements] ADD CONSTRAINT [api_route_requirements_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [notifications_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[notification_archives] ADD CONSTRAINT [notification_archives_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[notification_settings] ADD CONSTRAINT [notification_settings_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[request_logs] ADD CONSTRAINT [request_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[menu_items] ADD CONSTRAINT [FK__menu_item__paren__36F11965] FOREIGN KEY ([parent_id]) REFERENCES [dbo].[menu_items]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[menu_items] ADD CONSTRAINT [FK_menu_items_permission] FOREIGN KEY ([permission_id]) REFERENCES [dbo].[permissions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_config] ADD CONSTRAINT [FK_system_config_modified_by] FOREIGN KEY ([last_modified_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[personal_access_tokens] ADD CONSTRAINT [personal_access_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[activity_logs] ADD CONSTRAINT [activity_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[audit_logs] ADD CONSTRAINT [audit_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[error_logs] ADD CONSTRAINT [error_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
