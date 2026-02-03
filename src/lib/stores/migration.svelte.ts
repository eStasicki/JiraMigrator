import { SvelteSet } from 'svelte/reactivity';

export interface WorklogEntry {
	id: string;
	issueKey: string;
	issueSummary: string;
	timeSpentSeconds: number;
	timeSpentFormatted: string;
	comment: string;
	author: string;
	started: string;
}

export interface ParentTask {
	id: string;
	issueKey: string;
	issueSummary: string;
	totalTimeSpentSeconds: number;
	totalTimeSpentFormatted: string;
	children: WorklogEntry[];
	isExpanded: boolean;
}

export interface MigrationState {
	jiraXDate: Date;
	jiraYMonth: Date;
	jiraXWorklogs: WorklogEntry[];
	jiraYParents: ParentTask[];
	selectedWorklogIds: Set<string>;
	isLoadingX: boolean;
	isLoadingY: boolean;
	isMigrating: boolean;
	isAddParentModalOpen: boolean;
	searchQuery: string;
	searchResults: ParentTask[];
	isSearching: boolean;
}

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

function createMigrationStore() {
	const today = new Date();

	let state = $state<MigrationState>({
		jiraXDate: today,
		jiraYMonth: today,
		jiraXWorklogs: [],
		jiraYParents: [],
		selectedWorklogIds: new SvelteSet<string>(),
		isLoadingX: false,
		isLoadingY: false,
		isMigrating: false,
		isAddParentModalOpen: false,
		searchQuery: '',
		searchResults: [],
		isSearching: false
	});

	function setJiraXDate(date: Date) {
		state.jiraXDate = date;
	}

	function setJiraYMonth(date: Date) {
		state.jiraYMonth = date;
	}

	function setJiraXWorklogs(worklogs: WorklogEntry[]) {
		state.jiraXWorklogs = worklogs;
		// Clear selection when loading new worklogs
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function setJiraYParents(parents: ParentTask[]) {
		state.jiraYParents = parents;
	}

	function setLoadingX(loading: boolean) {
		state.isLoadingX = loading;
	}

	function setLoadingY(loading: boolean) {
		state.isLoadingY = loading;
	}

	function setMigrating(migrating: boolean) {
		state.isMigrating = migrating;
	}

	function toggleParentExpanded(parentId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			parent.isExpanded = !parent.isExpanded;
		}
	}

	// Selection functions
	function toggleWorklogSelection(worklogId: string) {
		const newSet = new SvelteSet(state.selectedWorklogIds);
		if (newSet.has(worklogId)) {
			newSet.delete(worklogId);
		} else {
			newSet.add(worklogId);
		}
		state.selectedWorklogIds = newSet;
	}

	function selectAllWorklogs() {
		state.selectedWorklogIds = new SvelteSet(state.jiraXWorklogs.map((w) => w.id));
	}

	function deselectAllWorklogs() {
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function isWorklogSelected(worklogId: string): boolean {
		return state.selectedWorklogIds.has(worklogId);
	}

	function getSelectedWorklogs(): WorklogEntry[] {
		return state.jiraXWorklogs.filter((w) => state.selectedWorklogIds.has(w.id));
	}

	function getSelectedCount(): number {
		return state.selectedWorklogIds.size;
	}

	function getSelectedTotalTime(): string {
		const selected = getSelectedWorklogs();
		const totalSeconds = selected.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
		return formatTimeSpent(totalSeconds);
	}

	function addSelectedToParent(parentId: string) {
		const selected = getSelectedWorklogs();
		for (const worklog of selected) {
			addChildToParent(parentId, worklog);
		}
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function addChildToParent(parentId: string, worklog: WorklogEntry) {
		// Remove from Jira X worklogs
		state.jiraXWorklogs = state.jiraXWorklogs.filter((w) => w.id !== worklog.id);

		// Also remove from any other parent (in case moving between parents)
		for (const parent of state.jiraYParents) {
			parent.children = parent.children.filter((c) => c.id !== worklog.id);
		}

		// Add to target parent
		const targetParent = state.jiraYParents.find((p) => p.id === parentId);
		if (targetParent) {
			if (!targetParent.children.find((c) => c.id === worklog.id)) {
				targetParent.children = [...targetParent.children, worklog];
			}
			targetParent.isExpanded = true;
		}
	}

	function removeChildFromParent(parentId: string, worklogId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			const worklog = parent.children.find((c) => c.id === worklogId);
			if (worklog) {
				// Remove from parent
				parent.children = parent.children.filter((c) => c.id !== worklogId);
				// Add back to Jira X
				if (!state.jiraXWorklogs.find((w) => w.id === worklogId)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, worklog];
				}
			}
		}
	}

	function addParent(parent: ParentTask) {
		if (!state.jiraYParents.find((p) => p.id === parent.id)) {
			state.jiraYParents = [...state.jiraYParents, { ...parent, children: [], isExpanded: true }];
		}
	}

	function removeParent(parentId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			// Move children back to Jira X
			for (const child of parent.children) {
				if (!state.jiraXWorklogs.find((w) => w.id === child.id)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, child];
				}
			}
			// Remove parent
			state.jiraYParents = state.jiraYParents.filter((p) => p.id !== parentId);
		}
	}

	function openAddParentModal() {
		state.isAddParentModalOpen = true;
		state.searchQuery = '';
		state.searchResults = [];
	}

	function closeAddParentModal() {
		state.isAddParentModalOpen = false;
		state.searchQuery = '';
		state.searchResults = [];
	}

	function setSearchQuery(query: string) {
		state.searchQuery = query;
	}

	function setSearchResults(results: ParentTask[]) {
		state.searchResults = results;
	}

	function setIsSearching(searching: boolean) {
		state.isSearching = searching;
	}

	function getTotalChildrenTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return '0m';
		const totalSeconds = parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTimeSpent(totalSeconds);
	}

	function getTotalPendingMigration(): { count: number; time: string } {
		let totalSeconds = 0;
		let count = 0;
		for (const parent of state.jiraYParents) {
			count += parent.children.length;
			totalSeconds += parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		}
		return { count, time: formatTimeSpent(totalSeconds) };
	}

	function clearAllChildren() {
		for (const parent of state.jiraYParents) {
			for (const child of parent.children) {
				if (!state.jiraXWorklogs.find((w) => w.id === child.id)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, child];
				}
			}
			parent.children = [];
		}
	}

	function getMigrationSummary(): {
		parentKey: string;
		parentSummary: string;
		children: WorklogEntry[];
		totalTime: string;
	}[] {
		return state.jiraYParents
			.filter((p) => p.children.length > 0)
			.map((p) => ({
				parentKey: p.issueKey,
				parentSummary: p.issueSummary,
				children: p.children,
				totalTime: formatTimeSpent(p.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0))
			}));
	}

	return {
		get state() {
			return state;
		},
		setJiraXDate,
		setJiraYMonth,
		setJiraXWorklogs,
		setJiraYParents,
		setLoadingX,
		setLoadingY,
		setMigrating,
		toggleParentExpanded,
		addChildToParent,
		removeChildFromParent,
		addParent,
		removeParent,
		openAddParentModal,
		closeAddParentModal,
		setSearchQuery,
		setSearchResults,
		setIsSearching,
		getTotalChildrenTime,
		getTotalPendingMigration,
		clearAllChildren,
		getMigrationSummary,
		// Selection
		toggleWorklogSelection,
		selectAllWorklogs,
		deselectAllWorklogs,
		isWorklogSelected,
		getSelectedWorklogs,
		getSelectedCount,
		getSelectedTotalTime,
		addSelectedToParent
	};
}

export const migrationStore = createMigrationStore();
