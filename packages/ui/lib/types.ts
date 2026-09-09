export enum SetupActionIntents {
	CREATE_PROJECT = "create-project",
	INSTALL_APP = "install-app",
}

export enum SetupActionErrors {
	INSTALLATION_NOT_FOUND = "installation_not_found",
	INSTALLATION_SUSPENDED = "installation_suspended",
	REPO_NOT_FOUND = "repo_not_found",
}

export const SetupActionErrorMessages: Record<SetupActionErrors, string> = {
	[SetupActionErrors.INSTALLATION_NOT_FOUND]:
		"Could not find the GitHub installation for this repository.",
	[SetupActionErrors.INSTALLATION_SUSPENDED]:
		"The GitHub installation has been deleted or suspended.",
	[SetupActionErrors.REPO_NOT_FOUND]: "Could not find the selected repository.",
}

export enum DashboardActionIntents {
	LOGOUT = "logout",
}

export enum SettingsActionIntents {
	DELETE_ACCOUNT = "delete-account",
	DISCONNECT_PROJECT = "disconnect-project",
	// Refreshing a Config is a settings action; it wore a toolbar icon in the
	// dashboard header until the Project settings page had somewhere to put it.
	REFRESH_CONFIGURATION = "refresh-configuration",
	REVOKE_SESSION = "revoke-session",
	UPDATE_PREFERENCE = "update-preference",
}

export enum EditorActionIntents {
	SAVE = "save",
	COMMIT = "commit",
	PUBLISH = "publish",
}
