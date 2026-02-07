import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface ConnectionTestResult {
	success: boolean;
	message: string;
	userEmail?: string;
	serverInfo?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		let { baseUrl, email } = data;
		const { apiToken, type = 'jira' } = data;

		baseUrl = baseUrl?.trim()?.replace(/\/+$/, '');
		email = email?.trim();

		if (!baseUrl || !apiToken) {
			return json({ success: false, message: 'URL i Token są wymagane' });
		}

		if (type === 'tempo') {
			// TEST TEMPO CONNECTION
			// We try to hit the /worklogs endpoint with a limit of 1
			const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
			const testUrl = `https://${tempoHost}/4/worklogs?limit=1`;

			const response = await fetch(testUrl, {
				headers: {
					Authorization: `Bearer ${apiToken}`,
					Accept: 'application/json'
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

				return json({
					success: false,
					message: msg
				});
			}
		} else {
			// TEST JIRA CONNECTION
			const testEndpoints = [
				`${baseUrl}/rest/api/2/myself?os_authType=basic`,
				`${baseUrl}/rest/api/2/serverInfo?os_authType=basic`
			];

			// Try Bearer (PAT) first as it worked in the user's curl, then Basic
			const strategies = [
				{ name: 'Bearer (PAT)', header: `Bearer ${apiToken}` },
				{
					name: 'Basic (Email:Token)',
					header: `Basic ${Buffer.from(`${email}:${apiToken}`, 'latin1').toString('base64')}`
				}
			];

			let lastStatus = 401;

			for (const strategy of strategies) {
				for (const endpoint of testEndpoints) {
					try {
						const response = await fetch(endpoint, {
							method: 'GET',
							headers: {
								Authorization: strategy.header,
								Accept: 'application/json',
								'X-Atlassian-Token': 'nocheck',
								'X-Requested-With': 'XMLHttpRequest'
							},
							redirect: 'manual'
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
						}
					} catch (err: any) {
						console.error(`Error: ${err.message}`);
					}
				}
			}

			let errorMsg = `Błąd Jiry (${lastStatus})`;
			if (lastStatus === 401) {
				errorMsg =
					'Błąd 401: Nieautoryzowany. Sprawdź czy token jest poprawny (spróbuj wygenerować nowy PAT w Jirze).';
			}

			return json({ success: false, message: errorMsg });
		}
	} catch (error) {
		console.error('Connection test error:', error);
		return json({
			success: false,
			message: `Błąd połączenia: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
		} satisfies ConnectionTestResult);
	}
};
