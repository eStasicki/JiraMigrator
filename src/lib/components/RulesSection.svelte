<script lang="ts">
	import { Plus, Trash2, ArrowRight, Settings2, Tag, Ticket, Hash } from 'lucide-svelte';
	import type { Project, MigrationRule } from '$lib/stores/settings.svelte';
	import TaskSelect from './TaskSelect.svelte';
	import Button from './Button.svelte';
	import ConfirmModal from './ConfirmModal.svelte';

	interface Props {
		project: Project;
		isJiraXConnected: boolean;
		isJiraYConnected: boolean;
		isTestingX?: boolean;
		isTestingY?: boolean;
		onSave?: () => void;
	}

	let {
		project,
		isJiraXConnected,
		isJiraYConnected,
		isTestingX = false,
		isTestingY = false,
		onSave
	}: Props = $props();

	let showDeleteModal = $state(false);
	let ruleToDeleteId = $state<string | null>(null);

	function addRule() {
		const newRule: MigrationRule = {
			id: `rule-${Date.now()}`,
			sourceType: 'task',
			sourceValue: '',
			targetTaskKey: ''
		};
		project.rules = [...(project.rules || []), newRule];
		// Don't auto-save on add since it's empty
	}

	function setSourceType(index: number, type: 'task' | 'label' | 'type') {
		const newRules = [...(project.rules || [])];
		if (!newRules[index]) return;

		newRules[index] = { ...newRules[index], sourceType: type, sourceValue: '' };
		project.rules = newRules;
		// No onSave here as we reset the value to empty
	}

	function removeRule(id: string) {
		const rule = (project.rules || []).find((r) => r.id === id);
		// If rule is empty, just remove it without confirmation
		if (rule && !rule.sourceValue && !rule.targetTaskKey) {
			project.rules = (project.rules || []).filter((r) => r.id !== id);
			return;
		}

		ruleToDeleteId = id;
		showDeleteModal = true;
	}

	function confirmRemoveRule() {
		if (ruleToDeleteId) {
			project.rules = (project.rules || []).filter((r) => r.id !== ruleToDeleteId);
			onSave?.();
		}
		showDeleteModal = false;
		ruleToDeleteId = null;
	}

	function updateRuleKey(
		index: number,
		key: 'sourceValue' | 'targetTaskKey',
		value: string,
		summary?: string
	) {
		const newRules = [...(project.rules || [])];
		if (!newRules[index]) return;

		newRules[index] = { ...newRules[index], [key]: value };
		if (key === 'targetTaskKey' && summary !== undefined) {
			newRules[index].targetTaskSummary = summary;
		}
		project.rules = newRules;

		// Only auto-save if at least one field is filled
		const rule = newRules[index];
		if (rule.sourceValue || rule.targetTaskKey) {
			onSave?.();
		}
	}
</script>

<div class="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div
				class="flex size-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400"
			>
				<Settings2 class="size-5" />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-white">Reguły</h2>
				<p class="text-sm text-slate-500">
					Zdefiniuj automatyczne mapowanie zadań między instancjami
				</p>
			</div>
		</div>
		<Button variant="secondary" size="sm" onclick={addRule}>
			<Plus class="size-4" />
			Dodaj regułę
		</Button>
	</div>

	{#if project.rules.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 py-12 text-center"
		>
			<div class="mb-4 rounded-full bg-slate-800 p-4">
				<Settings2 class="size-8 text-slate-600" />
			</div>
			<h3 class="font-medium text-slate-400">Brak zdefiniowanych reguł</h3>
			<p class="mt-1 max-w-xs text-sm text-slate-500">
				Dodaj reguły, aby automatycznie przypisywać worklogi do odpowiednich zadań w Jira Y
			</p>
			<Button variant="primary" size="sm" onclick={addRule} class="mt-6">
				<Plus class="size-4" />
				Dodaj pierwszą regułę
			</Button>
		</div>
	{:else}
		<div class="space-y-4">
			<!-- Header labels -->
			<div
				class="grid grid-cols-[1fr_40px_1fr_48px] gap-4 px-3 text-[10px] font-black tracking-widest text-slate-500 uppercase"
			>
				<div>Zadanie Jira X</div>
				<div class="text-center"></div>
				<div>Zadanie Jira Y (Rodzic)</div>
				<div></div>
			</div>

			{#each project.rules as rule, index (rule.id)}
				<div
					class="group grid grid-cols-[1fr_40px_1fr_48px] items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 transition-all hover:border-slate-600"
				>
					<!-- Column A: Source -->
					<div class="space-y-2">
						<div class="flex gap-1">
							<button
								type="button"
								onclick={() => setSourceType(index, 'task')}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[10px] font-bold transition-all
									{rule.sourceType === 'task'
									? 'bg-violet-500 text-white shadow-sm'
									: 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
							>
								<Ticket class="size-3" />
								TASK
							</button>
							<button
								type="button"
								onclick={() => setSourceType(index, 'label')}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[10px] font-bold transition-all
									{rule.sourceType === 'label'
									? 'bg-emerald-500 text-white shadow-sm'
									: 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
							>
								<Tag class="size-3" />
								LABELKA
							</button>
							<button
								type="button"
								onclick={() => setSourceType(index, 'type')}
								class="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[10px] font-bold transition-all
									{rule.sourceType === 'type'
									? 'bg-blue-500 text-white shadow-sm'
									: 'bg-slate-800 text-slate-500 hover:text-slate-300'}"
							>
								<Hash class="size-3" />
								TYP
							</button>
						</div>

						{#if rule.sourceType === 'task'}
							<TaskSelect
								config={project.jiraX}
								value={rule.sourceValue}
								disabled={!isJiraXConnected || isTestingX}
								placeholder={isTestingX
									? 'Sprawdzanie połączenia...'
									: isJiraXConnected
										? `Wybierz task z ${project.jiraX.name}`
										: 'Najpierw przetestuj połączenie Jira X'}
								onSelect={(key) => updateRuleKey(index, 'sourceValue', key)}
							/>
						{:else}
							<div class="relative">
								<Hash class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
								<input
									type="text"
									placeholder={rule.sourceType === 'label'
										? 'Wpisz nazwę labelki...'
										: 'Wpisz typ zadania (np. Bug)...'}
									value={rule.sourceValue}
									disabled={!isJiraXConnected || isTestingX}
									oninput={(e) =>
										updateRuleKey(index, 'sourceValue', (e.target as HTMLInputElement).value)}
									class="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 pr-4 pl-9 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								/>
							</div>
						{/if}
					</div>

					<!-- Column B: Arrow -->
					<div class="flex justify-center">
						<ArrowRight
							class="size-5 {isJiraXConnected && isJiraYConnected
								? 'text-violet-400'
								: 'text-slate-700'}"
						/>
					</div>

					<!-- Column C: Target -->
					<div>
						<TaskSelect
							config={project.jiraY}
							value={rule.targetTaskKey}
							disabled={!isJiraYConnected || isTestingY}
							placeholder={isTestingY
								? 'Sprawdzanie połączenia...'
								: isJiraYConnected
									? `Wybierz task z ${project.jiraY.name}`
									: 'Najpierw przetestuj połączenie Jira Y'}
							onSelect={(key, summary) => updateRuleKey(index, 'targetTaskKey', key, summary)}
						/>
						{#if rule.targetTaskSummary}
							<p class="mt-1.5 truncate px-1 text-[10px] text-slate-500">
								{rule.targetTaskSummary}
							</p>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex justify-end">
						<button
							type="button"
							onclick={() => removeRule(rule.id)}
							class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
							title="Usuń regułę"
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<ConfirmModal
	isOpen={showDeleteModal}
	title="Usuń regułę"
	message="Czy na pewno chcesz usunąć tę regułę mapowania?"
	confirmLabel="Usuń"
	cancelLabel="Anuluj"
	variant="danger"
	onConfirm={confirmRemoveRule}
	onCancel={() => {
		showDeleteModal = false;
		ruleToDeleteId = null;
	}}
/>
