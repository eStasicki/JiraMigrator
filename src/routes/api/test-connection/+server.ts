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
		let { baseUrl, email, apiToken, type = 'jira' } = await request.json();

		baseUrl = baseUrl?.trim();
		email = email?.trim();
		apiToken = apiToken?.trim()?.replace(/^["'\[]+|["'\]]+$/g, '');

		if (!baseUrl || !apiToken) {
			return json({
				success: false,
				message: 'URL i Token są wymagane'
			} satisfies ConnectionTestResult);
		}

		if (type === 'tempo') {
			// TEST TEMPO CONNECTION
			// We try to hit the /worklogs endpoint with a limit of 1
			const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
			const testUrl = `https://${tempoHost}/4/worklogs?limit=1`;

			console.log(`=== TEMPO CONNECTION TEST (${tempoHost}) ===`);

			const response = await fetch(testUrl, {
				method: 'GET',
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
				} satisfies ConnectionTestResult);
			} else {
				const status = response.status;
				let msg = `Błąd Tempo (${status})`;
				if (status === 401) msg = 'Nieprawidłowy Tempo API Token';
				if (status === 403) msg = 'Token nie ma uprawnień (potrzebny Full Access)';

				return json({
					success: false,
					message: msg
				} satisfies ConnectionTestResult);
			}
		} else {
			// TEST JIRA CONNECTION
			const normalizedUrl = baseUrl.replace(/\/+$/, '');
			const credentials = `${email}:${apiToken}`;
			const authString = Buffer.from(credentials).toString('base64');
			const jiraUrl = `${normalizedUrl}/rest/api/3/myself`;

			console.log('=== JIRA CONNECTION TEST ===');

			const response = await fetch(jiraUrl, {
				method: 'GET',
				headers: {
					Authorization: `Basic ${authString}`,
					Accept: 'application/json'
				}
			});

			if (response.ok) {
				const user = await response.json();
				return json({
					success: true,
					message: 'Połączenie z Jirą nawiązane!',
					userEmail: user.emailAddress || email,
					serverInfo: `Zalogowano jako: ${user.displayName}`
				} satisfies ConnectionTestResult);
			}

			return json({
				success: false,
				message: `Błąd Jiry (${response.status})`
			} satisfies ConnectionTestResult);
		}
	} catch (error) {
		console.error('Connection test error:', error);
		return json({
			success: false,
			message: `Błąd połączenia: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
		} satisfies ConnectionTestResult);
	}
};
