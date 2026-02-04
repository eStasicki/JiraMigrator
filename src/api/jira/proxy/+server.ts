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
			// Tempo API Cloud
			targetUrl = `https://api.tempo.io/4${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
			authHeader = `Bearer ${apiToken}`;
		} else {
			// Standard Jira API
			if (!baseUrl || !baseUrl.startsWith('http')) {
				return json({ error: 'Nieprawidłowy adres URL Jiry' }, { status: 400 });
			}
			const normalizedUrl = baseUrl.replace(/\/+$/, '');
			targetUrl = `${normalizedUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
			authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
		}

		targetUrl = targetUrl.replace(/\s/g, '%20');
		console.log(`[Proxy] ${method} ${targetUrl} (Tempo: ${isTempo})`);

		const response = await fetch(targetUrl, {
			method,
			headers: {
				Authorization: authHeader,
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: body ? JSON.stringify(body) : undefined
		});

		const text = await response.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			data = { message: text };
		}

		return json(data, { status: response.status });
	} catch (error) {
		console.error('Proxy error:', error);
		return json({ error: 'Błąd serwera proxy' }, { status: 500 });
	}
};
