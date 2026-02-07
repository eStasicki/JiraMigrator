<script lang="ts">
	import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from 'lucide-svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { cn } from '$lib/utils';

	interface Props {
		selectedDate: Date;
		onDateChange: (date: Date) => void;
		label?: string;
	}

	let { selectedDate = $bindable(), onDateChange, label = '' }: Props = $props();

	let showCalendar = $state(false);
	let currentMonth = $state(new Date(selectedDate));
	let containerRef: HTMLDivElement | null = $state(null);

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
		let startDay = firstDay.getDay() - 1;
		if (startDay < 0) startDay = 6;
		for (let i = 0; i < startDay; i++) days.push(null);
		for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
		return days;
	}

	function isSameDay(a: Date, b: Date): boolean {
		return a.toDateString() === b.toDateString();
	}

	function isToday(date: Date): boolean {
		return isSameDay(date, new Date());
	}

	function selectDate(date: Date) {
		selectedDate = date;
		onDateChange(date);
		showCalendar = false;
	}

	function nextDay() {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() + 1);
		selectDate(d);
	}

	function prevDay() {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() - 1);
		selectDate(d);
	}

	function goToToday() {
		selectDate(new Date());
	}

	// Generating a week-view for the timeline
	const timelineDays = $derived.by(() => {
		const base = new Date(selectedDate);
		const days = [];
		for (let i = -3; i <= 3; i++) {
			const d = new Date(base);
			d.setDate(d.getDate() + i);
			days.push(d);
		}
		return days;
	});

	$effect(() => {
		if (showCalendar) {
			currentMonth = new Date(selectedDate);
		}
	});

	$effect(() => {
		if (!showCalendar || !containerRef) return;
		function handleClickOutside(event: MouseEvent) {
			if (containerRef && !containerRef.contains(event.target as Node)) {
				showCalendar = false;
			}
		}
		const timeoutId = setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 0);
		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="flex flex-col items-center gap-3" bind:this={containerRef}>
	{#if label}
		<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</span>
	{/if}

	<div class="relative flex items-center gap-2">
		<!-- Main Navigation Bar -->
		<div
			class="flex items-center gap-1 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-1.5 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
		>
			<!-- Today / Reset -->
			<button
				type="button"
				onclick={goToToday}
				class={cn(
					'flex size-10 items-center justify-center rounded-xl transition-all duration-300',
					isToday(selectedDate)
						? 'cursor-default bg-slate-800 text-slate-400 opacity-50'
						: 'text-slate-400 hover:bg-slate-800 hover:text-white'
				)}
				title="Dzisiaj"
			>
				<RotateCcw class="size-4" />
			</button>

			<div class="h-6 w-px bg-slate-700/50"></div>

			<!-- Prev Day -->
			<button
				type="button"
				onclick={prevDay}
				class="flex size-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-800 hover:text-white"
			>
				<ChevronLeft class="size-5" />
			</button>

			<!-- Timeline -->
			<div class="flex items-center gap-1 px-1">
				{#each timelineDays as day (day.toDateString())}
					{@const active = isSameDay(day, selectedDate)}
					{@const today = isToday(day)}
					<button
						type="button"
						onclick={() => selectDate(day)}
						class={cn(
							'group relative flex h-14 w-12 flex-col items-center justify-center rounded-xl transition-all duration-300',
							active
								? 'bg-linear-to-br from-violet-600 to-indigo-600 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
								: 'hover:bg-slate-800'
						)}
					>
						<span
							class={cn(
								'text-[10px] font-bold tracking-tight uppercase',
								active ? 'text-violet-100' : 'text-slate-500'
							)}
						>
							{new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(day).replace('.', '')}
						</span>
						<span
							class={cn(
								'mt-1 text-lg leading-none font-bold',
								active ? 'text-white' : 'text-slate-300 group-hover:text-white'
							)}
						>
							{day.getDate()}
						</span>

						{#if today && !active}
							<div class="absolute -bottom-1 size-1 rounded-full bg-violet-400"></div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Next Day -->
			<button
				type="button"
				onclick={nextDay}
				class="flex size-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-800 hover:text-white"
			>
				<ChevronRight class="size-5" />
			</button>

			<div class="h-6 w-px bg-slate-700/50"></div>

			<!-- Full Calendar Toggle -->
			<button
				type="button"
				onclick={() => (showCalendar = !showCalendar)}
				class={cn(
					'flex h-10 items-center gap-2 rounded-xl px-4 transition-all duration-300',
					showCalendar
						? 'bg-violet-500/20 text-violet-400'
						: 'text-slate-400 hover:bg-slate-800 hover:text-white'
				)}
			>
				<CalendarIcon class="size-4" />
				<span class="text-sm font-semibold whitespace-nowrap">
					{new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(
						selectedDate
					)}
				</span>
			</button>
		</div>

		<!-- Date Label (Current Selected Full Date) -->
		<div
			class="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest whitespace-nowrap text-slate-500 uppercase"
		>
			{new Intl.DateTimeFormat('pl-PL', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				weekday: 'long'
			}).format(selectedDate)}
		</div>

		<!-- Calendar Dropdown -->
		{#if showCalendar}
			<div
				transition:fly={{ y: 20, duration: 300, easing: cubicOut }}
				class="absolute top-full right-0 z-50 mt-6 w-80 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl ring-1 shadow-black/80 ring-white/10 backdrop-blur-2xl"
			>
				<!-- Month Header -->
				<div class="mb-4 flex items-center justify-between">
					<button
						type="button"
						onclick={() =>
							(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
						class="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
					>
						<ChevronLeft class="size-5" />
					</button>
					<span class="text-sm font-bold tracking-tight text-white">
						{monthNames[currentMonth.getMonth()].toUpperCase()}
						{currentMonth.getFullYear()}
					</span>
					<button
						type="button"
						onclick={() =>
							(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
						class="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
					>
						<ChevronRight class="size-5" />
					</button>
				</div>

				<!-- Days grid -->
				<div class="mb-2 grid grid-cols-7 gap-1">
					{#each daysOfWeek as day}
						<div class="py-2 text-center text-[10px] font-bold text-slate-500 uppercase">{day}</div>
					{/each}
				</div>

				<div class="grid grid-cols-7 gap-1">
					{#each getDaysInMonth(currentMonth) as day}
						{#if day}
							{@const isSelected = isSameDay(day, selectedDate)}
							{@const currentToday = isToday(day)}
							<button
								type="button"
								onclick={() => selectDate(day)}
								class={cn(
									'relative z-10 rounded-xl py-2.5 text-xs font-bold transition-all duration-200',
									isSelected
										? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
										: currentToday
											? 'bg-slate-800 text-violet-400'
											: 'text-slate-400 hover:bg-slate-800 hover:text-white'
								)}
							>
								{day.getDate()}
								{#if currentToday && !isSelected}
									<div class="absolute top-1 right-1 size-1 rounded-full bg-violet-400"></div>
								{/if}
							</button>
						{:else}
							<div class="py-2.5"></div>
						{/if}
					{/each}
				</div>

				<div class="mt-4 flex gap-2 border-t border-slate-800 pt-4">
					<button
						type="button"
						onclick={goToToday}
						class="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
					>
						DZIŚ
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
