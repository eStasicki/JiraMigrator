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

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-slate-700"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="bg-slate-800 px-4 text-slate-400">lub</span>
					</div>
				</div>

				<Button
					type="button"
					variant="secondary"
					class="w-full"
					disabled={loading}
					onclick={async () => {
						error = null;
						loading = true;
						const { error: authError } = await authFacade.signInWithGoogle();
						if (authError) {
							error = authError.message;
							loading = false;
						}
						// If successful, the page will redirect to Google
					}}
				>
					<svg class="mr-2 size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Kontynuuj z Google
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
