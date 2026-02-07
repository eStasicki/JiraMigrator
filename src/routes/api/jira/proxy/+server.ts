import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const {
			baseUrl,
			email,
			apiToken,
			endpoint,
			method = 'GET',
			body,
			isTempo = false
		} = await request.json();

		let targetUrl = '';
		let authHeader = '';

		if (isTempo) {
			// Tempo Cloud API - EU Instance focused (based on user's DevTools observation)
			// We try api.eu.tempo.io for EU customers
			const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
			targetUrl = `https://${tempoHost}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
			authHeader = `Bearer ${apiToken}`;
		} else {
			// standard Jira API
			if (!baseUrl || !baseUrl.startsWith('http')) {
				return json({ error: 'Nieprawidłowy URL Jiry' }, { status: 400 });
			}
			const normalizedUrl = baseUrl.replace(/\/+$/, '');
			const isCloud = normalizedUrl.includes('.atlassian.net');

			// Auto-correct endpoint version for Jira Server/Data Center
			let finalEndpoint = endpoint;
			if (!isCloud) {
				// Server/DC uses v2 and doesn't have /jql suffix for search
				finalEndpoint = endpoint
					.replace('/rest/api/3/search/jql', '/rest/api/2/search')
					.replace('/rest/api/3/', '/rest/api/2/');
			}

			targetUrl = `${normalizedUrl}${finalEndpoint.startsWith('/') ? finalEndpoint : '/' + finalEndpoint}`;
			const sep = targetUrl.includes('?') ? '&' : '?';
			targetUrl = `${targetUrl}${sep}os_authType=basic`;

			// For non-Cloud Jira (Server/DC), we use Bearer auth (PAT) which proved successful.
			// For Cloud, we stick to Basic (email:token).
			if (!isCloud) {
				authHeader = `Bearer ${apiToken}`;
			} else {
				authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`, 'latin1').toString('base64')}`;
			}
		}

		const response = await fetch(targetUrl, {
			method,
			headers: {
				Authorization: authHeader,
				Accept: 'application/json',
				'Content-Type': 'application/json',
				// Some Tempo endpoints might need this
				'X-Tempo-Api-Key': isTempo ? apiToken : ''
			},
			body: body ? JSON.stringify(body) : undefined
		});

		// Special handling for 204 No Content - must not have a body
		if (response.status === 204) {
			return new Response(null, { status: 204 });
		}

		const text = await response.text();
		let data;
		try {
			data = text ? JSON.parse(text) : {};
		} catch {
			data = { message: text };
		}

		return json(data, { status: response.status });
	} catch (error: any) {
		console.error('Proxy error:', error);
		return json({ error: 'Błąd proxy', details: error?.message }, { status: 500 });
	}
};
