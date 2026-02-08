import { browser } from '$app/environment';
import { authFacade } from '$lib/auth/authFacade.svelte';

export interface JiraConfig {
	name: string;
	baseUrl: string;
	email: string;
	apiToken: string;
	tempoToken: string; // Token for native Tempo Cloud API (optional, initialized as empty string)
	useProxy?: boolean; // Whether to use Vercel proxy or fetch directly from the browser
}

export interface MigrationRule {
	id: string;
	sourceType: 'task' | 'label' | 'type';
	sourceValue: string;
	targetTaskKey: string;
	targetTaskSummary?: string; // Optional: to display summary in the UI
}

export interface Project {
	id: string;
	name: string;
	jiraX: JiraConfig;
	jiraY: JiraConfig;
	rules: MigrationRule[];
	timeFormat: 'hm' | 'decimal'; // Moved from global settings
	createdAt: string;
}

export interface AppSettings {
	projects: Project[];
	activeProjectId: string | null;
}

const defaultSettings: AppSettings = {
	projects: [],
	activeProjectId: null
};

const STORAGE_KEY = 'jira-migrator-settings-v2';

function generateProjectId(): string {
	return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultProject(name: string): Project {
	return {
		id: generateProjectId(),
		name,
		jiraX: {
			name: 'Jira X',
			baseUrl: '',
			email: '',
			apiToken: '',
			tempoToken: '',
			useProxy: true
		},
		jiraY: {
			name: 'Jira Y',
			baseUrl: '',
			email: '',
			apiToken: '',
			tempoToken: '',
			useProxy: true
		},
		rules: [],
		timeFormat: 'hm',
		createdAt: new Date().toISOString()
	};
}

function createSettingsStore() {
	let settings = $state<AppSettings>(defaultSettings);

	// Load from localStorage on init
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (parsed.projects && Array.isArray(parsed.projects)) {
					// 1. Ensure all projects have rules array
					// 2. Migrate timeFormat from global to per-project if needed
					const globalTimeFormat = parsed.timeFormat || 'hm';

					parsed.projects = parsed.projects.map((p: Project) => {
						const proj = { ...p };
						if (!proj.rules) {
							proj.rules = [];
						}
						if (!proj.timeFormat) {
							proj.timeFormat = globalTimeFormat;
						}
						return proj;
					});

					// Remove global timeFormat from state
					delete parsed.timeFormat;

					settings = parsed;
				} else {
					settings = defaultSettings;
				}
			} catch {
				settings = defaultSettings;
			}
		}
	}

	function setSettings(newSettings: AppSettings) {
		settings = newSettings;
		saveToStorage();
	}

	// Helper to remove sensitive data before sending to the cloud
	function sanitizeSettingsForCloud(appSettings: AppSettings): AppSettings {
		// Deep clone to avoid mutating state
		const cleanSettings = JSON.parse(JSON.stringify(appSettings));

		cleanSettings.projects = cleanSettings.projects.map((p: Project) => ({
			...p,
			jiraX: { ...p.jiraX, apiToken: '', tempoToken: '' },
			jiraY: { ...p.jiraY, apiToken: '', tempoToken: '' }
		}));

		return cleanSettings;
	}

	async function saveToStorage() {
		if (browser) {
			// Save FULL settings (with tokens) to local storage
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}

		// Sync with Supabase if logged in
		if (authFacade.user) {
			// Send SANITIZED settings (without tokens) to cloud
			const cloudSettings = sanitizeSettingsForCloud(settings);
			await authFacade.updateProfile({ settings: cloudSettings });
		}
	}

	function addProject(name: string): Project {
		const newProject = createDefaultProject(name);
		settings.projects = [...settings.projects, newProject];

		if (settings.projects.length === 1) {
			// If this is the first project, make it active
			settings.activeProjectId = newProject.id;
		} else if (!settings.activeProjectId) {
			// Safety fallback
			settings.activeProjectId = newProject.id;
		}

		saveToStorage();
		return newProject;
	}

	function removeProject(projectId: string) {
		settings.projects = settings.projects.filter((p) => p.id !== projectId);

		if (settings.activeProjectId === projectId) {
			settings.activeProjectId = settings.projects.length > 0 ? settings.projects[0].id : null;
		}

		saveToStorage();
	}

	async function updateProject(
		projectId: string,
		updates: Partial<Omit<Project, 'id' | 'createdAt'>>
	) {
		const index = settings.projects.findIndex((p) => p.id === projectId);
		if (index !== -1) {
			settings.projects[index] = { ...settings.projects[index], ...updates };
			await saveToStorage();
		}
	}

	function setActiveProject(projectId: string) {
		if (settings.projects.some((p) => p.id === projectId)) {
			settings.activeProjectId = projectId;
			saveToStorage();
		}
	}

	function getActiveProject(): Project | null {
		if (!settings.activeProjectId) return null;
		// Handle case where active project might have been deleted
		const project = settings.projects.find((p) => p.id === settings.activeProjectId);
		if (!project && settings.projects.length > 0) {
			// Auto-fix consistency
			settings.activeProjectId = settings.projects[0].id;
			return settings.projects[0];
		}
		return project || null;
	}

	function isProjectConfigured(project: Project): boolean {
		return !!(
			project.jiraX.baseUrl &&
			project.jiraX.email &&
			project.jiraX.apiToken &&
			project.jiraY.baseUrl &&
			project.jiraY.email &&
			project.jiraY.apiToken
		);
	}

	function isActiveProjectConfigured(): boolean {
		const active = getActiveProject();
		if (!active) return false;
		return isProjectConfigured(active);
	}

	function reset() {
		settings = defaultSettings;
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
		if (authFacade.user) {
			authFacade.updateProfile({ settings: defaultSettings });
		}
	}

	// Helper to preserve local secrets when applying cloud updates
	function mergeSecrets(localSettings: AppSettings, cloudSettings: AppSettings): AppSettings {
		const merged = JSON.parse(JSON.stringify(cloudSettings));

		merged.projects = merged.projects.map((cloudProj: Project) => {
			// Find corresponding local project to grab secrets from
			const localProj = localSettings.projects.find((p) => p.id === cloudProj.id);

			if (localProj) {
				// Re-inject secrets if they are missing in cloud version (which they should be)
				if (!cloudProj.jiraX.apiToken) cloudProj.jiraX.apiToken = localProj.jiraX.apiToken;
				if (!cloudProj.jiraX.tempoToken) cloudProj.jiraX.tempoToken = localProj.jiraX.tempoToken;

				if (!cloudProj.jiraY.apiToken) cloudProj.jiraY.apiToken = localProj.jiraY.apiToken;
				if (!cloudProj.jiraY.tempoToken) cloudProj.jiraY.tempoToken = localProj.jiraY.tempoToken;
			}
			return cloudProj;
		});

		return merged;
	}

	// Sync from cloud (downstream) - updates local state only, does NOT push back to cloud
	function syncFromCloud(cloudSettings: AppSettings) {
		// If we have local settings, try to merge secrets to avoid wiping them
		const mergedSettings = mergeSecrets(settings, cloudSettings);

		settings = mergedSettings;

		// We still save to localStorage to persist the cloud state locally (with secrets)
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}
	}

	function setTimeFormat(format: 'hm' | 'decimal', projectId?: string) {
		const id = projectId || settings.activeProjectId;
		if (!id) return;

		const index = settings.projects.findIndex((p) => p.id === id);
		if (index !== -1) {
			settings.projects[index].timeFormat = format;
			saveToStorage();
		}
	}

	return {
		get settings() {
			return settings;
		},
		get timeFormat() {
			return getActiveProject()?.timeFormat || 'hm';
		},
		addProject,
		removeProject,
		updateProject,
		setActiveProject,
		getActiveProject,
		isProjectConfigured,
		isActiveProjectConfigured,
		setTimeFormat,
		reset,
		setSettings,
		syncFromCloud,
		sanitizeSettingsForCloud
	};
}

export const settingsStore = createSettingsStore();
