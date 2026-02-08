import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseServerClient } from '$lib/supabase';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const supabase = getSupabaseServerClient(event);
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		return json({ error: 'Nieautoryzowany dostęp' }, { status: 401 });
	}

	try {
		const {
			baseUrl,
			email,
			apiToken,
			endpoint,
			method = 'GET',
			body,
			isTempo = false,
			authType
		} = await request.json();

		let targetUrl = '';
		let authHeader = '';

		if (isTempo) {
			// Tempo Cloud API
			const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
			targetUrl = `https://${tempoHost}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
			authHeader = `Bearer ${apiToken}`;
		} else {
			// Standard Jira API
			if (!baseUrl) {
				return json({ error: 'URL Jiry jest wymagany' }, { status: 400 });
			}
			const normalizedUrl = baseUrl.replace(/\/+$/, '').startsWith('http')
				? baseUrl.replace(/\/+$/, '')
				: `https://${baseUrl.replace(/\/+$/, '')}`;
			const isCloud = normalizedUrl.includes('.atlassian.net');

			// Auto-correct endpoint version for Jira Server/Data Center
			let finalEndpoint = endpoint;
			if (!isCloud) {
				finalEndpoint = endpoint
					.replace('/rest/api/3/search/jql', '/rest/api/2/search')
					.replace('/rest/api/3/', '/rest/api/2/');
			}

			targetUrl = `${normalizedUrl}${finalEndpoint.startsWith('/') ? finalEndpoint : '/' + finalEndpoint}`;
			const sep = targetUrl.includes('?') ? '&' : '?';
			targetUrl = `${targetUrl}${sep}os_authType=basic`;

			const token = apiToken.trim();

			if (token.startsWith('Basic ') || token.startsWith('Bearer ')) {
				authHeader = token;
			} else if (authType === 'basic') {
				authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
			} else if (authType === 'bearer') {
				authHeader = `Bearer ${token}`;
			} else {
				// Fallback
				if (!isCloud) {
					authHeader = `Bearer ${token}`;
				} else {
					authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
				}
			}

			console.log(
				`[Proxy] Target: ${targetUrl.substring(0, 50)}..., Strategy: ${authHeader.split(' ')[0]}`
			);
		}

		const response = await fetch(targetUrl, {
			method,
			headers: {
				Authorization: authHeader,
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'X-Atlassian-Token': 'nocheck',
				'X-Tempo-Api-Key': isTempo ? apiToken : ''
			},
			body: body ? JSON.stringify(body) : undefined
		});

		if (response.status === 204) {
			return new Response(null, { status: 204 });
		}

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (error: any) {
		console.error('Proxy error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
