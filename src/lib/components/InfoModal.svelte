<script lang="ts">
	import { X, Info } from 'lucide-svelte';
	import Button from './Button.svelte';

	interface Props {
		isOpen: boolean;
		title: string;
		onClose: () => void;
		children?: import('svelte').Snippet;
	}

	let { isOpen, title, onClose, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="relative w-full max-w-2xl rounded-2xl border border-violet-500/30 bg-slate-900 p-6 shadow-2xl shadow-violet-500/10"
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={onClose}
				class="absolute top-4 right-4 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
			>
				<X class="size-5" />
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4">
				<div
					class="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"
				>
					<Info class="size-6" />
				</div>
				<h3 class="text-xl font-bold text-white">{title}</h3>
			</div>

			<!-- Content -->
			<div class="custom-scrollbar max-h-[70vh] space-y-4 overflow-y-auto text-slate-300">
				{@render children?.()}
			</div>

			<!-- Footer -->
			<div class="mt-8 flex justify-end border-t border-slate-800 pt-4">
				<Button variant="primary" onclick={onClose}>Zamknij</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(30, 41, 59, 0.5);
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(71, 85, 105, 0.8);
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(100, 116, 139, 1);
	}
</style>
