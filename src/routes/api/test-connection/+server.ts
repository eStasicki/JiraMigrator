import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseServerClient } from '$lib/supabase';

export interface ConnectionTestResult {
	success: boolean;
	message: string;
	userEmail?: string;
	serverInfo?: string;
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const supabase = getSupabaseServerClient(event);
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		return json({ success: false, message: 'Nieautoryzowany dostęp' }, { status: 401 });
	}

	try {
		const data = await request.json();
		let { baseUrl, email } = data;
		const { apiToken, type = 'jira' } = data;

		baseUrl = baseUrl?.trim()?.replace(/\/+$/, '');
		if (baseUrl && !baseUrl.startsWith('http')) {
			baseUrl = `https://${baseUrl}`;
		}
		email = email?.trim();

		if (!baseUrl || !apiToken) {
			return json({ success: false, message: 'URL i Token są wymagane' });
		}

		// Security/Reachability check
		const isLocal =
			baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.endsWith('.local');
		if (isLocal) {
			return json({
				success: false,
				message:
					'Błąd: Adres lokalny (.local / localhost) nie jest dostępny z serwera Vercel. Jira musi być dostępna publicznie.'
			});
		}

		const fetchWithTimeout = async (url: string, options: any) => {
			const controller = new AbortController();
			const timeoutLabel = setTimeout(() => controller.abort(), 8000); // 8 second timeout
			try {
				return await fetch(url, { ...options, signal: controller.signal });
			} finally {
				clearTimeout(timeoutLabel);
			}
		};

		if (type === 'tempo') {
			// TEST TEMPO CONNECTION
			const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
			const testUrl = `https://${tempoHost}/4/worklogs?limit=1`;

			try {
				const response = await fetchWithTimeout(testUrl, {
					headers: {
						Authorization: `Bearer ${apiToken}`,
						Accept: 'application/json',
						'User-Agent': 'JiraMigrator/1.0'
					}
				});

				if (response.ok) {
					return json({
						success: true,
						message: 'Połączenie z Tempo nawiązane!',
						serverInfo: `Host: ${tempoHost} (v4)`
					});
				} else {
					const status = response.status;
					let msg = `Błąd Tempo (${status})`;
					if (status === 401) msg = 'Nieprawidłowy Tempo API Token';
					if (status === 403) msg = 'Token nie ma uprawnień (potrzebny Full Access)';

					return json({ success: false, message: msg });
				}
			} catch (err: any) {
				const isTimeout = err.name === 'AbortError';
				return json({
					success: false,
					message: isTimeout
						? 'Timeout: Tempo nie odpowiada (sprawdź połączenie internetowe)'
						: `Błąd Tempo: ${err.message}`
				});
			}
		} else {
			// TEST JIRA CONNECTION
			const testEndpoints = [`${baseUrl}/rest/api/2/myself`, `${baseUrl}/rest/api/2/serverInfo`];

			const isCloud = baseUrl.includes('.atlassian.net');

			// For Cloud, we primarily use Basic. For Server, we can try both or follow authType.
			const strategies = [];

			if (data.authType === 'basic') {
				strategies.push({
					name: 'Basic (Forced)',
					header: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
				});
			} else if (data.authType === 'bearer') {
				strategies.push({ name: 'Bearer (Forced)', header: `Bearer ${apiToken}` });
			} else {
				// Original auto-detection logic
				if (isCloud) {
					strategies.push({
						name: 'Basic (Email:Token)',
						header: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
					});
				} else {
					strategies.push({ name: 'Bearer (PAT)', header: `Bearer ${apiToken}` });
					strategies.push({
						name: 'Basic (Email:Token)',
						header: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
					});
				}
			}

			let lastError = '';
			let lastStatus = 0;

			for (const strategy of strategies) {
				for (const endpoint of testEndpoints) {
					const url = `${endpoint}?os_authType=basic`;
					try {
						const response = await fetchWithTimeout(url, {
							method: 'GET',
							headers: {
								Authorization: strategy.header,
								Accept: 'application/json',
								'X-Atlassian-Token': 'nocheck',
								'User-Agent': 'JiraMigrator/1.0'
							},
							redirect: 'follow'
						});

						lastStatus = response.status;

						if (response.ok) {
							const result = await response.json();
							return json({
								success: true,
								message: `Połączenie nawiązane (${strategy.name})!`,
								userEmail: result.emailAddress || result.name || email,
								serverInfo: `Zalogowano jako: ${result.displayName || result.name || result.serverTitle || 'Użytkownik'}`
							});
						} else {
							const text = await response.text();
							lastError = `Status ${response.status}: ${text.substring(0, 50)}`;
						}
					} catch (err: any) {
						if (err.name === 'AbortError') {
							lastError = 'Timeout (host nieosiągalny z Vercel)';
						} else {
							lastError = err.message;
						}
						console.error(`Fetch error to ${url}: ${err.message}`);
					}
				}
			}

			let errorMsg = `Błąd połączenia: ${lastError || `Status ${lastStatus}`}`;
			if (lastStatus === 401) {
				errorMsg = 'Błąd 401: Nieautoryzowany. Sprawdź czy token i email są poprawne.';
			} else if (lastStatus === 403) {
				errorMsg = 'Błąd 403: Brak uprawnień. Upewnij się, że token ma dostęp do API.';
			} else if (lastError.includes('enotfound') || lastError.includes('econnrefused')) {
				errorMsg =
					'Błąd: Nie można znaleźć serwera Jira. Upewnij się, że URL jest publicznie dostępny.';
			}

			return json({ success: false, message: errorMsg, serverInfo: lastError });
		}
	} catch (error) {
		console.error('Connection test error:', error);
		return json({
			success: false,
			message: `Błąd systemowy: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
		} satisfies ConnectionTestResult);
	}
};
