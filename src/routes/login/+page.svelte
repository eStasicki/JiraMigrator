<script lang="ts">
	import { authFacade } from '$lib/auth/authFacade.svelte';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Card from '$lib/components/Card.svelte';
	import { LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let isSignUp = $state(false);
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function handleSubmit() {
		error = null;
		loading = true;

		const { error: authError } = isSignUp
			? await authFacade.signUp(email, password)
			: await authFacade.signInWithPassword(email, password);

		if (authError) {
			console.error('Login error:', authError);
			error = authError.message;
			loading = false;
		} else {
			console.log('Login success, redirecting...');
			goto('/');
		}
	}
	function handleFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}
</script>

<svelte:head>
	<title>{isSignUp ? 'Rejestracja' : 'Logowanie'} | Jira Migrator</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-500/20"
			>
				<LogIn class="size-6 text-white" />
			</div>
			<h1 class="text-3xl font-bold text-white">
				{isSignUp ? 'Stwórz konto' : 'Witaj z powrotem'}
			</h1>
			<p class="mt-2 text-slate-400">
				{isSignUp
					? 'Zacznij synchronizować swoje projekty w chmurze'
					: 'Zaloguj się, aby zarządzać swoimi migracjami'}
			</p>
		</div>

		<Card title={isSignUp ? 'Rejestracja' : 'Logowanie'}>
			<form onsubmit={handleFormSubmit} class="space-y-4">
				<Input
					id="email"
					label="Login / Email"
					type="text"
					bind:value={email}
					placeholder="estasicki lub email"
					required
				/>
				<Input
					id="password"
					label="Hasło"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
				/>

				{#if error}
					<div class="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
						<AlertCircle class="size-4 shrink-0" />
						<span>{error}</span>
					</div>
				{/if}

				<Button type="submit" variant="primary" class="w-full" disabled={loading}>
					{#if loading}
						<Loader2 class="mr-2 size-4 animate-spin" />
						Przetwarzanie...
					{:else}
						{isSignUp ? 'Zarejestruj się' : 'Zaloguj się'}
					{/if}
				</Button>
			</form>

			<div class="mt-6 text-center text-sm">
				<button
					type="button"
					onclick={() => (isSignUp = !isSignUp)}
					class="text-slate-400 transition-colors hover:text-white"
				>
					{isSignUp ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
				</button>
			</div>
		</Card>

		<div class="mt-8 text-center">
			<a href="/" class="text-sm text-slate-500 transition-colors hover:text-slate-300">
				← Wróć do strony głównej
			</a>
		</div>
	</div>
</div>
