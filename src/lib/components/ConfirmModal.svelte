<script lang="ts">
	import { X, AlertTriangle } from 'lucide-svelte';
	import Button from './Button.svelte';

	interface Props {
		isOpen: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'danger' | 'warning';
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		isOpen,
		title,
		message,
		confirmLabel = 'Potwierdź',
		cancelLabel = 'Anuluj',
		variant = 'danger',
		onConfirm,
		onCancel
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onCancel();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="relative w-full max-w-md rounded-2xl border bg-slate-900 p-6 shadow-2xl
				{variant === 'danger' ? 'border-red-500/30' : 'border-amber-500/30'}"
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={() => onCancel()}
				class="absolute top-4 right-4 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
			>
				<X class="size-5" />
			</button>

			<!-- Icon -->
			<div class="mb-4 flex justify-center">
				<div
					class="flex size-16 items-center justify-center rounded-full
						{variant === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20'}"
				>
					<AlertTriangle
						class="size-8 {variant === 'danger' ? 'text-red-400' : 'text-amber-400'}"
					/>
				</div>
			</div>

			<!-- Content -->
			<div class="text-center">
				<h3 class="mb-2 text-xl font-bold text-white">{title}</h3>
				<p class="text-slate-400">{message}</p>
			</div>

			<!-- Actions -->
			<div class="mt-6 flex gap-3">
				<Button variant="secondary" onclick={() => onCancel()} class="flex-1">
					{cancelLabel}
				</Button>
				<Button
					variant={variant === 'danger' ? 'danger' : 'primary'}
					onclick={() => onConfirm()}
					class="flex-1"
				>
					{confirmLabel}
				</Button>
			</div>
		</div>
	</div>
{/if}
