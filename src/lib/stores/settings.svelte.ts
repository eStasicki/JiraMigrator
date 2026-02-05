import { browser } from '$app/environment';
import { authFacade } from '$lib/auth/authFacade.svelte';

export interface JiraConfig {
	name: string;
	baseUrl: string;
	email: string;
	apiToken: string;
	tempoToken: string; // Token dla natywnego API Tempo Cloud (opcjonalny, ale zainicjowany jako pusty string)
}

export interface MigrationRule {
	id: string;
	sourceType: 'task' | 'label';
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
	createdAt: string;
}

export interface AppSettings {
	projects: Project[];
	activeProjectId: string | null;
	timeFormat: 'hm' | 'decimal';
}

const defaultSettings: AppSettings = {
	projects: [],
	activeProjectId: null,
	timeFormat: 'hm'
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
			tempoToken: ''
		},
		jiraY: {
			name: 'Jira Y',
			baseUrl: '',
			email: '',
			apiToken: '',
			tempoToken: ''
		},
		rules: [],
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
					// Ensure all projects have rules array
					parsed.projects = parsed.projects.map((p: Project) => {
						const proj = { ...p };
						if (!proj.rules) {
							proj.rules = [];
						}
						return proj;
					});
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

	async function saveToStorage() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}

		// Sync with Supabase if logged in
		if (authFacade.user) {
			// Ensure we send a plain object, stripping any Svelte proxies
			const plainSettings = JSON.parse(JSON.stringify(settings));
			await authFacade.updateProfile({ settings: plainSettings });
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

	// Sync from cloud (downstream) - updates local state only, does NOT push back to cloud
	function syncFromCloud(newSettings: AppSettings) {
		console.log('SettingsStore: Syncing from cloud (downstream update)', newSettings);
		settings = newSettings;
		// We still save to localStorage to persist the cloud state locally
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}
	}

	function setTimeFormat(format: 'hm' | 'decimal') {
		settings.timeFormat = format;
		saveToStorage();
	}

	return {
		get settings() {
			return settings;
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
		syncFromCloud
	};
}

export const settingsStore = createSettingsStore();
