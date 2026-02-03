<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		selectedDate: Date;
		onDateChange: (date: Date) => void;
		label?: string;
	}

	let { selectedDate = $bindable(), onDateChange, label = 'Wybierz datę' }: Props = $props();

	let showCalendar = $state(false);
	let currentMonth = $state(new Date(selectedDate));

	const daysOfWeek = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];
	const monthNames = [
		'Styczeń',
		'Luty',
		'Marzec',
		'Kwiecień',
		'Maj',
		'Czerwiec',
		'Lipiec',
		'Sierpień',
		'Wrzesień',
		'Październik',
		'Listopad',
		'Grudzień'
	];

	function getDaysInMonth(date: Date): (Date | null)[] {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);

		const days: (Date | null)[] = [];

		// Get day of week (0 = Sunday, we want Monday = 0)
		let startDay = firstDay.getDay() - 1;
		if (startDay < 0) startDay = 6;

		// Add empty days for padding
		for (let i = 0; i < startDay; i++) {
			days.push(null);
		}

		// Add actual days
		for (let i = 1; i <= lastDay.getDate(); i++) {
			days.push(new Date(year, month, i));
		}

		return days;
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('pl-PL', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function isSameDay(a: Date, b: Date): boolean {
		return a.toDateString() === b.toDateString();
	}

	function isToday(date: Date): boolean {
		return isSameDay(date, new Date());
	}

	function prevMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
	}

	function nextMonth() {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
	}

	function selectDate(date: Date) {
		selectedDate = date;
		onDateChange(date);
		showCalendar = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showCalendar = false;
		}
	}

	$effect(() => {
		currentMonth = new Date(selectedDate);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
	<label class="mb-2 block text-sm font-medium text-slate-400">{label}</label>
	<button
		type="button"
		onclick={() => (showCalendar = !showCalendar)}
		class="flex w-full items-center justify-between rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-left text-slate-100 transition-all duration-200 hover:border-slate-500 hover:bg-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
	>
		<span>{formatDate(selectedDate)}</span>
		<svg class="size-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	</button>

	{#if showCalendar}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-xl shadow-black/50"
		>
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between">
				<button
					type="button"
					onclick={prevMonth}
					class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<ChevronLeft class="size-5" />
				</button>
				<span class="font-semibold text-white">
					{monthNames[currentMonth.getMonth()]}
					{currentMonth.getFullYear()}
				</span>
				<button
					type="button"
					onclick={nextMonth}
					class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<ChevronRight class="size-5" />
				</button>
			</div>

			<!-- Days of week -->
			<div class="mb-2 grid grid-cols-7 gap-1">
				{#each daysOfWeek as day}
					<div class="py-2 text-center text-xs font-medium text-slate-500">{day}</div>
				{/each}
			</div>

			<!-- Days -->
			<div class="grid grid-cols-7 gap-1">
				{#each getDaysInMonth(currentMonth) as day}
					{#if day}
						<button
							type="button"
							onclick={() => selectDate(day)}
							class="rounded-lg py-2 text-sm transition-all duration-150
								{isSameDay(day, selectedDate)
								? 'bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white shadow-lg'
								: isToday(day)
									? 'bg-slate-700 font-medium text-violet-400'
									: 'text-slate-300 hover:bg-slate-700 hover:text-white'}"
						>
							{day.getDate()}
						</button>
					{:else}
						<div></div>
					{/if}
				{/each}
			</div>

			<!-- Quick actions -->
			<div class="mt-4 flex gap-2 border-t border-slate-700 pt-4">
				<button
					type="button"
					onclick={() => selectDate(new Date())}
					class="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
				>
					Dzisiaj
				</button>
				<button
					type="button"
					onclick={() => {
						const yesterday = new Date();
						yesterday.setDate(yesterday.getDate() - 1);
						selectDate(yesterday);
					}}
					class="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
				>
					Wczoraj
				</button>
			</div>
		</div>
	{/if}
</div>
