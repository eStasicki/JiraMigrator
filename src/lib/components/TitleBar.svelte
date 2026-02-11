<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { platform } from '@tauri-apps/plugin-os';
	import { X, Minus, Maximize2, Square } from 'lucide-svelte';

	let isHovering = $state(false);
	let isMaximized = $state(false);
	let currentPlatform = $state<string>('macos');

	$effect(() => {
		detectPlatform();
		checkMaximized();
	});

	async function detectPlatform() {
		try {
			currentPlatform = platform();
		} catch {
			currentPlatform = 'macos';
		}
	}

	async function checkMaximized() {
		try {
			const appWindow = getCurrentWindow();
			isMaximized = await appWindow.isMaximized();
		} catch {
			// not in Tauri
		}
	}

	async function handleClose() {
		const appWindow = getCurrentWindow();
		await appWindow.close();
	}

	async function handleMinimize() {
		const appWindow = getCurrentWindow();
		await appWindow.minimize();
	}

	async function handleMaximize() {
		const appWindow = getCurrentWindow();
		await appWindow.toggleMaximize();
		isMaximized = await appWindow.isMaximized();
	}

	const isWindows = $derived(currentPlatform === 'windows');
</script>

<div class="titlebar" class:titlebar-windows={isWindows} data-tauri-drag-region>
	{#if isWindows}
		<!-- Windows: buttons on the right -->
		<div class="win-controls" role="group" aria-label="Window controls">
			<button
				class="win-btn"
				onclick={handleMinimize}
				aria-label="Minimize window"
				title="Minimalizuj"
			>
				<Minus class="win-icon" />
			</button>
			<button
				class="win-btn"
				onclick={handleMaximize}
				aria-label="Maximize window"
				title={isMaximized ? 'Przywróć' : 'Maksymalizuj'}
			>
				{#if isMaximized}
					<Square class="win-icon win-icon-restore" />
				{:else}
					<Square class="win-icon" />
				{/if}
			</button>
			<button
				class="win-btn win-close"
				onclick={handleClose}
				aria-label="Close window"
				title="Zamknij"
			>
				<X class="win-icon" />
			</button>
		</div>
	{:else}
		<!-- macOS: traffic lights on the left -->
		<div
			class="traffic-lights"
			role="group"
			aria-label="Window controls"
			onmouseenter={() => (isHovering = true)}
			onmouseleave={() => (isHovering = false)}
		>
			<button
				class="traffic-btn close"
				onclick={handleClose}
				aria-label="Close window"
				title="Zamknij"
			>
				{#if isHovering}
					<X class="traffic-icon" />
				{/if}
			</button>
			<button
				class="traffic-btn minimize"
				onclick={handleMinimize}
				aria-label="Minimize window"
				title="Minimalizuj"
			>
				{#if isHovering}
					<Minus class="traffic-icon" />
				{/if}
			</button>
			<button
				class="traffic-btn maximize"
				onclick={handleMaximize}
				aria-label="Maximize window"
				title={isMaximized ? 'Przywróć' : 'Maksymalizuj'}
			>
				{#if isHovering}
					<Maximize2 class="traffic-icon" />
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	/* ===== Shared titlebar ===== */
	.titlebar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 38px;
		z-index: 9999;
		display: flex;
		align-items: center;
		padding-left: 14px;
		-webkit-app-region: drag;
		app-region: drag;
		background: transparent;
		user-select: none;
		border-radius: 30px 30px 0 0;
	}

	/* Windows variant: push controls to the right */
	.titlebar-windows {
		padding-left: 0;
		padding-right: 0;
		justify-content: flex-end;
	}

	/* ===== macOS Traffic Lights ===== */
	.traffic-lights {
		display: flex;
		align-items: center;
		gap: 8px;
		-webkit-app-region: no-drag;
		app-region: no-drag;
		padding: 2px;
	}

	.traffic-btn {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		position: relative;
		padding: 0;
	}

	.traffic-btn:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.4);
		outline-offset: 2px;
	}

	.close {
		background: #ff5f57;
		box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12);
	}

	.close:hover {
		background: #ff3b30;
	}

	.close:active {
		background: #bf4942;
	}

	.minimize {
		background: #febc2e;
		box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12);
	}

	.minimize:hover {
		background: #f5a623;
	}

	.minimize:active {
		background: #bf9122;
	}

	.maximize {
		background: #28c840;
		box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12);
	}

	.maximize:hover {
		background: #1aab29;
	}

	.maximize:active {
		background: #1f9a31;
	}

	:global(.traffic-icon) {
		width: 8px;
		height: 8px;
		color: rgba(0, 0, 0, 0.5);
		stroke-width: 2.5;
	}

	:global(.window-blurred) .traffic-btn {
		background: rgba(128, 128, 128, 0.3) !important;
	}

	:global(.window-blurred) .traffic-btn :global(.traffic-icon) {
		display: none;
	}

	/* ===== Windows Controls ===== */
	.win-controls {
		display: flex;
		align-items: stretch;
		height: 100%;
		-webkit-app-region: no-drag;
		app-region: no-drag;
	}

	.win-btn {
		width: 46px;
		height: 100%;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s ease;
		padding: 0;
		color: rgba(255, 255, 255, 0.7);
	}

	.win-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
	}

	.win-btn:active {
		background: rgba(255, 255, 255, 0.04);
	}

	.win-btn:focus-visible {
		outline: 2px solid rgba(139, 92, 246, 0.6);
		outline-offset: -2px;
	}

	/* Windows close button — red on hover */
	.win-close:hover {
		background: #e81123;
		color: white;
	}

	.win-close:active {
		background: #bf0f1d;
	}

	:global(.win-icon) {
		width: 12px;
		height: 12px;
		stroke-width: 1.5;
	}

	:global(.win-icon-restore) {
		width: 11px;
		height: 11px;
	}
</style>
