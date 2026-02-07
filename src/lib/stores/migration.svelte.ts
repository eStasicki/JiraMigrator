import { SvelteSet, SvelteMap } from 'svelte/reactivity';
import { formatTime } from '$lib/utils';
import { settingsStore } from './settings.svelte';
import { deleteWorklogInJiraY } from '$lib/api/jiraApi';

export interface WorklogEntry {
	id: string;
	issueKey: string;
	issueSummary: string;
	timeSpentSeconds: number;
	timeSpentFormatted: string;
	comment: string;
	author: string;
	started: string;
	labels?: string[];
	issueType?: string;
	isNew?: boolean;
	originalWorklogId?: string; // Links back to source worklog in X column
	isMoved?: boolean; // If true, this worklog has been moved to a parent in Y column
}

export interface ParentTask {
	id: string;
	issueKey: string;
	issueSummary: string;
	totalTimeSpentSeconds: number;
	totalTimeSpentFormatted: string;
	type: string;
	status: string;
	children: WorklogEntry[];
	isExpanded: boolean;
	initialTotalTimeSeconds?: number;
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
	dragOverParentId: string | null;
	dragOverWorklogId: string | null;
	dragOverWorklogSide: 'top' | 'bottom' | null;
}

function parseFormattedTime(formatted: string): number {
	if (!formatted) return 0;
	const clean = formatted.trim().toLowerCase();
	let totalSeconds = 0;

	// 1. Try to find hours (supports "1h", "1.5h", "1,5 h")
	const hMatch = clean.match(/(\d+([.,]\d+)?)\s*h/);
	if (hMatch) {
		const hVal = hMatch[1].replace(',', '.');
		totalSeconds += Math.round(parseFloat(hVal) * 3600);
	}

	// 2. Try to find minutes (supports "15m", "15 m")
	const mMatch = clean.match(/(\d+([.,]\d+)?)\s*m/);
	if (mMatch) {
		const mVal = mMatch[1].replace(',', '.');
		totalSeconds += Math.round(parseFloat(mVal) * 60);
	}

	// 3. Fallback: handle pure numbers
	if (!hMatch && !mMatch) {
		// Pure decimal or integer without unit
		if (/^(\d+([.,]\d+)?)$/.test(clean)) {
			const val = clean.replace(',', '.');
			// If it's a small decimal (like 0.5) or contains a separator, treat as hours
			// If it's a large integer (like 30), treat as minutes
			if (val.includes('.') || parseFloat(val) < 8) {
				totalSeconds = Math.round(parseFloat(val) * 3600);
			} else {
				totalSeconds = parseInt(val) * 60;
			}
		}
	}

	return totalSeconds;
}

function createMigrationStore() {
	const today = new Date();

	const state = $state<MigrationState>({
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
		isSearching: false,
		dragOverParentId: null,
		dragOverWorklogId: null,
		dragOverWorklogSide: null
	});

	function setDragOverParent(parentId: string | null) {
		state.dragOverParentId = parentId;
	}

	function setDragOverWorklog(worklogId: string | null, side: 'top' | 'bottom' | null = null) {
		state.dragOverWorklogId = worklogId;
		state.dragOverWorklogSide = side;
	}

	function clearAllDragOver() {
		state.dragOverParentId = null;
		state.dragOverWorklogId = null;
		state.dragOverWorklogSide = null;
	}

	function setJiraXDate(date: Date) {
		state.jiraXDate = date;
	}

	function setJiraYMonth(date: Date) {
		state.jiraYMonth = date;
	}

	function resolveAlreadyMigrated() {
		if (state.jiraXWorklogs.length === 0) return;

		// 1. Collect all available "slots" in Jira Y
		// pendingIds: IDs of worklogs that are currently in the "to be moved" state
		const pendingOriginalIds = new SvelteSet<string>();
		// historicalPool: Map of issueKey -> array of durations (seconds) present in Jira Y
		const historicalPool = new SvelteMap<string, number[]>();

		for (const parent of state.jiraYParents) {
			for (const child of parent.children) {
				if (child.isNew) {
					if (child.originalWorklogId) {
						pendingOriginalIds.add(String(child.originalWorklogId));
					}
				} else {
					const match = child.comment?.match(/^\[([a-zA-Z]+-\d+)\]/);
					if (match) {
						const key = match[1];
						const list = historicalPool.get(key) || [];
						list.push(child.timeSpentSeconds);
						historicalPool.set(key, list);
					}
				}
			}
		}

		// 2. Greedy match Jira X worklogs
		// We use a fresh copy of the pool to consume it during mapping
		const availableHistorical = new SvelteMap<string, number[]>();
		historicalPool.forEach((durations, key) => {
			availableHistorical.set(key, [...durations]);
		});

		state.jiraXWorklogs = state.jiraXWorklogs.map((w) => {
			// Priority A: It's manually moved/pending in this session
			if (pendingOriginalIds.has(String(w.id))) {
				return { ...w, isMoved: true };
			}

			// Priority B: It matches a historical entry in Jira Y
			const durations = availableHistorical.get(w.issueKey);
			if (durations && durations.length > 0) {
				const matchIdx = durations.indexOf(w.timeSpentSeconds);
				if (matchIdx !== -1) {
					// Found a match! Consume it so another identical worklog won't match it
					durations.splice(matchIdx, 1);
					return { ...w, isMoved: true };
				}
			}

			// No match found - it should be active in X
			return { ...w, isMoved: false };
		});
	}

	function setJiraXWorklogs(worklogs: WorklogEntry[]) {
		state.jiraXWorklogs = worklogs;
		state.selectedWorklogIds = new SvelteSet<string>();
		// Reset isMoved status on new load
		state.jiraXWorklogs.forEach((w) => (w.isMoved = false));
		resolveAlreadyMigrated();
	}

	function setJiraYParents(parents: ParentTask[]) {
		// 1. Identify current 'isNew' worklogs to preserve them
		const pendingByParentKey = new SvelteMap<string, WorklogEntry[]>();
		const existingPlaceholders = new SvelteMap<string, ParentTask>();

		for (const p of state.jiraYParents) {
			const pending = p.children.filter((c) => c.isNew);
			if (pending.length > 0) {
				pendingByParentKey.set(p.issueKey, pending);
				if (p.status === 'Z reguły') {
					existingPlaceholders.set(p.issueKey, p);
				}
			}
		}

		// 2. Build the new parent list
		const newParents = parents.map((p) => {
			const initialTotalSeconds = p.children.reduce((sum, c) => sum + (c.timeSpentSeconds || 0), 0);
			const localPending = pendingByParentKey.get(p.issueKey) || [];

			// IMPORTANT: Filter out pending if they just became historical (migrated)
			// This prevents duplicates after migration & refresh
			const filteredPending = localPending.filter((pending) => {
				// Check if this pending item matches any historical child in the NEW parent list
				const historicalMatch = p.children.some(
					(hist) =>
						!hist.isNew &&
						hist.timeSpentSeconds === pending.timeSpentSeconds &&
						hist.comment?.startsWith(`[${pending.issueKey}]`)
				);
				return !historicalMatch;
			});

			return {
				...p,
				initialTotalTimeSeconds: initialTotalSeconds,
				children: [...p.children, ...filteredPending]
			};
		});

		// 3. Add back any placeholders that don't exist in the new list but still have pending children
		for (const [key, pendingItems] of pendingByParentKey.entries()) {
			if (!newParents.some((np) => np.issueKey === key)) {
				const placeholder = existingPlaceholders.get(key);
				if (placeholder) {
					// We keep these pending items
					if (pendingItems.length > 0) {
						newParents.push({
							...placeholder,
							initialTotalTimeSeconds: placeholder.initialTotalTimeSeconds || 0,
							children: pendingItems
						});
					}
				}
			}
		}

		state.jiraYParents = newParents;
		resolveAlreadyMigrated();
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
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function addSelectedToParent(
		parentId: string,
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		const selected = getSelectedWorklogs().map((w) => ({
			...w,
			isNew: true,
			originalWorklogId: w.id, // Link to original
			id: `moved-${w.id}-${Date.now()}` // Generate new ID to avoid duplicates in keys
		}));
		addChildrenToParentAt(parentId, selected, targetWorklogId, position);

		// Mark originals as moved instead of removing
		state.jiraXWorklogs = state.jiraXWorklogs.map((w) => {
			if (state.selectedWorklogIds.has(w.id)) {
				return { ...w, isMoved: true };
			}
			return w;
		});

		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function moveWorklogToParent(
		parentId: string,
		worklog: WorklogEntry,
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		// If it's already a "new" item (from Y), it's just a reorder within Y
		if (worklog.isNew) {
			addChildrenToParentAt(parentId, [worklog], targetWorklogId, position);
			return;
		}

		// Otherwise it's a fresh move from X
		const newWorklog = {
			...worklog,
			isNew: true,
			originalWorklogId: worklog.id,
			id: `moved-${worklog.id}-${Date.now()}`
		};

		addChildrenToParentAt(parentId, [newWorklog], targetWorklogId, position);

		// Mark original as moved
		const originalIndex = state.jiraXWorklogs.findIndex((w) => w.id === worklog.id);
		if (originalIndex !== -1) {
			state.jiraXWorklogs[originalIndex] = { ...state.jiraXWorklogs[originalIndex], isMoved: true };
		}
	}

	function addChildToParent(parentId: string, worklog: WorklogEntry) {
		const newWorklog = {
			...worklog,
			isNew: true,
			originalWorklogId: worklog.id,
			id: `moved-${worklog.id}-${Date.now()}`
		};

		addChildrenToParentAt(parentId, [newWorklog]);

		// Mark original as moved
		const originalIndex = state.jiraXWorklogs.findIndex((w) => w.id === worklog.id);
		if (originalIndex !== -1) {
			state.jiraXWorklogs[originalIndex] = { ...state.jiraXWorklogs[originalIndex], isMoved: true };
		}
	}

	function addChildrenToParentAt(
		parentId: string,
		worklogs: WorklogEntry[], // These are ALREADY prepared new copies
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		const worklogIds = new Set(worklogs.map((w) => w.id));

		// DO NOT remove from source (X column) here anymore.
		// That logic is moved to the caller (addChild/addSelected) to set 'isMoved' flag.

		// Remove from any existing parent IF they are already in a parent (moving between parents)
		// But if they are fresh from X, their IDs are new, so this won't match anything.
		// If we are moving within Y, we need to handle that.
		for (const p of state.jiraYParents) {
			p.children = p.children.filter((c) => !worklogIds.has(c.id));
		}

		const targetParent = state.jiraYParents.find((p) => p.id === parentId);
		if (targetParent) {
			if (!targetWorklogId) {
				// Append to end
				targetParent.children = [...targetParent.children, ...worklogs];
			} else {
				// Insert at specific position
				const index = targetParent.children.findIndex((c) => c.id === targetWorklogId);
				if (index !== -1) {
					const insertIndex = position === 'before' ? index : index + 1;
					const newChildren = [...targetParent.children];
					newChildren.splice(insertIndex, 0, ...worklogs);
					targetParent.children = newChildren;
				} else {
					targetParent.children = [...targetParent.children, ...worklogs];
				}
			}
			targetParent.isExpanded = true;
		}
	}

	async function removeChildFromParent(parentId: string, worklogId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			const worklog = parent.children.find((c) => c.id === worklogId);
			if (worklog) {
				await moveWorklogsToSource([worklog]);
			}
		}
	}

	function addParent(parent: ParentTask) {
		if (!state.jiraYParents.find((p) => p.id === parent.id)) {
			state.jiraYParents = [
				...state.jiraYParents,
				{ ...parent, children: [], isExpanded: true, initialTotalTimeSeconds: 0 }
			];
		}
	}

	async function removeParent(parentId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			// If removing a parent, move all its CHILDREN back to source (including deleting remote ones)
			await moveWorklogsToSource(parent.children);
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

	function getInitialTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		return formatTime(parent.initialTotalTimeSeconds || 0, settingsStore.settings.timeFormat);
	}

	function getOriginalTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children
			.filter((c) => !c.isNew)
			.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getAddedTime(parentId: string): string {
		return getTotalChildrenTime(parentId);
	}

	function getTotalTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getTotalChildrenTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children
			.filter((c) => c.isNew)
			.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getTotalPendingMigration(): { count: number; time: string } {
		let totalSeconds = 0;
		let count = 0;
		for (const parent of state.jiraYParents) {
			const newChildren = parent.children.filter((c) => c.isNew);
			count += newChildren.length;
			totalSeconds += newChildren.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		}
		return { count, time: formatTime(totalSeconds, settingsStore.settings.timeFormat) };
	}

	async function moveWorklogsToSource(worklogs: WorklogEntry[]) {
		const worklogIds = new SvelteSet(worklogs.map((w) => String(w.id)));
		const activeProject = settingsStore.getActiveProject();

		// Remove from all parents
		for (const p of state.jiraYParents) {
			const toDeleteRemotely = p.children.filter((c) => worklogIds.has(String(c.id)) && !c.isNew);

			if (activeProject && toDeleteRemotely.length > 0) {
				for (const wl of toDeleteRemotely) {
					// This is a remote worklog, delete it from Jira Y
					await deleteWorklogInJiraY(
						activeProject.jiraY.baseUrl,
						activeProject.jiraY.email,
						activeProject.jiraY.apiToken,
						String(wl.id),
						p.issueKey,
						activeProject.jiraY.tempoToken
					);
				}
			}

			p.children = p.children.filter((c) => !worklogIds.has(String(c.id)));
		}

		// Unmark originals in X
		for (const w of worklogs) {
			// 1. By originalWorklogId (for manually moved items in this session)
			if (w.originalWorklogId) {
				const xIdx = state.jiraXWorklogs.findIndex((xw) => xw.id === w.originalWorklogId);
				if (xIdx !== -1) {
					state.jiraXWorklogs[xIdx] = { ...state.jiraXWorklogs[xIdx], isMoved: false };
					continue;
				}
			}

			// 2. By Issue Key inside description (for already migrated tasks)
			// We look for [ABC-123] pattern in the comment
			const match = w.comment?.match(/^\[([a-zA-Z]+-\d+)\]/);
			if (match) {
				const originalKey = match[1];
				const xIdxByKey = state.jiraXWorklogs.findIndex((xw) => xw.issueKey === originalKey);
				if (xIdxByKey !== -1) {
					state.jiraXWorklogs[xIdxByKey] = { ...state.jiraXWorklogs[xIdxByKey], isMoved: false };
				}
			}
		}
	}

	function clearAllChildren() {
		for (const parent of state.jiraYParents) {
			for (const child of parent.children) {
				// Unmark originals
				if (child.originalWorklogId) {
					const xIdx = state.jiraXWorklogs.findIndex((w) => w.id === child.originalWorklogId);
					if (xIdx !== -1) {
						state.jiraXWorklogs[xIdx] = { ...state.jiraXWorklogs[xIdx], isMoved: false };
					}
				}
			}
			parent.children = [];
		}
	}

	function clearAllData() {
		state.jiraXWorklogs = [];
		state.jiraYParents = [];
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function getMigrationSummary(): {
		parentKey: string;
		parentSummary: string;
		children: WorklogEntry[];
		totalTime: string;
	}[] {
		return state.jiraYParents
			.filter((p) => p.children.some((c) => c.isNew))
			.map((p) => {
				const newChildren = p.children.filter((c) => c.isNew);
				return {
					parentKey: p.issueKey,
					parentSummary: p.issueSummary,
					children: newChildren,
					totalTime: formatTime(
						newChildren.reduce((sum, c) => sum + c.timeSpentSeconds, 0),
						settingsStore.settings.timeFormat
					)
				};
			});
	}

	function updateWorklog(id: string, updates: { comment?: string; timeSpentFormatted?: string }) {
		const xIdx = state.jiraXWorklogs.findIndex((w) => w.id === id);
		if (xIdx !== -1) {
			const w = state.jiraXWorklogs[xIdx];
			if (updates.comment !== undefined) w.comment = updates.comment;
			if (updates.timeSpentFormatted !== undefined) {
				const seconds = parseFormattedTime(updates.timeSpentFormatted);
				w.timeSpentSeconds = seconds;
				w.timeSpentFormatted = formatTime(seconds, settingsStore.settings.timeFormat);
			}
		}

		for (const parent of state.jiraYParents) {
			const yIdx = parent.children.findIndex((c) => c.id === id);
			if (yIdx !== -1) {
				const c = parent.children[yIdx];
				if (updates.comment !== undefined) {
					c.comment = updates.comment;
					c.issueSummary = updates.comment;
				}
				if (updates.timeSpentFormatted !== undefined) {
					const seconds = parseFormattedTime(updates.timeSpentFormatted);
					c.timeSpentSeconds = seconds;
					c.timeSpentFormatted = formatTime(seconds, settingsStore.settings.timeFormat);
				}
			}
		}
	}

	function applyRules() {
		const activeProject = settingsStore.getActiveProject();
		if (!activeProject || !activeProject.rules || activeProject.rules.length === 0) return;

		// Group worklogs by target parent key
		const ruleMatches = new SvelteMap<string, WorklogEntry[]>();
		const movedLogIds = new SvelteSet<string>();

		state.jiraXWorklogs.forEach((worklog) => {
			// Skip if already moved
			if (worklog.isMoved) return;

			for (const rule of activeProject.rules) {
				if (!rule.sourceValue || !rule.targetTaskKey) continue;

				let matched = false;
				if (rule.sourceType === 'task') {
					if (worklog.issueKey === rule.sourceValue) matched = true;
				} else if (rule.sourceType === 'label') {
					if (worklog.labels?.includes(rule.sourceValue)) matched = true;
				} else if (rule.sourceType === 'type') {
					if (worklog.issueType === rule.sourceValue) matched = true;
				}

				if (matched) {
					// Guard against adding the same worklog twice if it's already in Jira Y's current UI state
					const isAlreadyInParent = state.jiraYParents.some((p) =>
						p.children.some((c) => c.originalWorklogId === worklog.id)
					);

					if (!isAlreadyInParent) {
						const existing = ruleMatches.get(rule.targetTaskKey) || [];
						ruleMatches.set(rule.targetTaskKey, [
							...existing,
							{
								...worklog,
								isNew: true,
								originalWorklogId: worklog.id,
								id: `moved-${worklog.id}-${Date.now()}`
							}
						]);
						movedLogIds.add(worklog.id);
					}
					break;
				}
			}
		});

		// Apply moves for found matches
		ruleMatches.forEach((worklogs, targetKey) => {
			let parent = state.jiraYParents.find((p) => p.issueKey === targetKey);

			if (!parent) {
				// Try to find summary from rules to create a placeholder parent
				const ruleWithSummary = activeProject.rules.find(
					(r) => r.targetTaskKey === targetKey && r.targetTaskSummary
				);
				const summary = ruleWithSummary?.targetTaskSummary || 'Zadanie docelowe (Auto)';

				addParent({
					id: targetKey, // Fallback to key as ID
					issueKey: targetKey,
					issueSummary: summary,
					totalTimeSpentSeconds: 0,
					totalTimeSpentFormatted: '0h',
					type: 'Task',
					status: 'Z reguły',
					children: [],
					isExpanded: true
				});

				// Re-find the newly added parent
				parent = state.jiraYParents.find((p) => p.issueKey === targetKey);
			}

			if (parent) {
				addChildrenToParentAt(parent.id, worklogs);
			}
		});

		// Update X column to mark moved items
		if (movedLogIds.size > 0) {
			state.jiraXWorklogs = state.jiraXWorklogs.map((w) => {
				if (movedLogIds.has(w.id)) {
					return { ...w, isMoved: true };
				}
				return w;
			});
		}
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
		setDragOverParent,
		setDragOverWorklog,
		clearAllDragOver,
		toggleParentExpanded,
		addChildToParent,
		addChildrenToParentAt,
		removeChildFromParent,
		moveWorklogsToSource,
		addParent,
		removeParent,
		openAddParentModal,
		closeAddParentModal,
		setSearchQuery,
		setSearchResults,
		setIsSearching,
		getInitialTime,
		getOriginalTime,
		getAddedTime,
		getTotalTime,
		getTotalChildrenTime,
		getTotalPendingMigration,
		clearAllChildren,
		clearAllData,
		getMigrationSummary,
		toggleWorklogSelection,
		selectAllWorklogs,
		deselectAllWorklogs,
		isWorklogSelected,
		getSelectedWorklogs,
		getSelectedCount,
		getSelectedTotalTime,
		addSelectedToParent,
		updateWorklog,
		applyRules,
		moveWorklogToParent
	};
}

export const migrationStore = createMigrationStore();
