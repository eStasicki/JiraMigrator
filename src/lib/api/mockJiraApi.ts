import type { WorklogEntry, ParentTask } from '$lib/stores/migration.svelte';

// Mock data for simulation
const mockIssuesX = [
	{ key: 'PROJ-101', summary: 'Implementacja logowania użytkowników' },
	{ key: 'PROJ-102', summary: 'Naprawa błędu w formularzu rejestracji' },
	{ key: 'PROJ-103', summary: 'Optymalizacja zapytań do bazy danych' },
	{ key: 'PROJ-104', summary: 'Spotkanie z zespołem klienta' },
	{ key: 'PROJ-105', summary: 'Daily standup i planning' },
	{ key: 'PROJ-106', summary: 'Refaktoryzacja komponentu nawigacji' },
	{ key: 'PROJ-107', summary: 'Code review PR #234' },
	{ key: 'PROJ-108', summary: 'Testy E2E dla modułu koszyka' },
	{ key: 'DEV-201', summary: 'Setup środowiska CI/CD' },
	{ key: 'DEV-202', summary: 'Migracja na nową wersję frameworka' },
	{ key: 'DEV-203', summary: 'Dokumentacja API endpoints' },
	{ key: 'BUG-301', summary: 'Błąd wyświetlania na mobile' },
	{ key: 'BUG-302', summary: 'Problem z cache po deployu' }
];

// Parent tasks from Jira Y (categories for time logging)
const mockParentsY = [
	{ key: 'BCMS-1', summary: 'Development - Sprint Work', totalHours: 24 },
	{ key: 'BCMS-2', summary: 'Communication & Meetings', totalHours: 8 },
	{ key: 'BCMS-3', summary: 'Code Review & Support', totalHours: 6 },
	{ key: 'BCMS-4', summary: 'Documentation', totalHours: 4 },
	{ key: 'BCMS-5', summary: 'Planning & Estimation', totalHours: 3 },
	{ key: 'BCMS-6', summary: 'Bug Fixing', totalHours: 5 },
	{ key: 'BCMS-7', summary: 'DevOps & Infrastructure', totalHours: 2 },
	{ key: 'BCMS-8', summary: 'Learning & Training', totalHours: 1 }
];

const comments = [
	'Praca nad implementacją',
	'Debugging i testy',
	'Spotkanie z zespołem',
	'Analiza wymagań',
	'Refaktoryzacja kodu',
	'Przegląd PR',
	'Dokumentacja',
	'Integracja komponentów'
];

function formatTimeSpent(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0 && minutes > 0) {
		return `${hours}h ${minutes}m`;
	} else if (hours > 0) {
		return `${hours}h`;
	} else if (minutes > 0) {
		return `${minutes}m`;
	} else {
		return '0m';
	}
}

function generateWorklogId(): string {
	return `wl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateParentId(): string {
	return `parent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomElement<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomWorklogs(date: Date, count: number): WorklogEntry[] {
	const worklogs: WorklogEntry[] = [];
	const dateStr = date.toISOString().split('T')[0];

	// Shuffle issues for variety
	const shuffledIssues = [...mockIssuesX].sort(() => Math.random() - 0.5);
	const selectedIssues = shuffledIssues.slice(0, count);

	for (const issue of selectedIssues) {
		// Random time between 15 minutes and 4 hours
		const timeSpentSeconds = (Math.floor(Math.random() * 16) + 1) * 900; // 15-min increments

		worklogs.push({
			id: generateWorklogId(),
			issueKey: issue.key,
			issueSummary: issue.summary,
			timeSpentSeconds,
			timeSpentFormatted: formatTimeSpent(timeSpentSeconds),
			comment: getRandomElement(comments),
			author: 'current.user@company.com',
			started: dateStr
		});
	}

	return worklogs;
}

function generateParentTasks(month: Date): ParentTask[] {
	// Return 2-4 random parent tasks that "have logged time this month"
	const count = Math.floor(Math.random() * 3) + 2;
	const shuffled = [...mockParentsY].sort(() => Math.random() - 0.5);
	const selected = shuffled.slice(0, count);

	return selected.map((p) => ({
		id: generateParentId(),
		issueKey: p.key,
		issueSummary: p.summary,
		totalTimeSpentSeconds: p.totalHours * 3600,
		totalTimeSpentFormatted: `${p.totalHours}h`,
		children: [],
		isExpanded: true
	}));
}

// Simulate API delay
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWorklogsFromJiraX(date: Date): Promise<WorklogEntry[]> {
	await delay(600 + Math.random() * 500);

	// Generate 4-8 random worklogs
	const count = Math.floor(Math.random() * 5) + 4;
	return generateRandomWorklogs(date, count);
}

export async function fetchParentsFromJiraY(month: Date): Promise<ParentTask[]> {
	await delay(500 + Math.random() * 400);

	return generateParentTasks(month);
}

export async function searchJiraYTasks(query: string): Promise<ParentTask[]> {
	await delay(300 + Math.random() * 300);

	if (!query.trim()) return [];

	const lowerQuery = query.toLowerCase();

	// Filter parent tasks by key or summary
	const results = mockParentsY
		.filter(
			(p) =>
				p.key.toLowerCase().includes(lowerQuery) || p.summary.toLowerCase().includes(lowerQuery)
		)
		.map((p) => ({
			id: generateParentId(),
			issueKey: p.key,
			issueSummary: p.summary,
			totalTimeSpentSeconds: 0,
			totalTimeSpentFormatted: '0h',
			children: [],
			isExpanded: true
		}));

	return results;
}

export async function migrateWorklogs(
	migrations: { parentKey: string; children: WorklogEntry[] }[]
): Promise<{ success: boolean; migratedCount: number }> {
	await delay(1000 + Math.random() * 1000);

	// Simulate 95% success rate
	const success = Math.random() > 0.05;
	const totalCount = migrations.reduce((sum, m) => sum + m.children.length, 0);

	return {
		success,
		migratedCount: success ? totalCount : 0
	};
}

export function getTotalTime(worklogs: WorklogEntry[]): string {
	const totalSeconds = worklogs.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
	return formatTimeSpent(totalSeconds);
}
