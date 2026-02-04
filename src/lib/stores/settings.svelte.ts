import { browser } from '$app/environment';

export interface JiraConfig {
	name: string;
	baseUrl: string;
	email: string;
	apiToken: string;
	tempoToken: string; // Token dla natywnego API Tempo Cloud (opcjonalny, ale zainicjowany jako pusty string)
}

export interface Project {
	id: string;
	name: string;
	jiraX: JiraConfig;
	jiraY: JiraConfig;
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
			tempoToken: ''
		},
		jiraY: {
			name: 'Jira Y',
			baseUrl: '',
			email: '',
			apiToken: '',
			tempoToken: ''
		},
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
					settings = parsed;
				} else {
					settings = defaultSettings;
				}
			} catch {
				settings = defaultSettings;
			}
		}
	}

	function saveToStorage() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}
	}

	function addProject(name: string): Project {
		const newProject = createDefaultProject(name);
		settings.projects = [...settings.projects, newProject];

		if (settings.projects.length === 1) {
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

	function updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) {
		const project = settings.projects.find((p) => p.id === projectId);
		if (project) {
			Object.assign(project, updates);
			saveToStorage();
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
		return settings.projects.find((p) => p.id === settings.activeProjectId) || null;
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
		reset
	};
}

export const settingsStore = createSettingsStore();
