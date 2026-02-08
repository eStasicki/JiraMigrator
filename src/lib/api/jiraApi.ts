/**
 * Jira & Tempo Cloud API client
 */
import { formatSeconds, getLocalDateString } from '$lib/utils';
import { Cache } from './cache';

export interface ConnectionTestResult {
	success: boolean;
	message: string;
	userEmail?: string;
	serverInfo?: string;
}

/**
 * Helper to fetch from Jira/Tempo, optionally via proxy
 */
async function jiraFetch(config: {
	baseUrl: string;
	email: string;
	apiToken: string;
	endpoint: string;
	method?: string;
	body?: any;
	isTempo?: boolean;
	useProxy?: boolean;
}) {
	const { baseUrl, email, apiToken, endpoint, method = 'GET', body, isTempo, useProxy } = config;

	// DEFAULT: Use proxy unless explicitly disabled
	if (useProxy !== false) {
		return fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken,
				endpoint,
				method,
				body,
				isTempo
			})
		});
	}

	// DIRECT FETCH (Browser)
	let targetUrl = '';
	let authHeader = '';

	if (isTempo) {
		const tempoHost = baseUrl.includes('.atlassian.net') ? 'api.eu.tempo.io' : 'api.tempo.io';
		targetUrl = `https://${tempoHost}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
		authHeader = `Bearer ${apiToken}`;
	} else {
		if (!baseUrl) throw new Error('Jira URL is required');
		const normalizedUrl = baseUrl.replace(/\/+$/, '').startsWith('http')
			? baseUrl.replace(/\/+$/, '')
			: `https://${baseUrl.replace(/\/+$/, '')}`;
		const isCloud = normalizedUrl.includes('.atlassian.net');

		let finalEndpoint = endpoint;
		if (!isCloud) {
			// Auto-correct endpoint version for Jira Server/Data Center
			finalEndpoint = endpoint
				.replace('/rest/api/3/search/jql', '/rest/api/2/search')
				.replace('/rest/api/3/', '/rest/api/2/');
		}

		targetUrl = `${normalizedUrl}${finalEndpoint.startsWith('/') ? finalEndpoint : '/' + finalEndpoint}`;
		const sep = targetUrl.includes('?') ? '&' : '?';
		targetUrl = `${targetUrl}${sep}os_authType=basic`;

		if (!isCloud) {
			authHeader = `Bearer ${apiToken}`;
		} else {
			// In browser, use btoa for basic auth
			authHeader = `Basic ${btoa(`${email}:${apiToken}`)}`;
		}
	}

	return fetch(targetUrl, {
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
}

/**
 * Helper to fetch 'myself' with caching
 */
async function getMyself(
	baseUrl: string,
	email: string,
	apiToken: string,
	useProxy: boolean = true
) {
	const cacheKey = `${baseUrl}_${email}_myself`;
	const cached = Cache.getUser(cacheKey);
	if (cached) return cached;

	const res = await jiraFetch({
		baseUrl,
		email,
		apiToken,
		endpoint: '/rest/api/3/myself',
		method: 'GET',
		useProxy
	});

	if (res.ok) {
		const data = await res.json();
		Cache.setUser(cacheKey, data);
		return data;
	}
	return null;
}

/**
 * Fetch issues from Jira Y via Tempo or direct
 * Fetches worklogs from the last 7 days to show parent tasks even if nothing was logged on the selected date
 */
export async function fetchParentsFromJiraY(
	baseUrl: string,
	email: string,
	apiToken: string,
	date: Date,
	tempoToken?: string,
	useProxy: boolean = true
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];

	try {
		const dateStr = getLocalDateString(date);

		// Calculate date range: 7 days before the selected date to the selected date
		const startDate = new Date(date);
		startDate.setDate(startDate.getDate() - 6); // 7 days total (including selected date)
		const startDateStr = getLocalDateString(startDate);

		if (tempoToken && tempoToken.trim() !== '') {
			// Get current user ID for Tempo (cached)
			const userData = await getMyself(baseUrl, email, apiToken, useProxy);
			if (!userData) return [];

			const accountId = userData.accountId;

			// Fetch worklogs from the last 7 days instead of just the selected date
			// Tempo worklogs request is heavy but necessary once
			const tempoRes = await jiraFetch({
				baseUrl,
				email,
				apiToken: tempoToken, // Pass Tempo token as apiToken for the proxy
				isTempo: true,
				endpoint: `/4/worklogs/user/${accountId}?from=${startDateStr}&to=${dateStr}&limit=1000`,
				method: 'GET',
				useProxy
			});

			if (tempoRes.ok) {
				const tempoData = await tempoRes.json();
				const yourWorklogs = tempoData.results || [];

				if (yourWorklogs.length > 0) {
					// Map to track unique issues from the last 7 days
					const issuesMap = new Map();
					const issueIdsToFetch = new Set<string>();

					// First pass: collect all unique issues from the last 7 days
					yourWorklogs.forEach((wl: any) => {
						const issueId = wl.issue?.id;
						if (!issueId) return;

						if (!issuesMap.has(issueId)) {
							issuesMap.set(issueId, {
								id: issueId,
								worklogsForSelectedDate: []
							});
							issueIdsToFetch.add(String(issueId));
						}

						// Only add worklogs from the selected date to the children list
						const worklogDate = wl.startDate; // Tempo uses 'startDate' field (YYYY-MM-DD)
						if (worklogDate === dateStr) {
							const current = issuesMap.get(issueId);
							current.worklogsForSelectedDate.push(wl);
						}
					});

					// --- OPTIMIZATION START: Batch Fetch Issue Details ---
					const issueDetailsMap = new Map<string, any>();
					const idsNeedFetching: string[] = [];

					// Check cache first
					for (const id of issueIdsToFetch) {
						const cachedIssue = Cache.getIssue(id);
						if (cachedIssue) {
							issueDetailsMap.set(id, cachedIssue);
						} else {
							idsNeedFetching.push(id);
						}
					}

					// Fetch missing issues in batches (JQL 'id in (...)')
					if (idsNeedFetching.length > 0) {
						// JQL has a limit on query length, but for 7 days of work usually < 50 issues.
						// Splitting into chunks of 50 just in case.
						const chunkSize = 50;
						for (let i = 0; i < idsNeedFetching.length; i += chunkSize) {
							const chunk = idsNeedFetching.slice(i, i + chunkSize);
							const jql = `id in (${chunk.join(',')})`;

							try {
								const searchRes = await jiraFetch({
									baseUrl,
									email,
									apiToken,
									endpoint: '/rest/api/3/search/jql',
									method: 'POST',
									body: {
										jql,
										fields: ['key', 'summary', 'issuetype', 'status'],
										maxResults: 100
									},
									useProxy
								});

								if (searchRes.ok) {
									const searchData = await searchRes.json();
									(searchData.issues || []).forEach((issue: any) => {
										Cache.setIssue(issue.id, issue); // Cache for future
										issueDetailsMap.set(issue.id, issue);
									});
								}
							} catch (e) {
								console.error('Batch fetch error:', e);
							}
						}
					}
					// --- OPTIMIZATION END ---

					const results: any[] = [];
					const issueIds = Array.from(issuesMap.keys());

					for (const id of issueIds) {
						const info = issuesMap.get(id);
						const issueData = issueDetailsMap.get(String(id));

						if (issueData) {
							// Only create children from worklogs on the selected date
							const children = info.worklogsForSelectedDate.map((wl: any) => ({
								id: wl.tempoWorklogId || wl.id,
								issueKey: issueData.key,
								issueSummary: wl.description || issueData.fields?.summary || 'Brak opisu',
								timeSpentFormatted: formatSeconds(wl.timeSpentSeconds),
								timeSpentSeconds: wl.timeSpentSeconds,
								comment: wl.description || issueData.fields?.summary,
								date: dateStr
							}));

							// Calculate total time only from the selected date
							const totalSecondsForSelectedDate = info.worklogsForSelectedDate.reduce(
								(sum: number, wl: any) => sum + wl.timeSpentSeconds,
								0
							);

							results.push({
								id: String(id),
								issueKey: issueData.key,
								issueSummary: issueData.fields?.summary || 'Brak tytułu',
								type: issueData.fields?.issuetype?.name || 'Task',
								status: issueData.fields?.status?.name || 'Status',
								totalTimeSpentFormatted: formatSeconds(totalSecondsForSelectedDate),
								isExpanded: true,
								children: children
							});
						}
					}
					return results;
				}
			}
		}
		return [];
	} catch (error) {
		console.error('Błąd w fetchParentsFromJiraY:', error);
		return [];
	}
}

/**
 * Fetch worklogs from Jira X
 */
export async function fetchWorklogsFromJiraX(
	baseUrl: string,
	email: string,
	apiToken: string,
	date: Date,
	useProxy: boolean = true
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];
	try {
		const dateStr = getLocalDateString(date);

		// 1. Get current user (cached)
		const myselfData = await getMyself(baseUrl, email, apiToken, useProxy);
		let currentUserAccountId: string | undefined;
		let currentUserName: string | undefined;

		if (myselfData) {
			currentUserAccountId = myselfData.accountId;
			currentUserName = myselfData.name;
		}

		// 2. Search for issues where the user has logged time today
		// We still need to search issues first. JQL is efficient here.
		const jql = `worklogDate = '${dateStr}' AND worklogAuthor = currentUser()`;
		const response = await jiraFetch({
			baseUrl,
			email,
			apiToken,
			endpoint: '/rest/api/3/search/jql',
			method: 'POST',
			body: { jql, fields: ['key', 'summary', 'labels', 'issuetype'], maxResults: 100 },
			useProxy
		});
		const data = await response.json();
		const results: any[] = [];
		const issues = data.issues || [];

		// Prepare parallel fetches for worklogs
		const worklogPromises = issues.map(async (issue: any) => {
			Cache.setIssue(issue.id, issue); // Proactively cache issue details from search result

			const wlRes = await jiraFetch({
				baseUrl,
				email,
				apiToken,
				endpoint: `/rest/api/3/issue/${issue.key}/worklog`,
				method: 'GET',
				useProxy
			});
			if (!wlRes.ok) return [];

			const wlData = await wlRes.json();
			const issueWorklogs: any[] = [];

			(wlData.worklogs || []).forEach((wl: any) => {
				// Filter by date AND author
				const isDateMatch = wl.started.startsWith(dateStr);
				let isAuthorMatch = false;

				// 1. Match by Email
				if (email && wl.author?.emailAddress) {
					if (wl.author.emailAddress.toLowerCase() === email.toLowerCase()) {
						isAuthorMatch = true;
					}
				}
				// 2. Match by AccountId
				if (!isAuthorMatch && currentUserAccountId && wl.author?.accountId) {
					if (wl.author.accountId === currentUserAccountId) {
						isAuthorMatch = true;
					}
				}
				// 3. Match by Name
				if (!isAuthorMatch && currentUserName && wl.author?.name) {
					if (currentUserName === wl.author.name) {
						isAuthorMatch = true;
					}
				}

				if (isDateMatch && isAuthorMatch) {
					issueWorklogs.push({
						id: wl.id,
						issueKey: issue.key,
						issueSummary: issue.fields.summary,
						timeSpentFormatted: formatSeconds(wl.timeSpentSeconds),
						timeSpentSeconds: wl.timeSpentSeconds,
						comment:
							wl.comment?.content?.[0]?.content?.[0]?.text || wl.comment || issue.fields.summary,
						labels: issue.fields.labels || [],
						issueType: issue.fields.issuetype?.name || '',
						date: dateStr
					});
				}
			});

			return issueWorklogs;
		});

		const allWorklogsResults = await Promise.all(worklogPromises);
		allWorklogsResults.forEach((wls) => results.push(...wls));

		return results;
	} catch {
		return [];
	}
}

/**
 * Main Issue Search
 */
export async function searchJiraIssues(
	baseUrl: string,
	email: string,
	apiToken: string,
	query: string,
	useProxy: boolean = true
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];
	if (!query || query.length < 2) return [];

	const cleanQuery = query.trim();

	// Check if we have this exact query cached (unlikely for arbitrary text, but maybe strict key)
	const cachedIssue = Cache.getIssue(cleanQuery);
	if (cachedIssue) {
		// If user typed exact key and we have it, return it immediately as a single result
		return [
			{
				id: cachedIssue.id,
				issueKey: cachedIssue.key,
				issueSummary: cachedIssue.fields?.summary || 'Brak tytułu',
				type: cachedIssue.fields?.issuetype?.name || 'Task',
				status: cachedIssue.fields?.status?.name || 'Status',
				totalTimeSpentFormatted: '0h',
				isExpanded: true,
				children: []
			}
		];
	}

	try {
		// 1. Try JQL Search
		const isIssueKey = /^[a-zA-Z]+-\d+$/.test(cleanQuery);
		let jql = `summary ~ "${cleanQuery}*"`;

		if (isIssueKey) {
			jql = `key = "${cleanQuery}" OR ${jql}`;
		} else {
			jql = `key ~ "${cleanQuery}*" OR ${jql}`;
			if (/^[a-zA-Z0-9]+$/.test(cleanQuery)) {
				jql += ` OR project = "${cleanQuery}"`;
			}
		}

		const response = await jiraFetch({
			baseUrl,
			email,
			apiToken,
			endpoint: '/rest/api/3/search/jql',
			method: 'POST',
			body: {
				jql,
				fields: ['key', 'summary', 'issuetype', 'status'],
				maxResults: 100
			},
			useProxy
		});

		if (response.ok) {
			const data = await response.json();
			if (data.issues && data.issues.length > 0) {
				return data.issues.map((issue: any) => {
					Cache.setIssue(issue.id, issue); // Cache results
					return {
						id: issue.id,
						issueKey: issue.key,
						issueSummary: issue.fields?.summary || 'Brak tytułu',
						type: issue.fields?.issuetype?.name || 'Task',
						status: issue.fields?.status?.name || 'Status',
						totalTimeSpentFormatted: '0h',
						isExpanded: true,
						children: []
					};
				});
			}
		}

		// 2. Fallback to Issue Picker
		const pickerRes = await jiraFetch({
			baseUrl,
			email,
			apiToken,
			endpoint: `/rest/api/3/issue/picker?query=${encodeURIComponent(cleanQuery)}`,
			method: 'GET',
			useProxy
		});

		if (pickerRes.ok) {
			const pickerData = await pickerRes.json();
			const pickerIssues = (pickerData.sections || []).flatMap((s: any) => s.issues || []);
			return pickerIssues.map((issue: any) => ({
				id: issue.id,
				issueKey: issue.key,
				issueSummary: issue.summaryText?.replace(/<[^>]*>?/gm, '') || 'Brak tytułu',
				type: 'Task',
				status: 'Active',
				totalTimeSpentFormatted: '0h',
				isExpanded: true,
				children: []
			}));
		}

		return [];
	} catch (error) {
		console.error('searchJiraIssues error:', error);
		return [];
	}
}

/**
 * Migration Logic - Actual Production Implementation
 */
export async function migrateWorklogsToJiraY(
	baseUrl: string,
	email: string,
	apiToken: string,
	migrations: { parentKey: string; children: any[] }[],
	targetDate: Date,
	tempoToken?: string,
	onProgress?: (progress: {
		current: number;
		total: number;
		percentage: number;
		currentParent: string;
		currentWorklog: string;
		phase: string;
	}) => void,
	useProxy: boolean = true
): Promise<{ success: boolean; migratedCount: number }> {
	let migratedCount = 0;
	const targetDateStr = getLocalDateString(targetDate);

	// Calculate total worklogs
	const totalWorklogs = migrations.reduce((sum, m) => sum + m.children.length, 0);
	let processedWorklogs = 0;

	try {
		// 1. Get Account ID if using Tempo (cached)
		onProgress?.({
			current: 0,
			total: totalWorklogs,
			percentage: 0,
			currentParent: '',
			currentWorklog: '',
			phase: 'Inicjalizacja...'
		});

		let authorAccountId = '';
		if (tempoToken) {
			const myselfData = await getMyself(baseUrl, email, apiToken, useProxy);
			if (myselfData) {
				authorAccountId = myselfData.accountId;
			}
		}

		// 2. Fetch Work Attributes definitions (Reference)
		// TODO: Cache this too if needed, but it's only once per migration session
		let workAttributeDefinitions: any[] = [];
		if (tempoToken) {
			onProgress?.({
				current: 0,
				total: totalWorklogs,
				percentage: 0,
				currentParent: '',
				currentWorklog: '',
				phase: 'Pobieranie atrybutów Tempo...'
			});

			const attrsRes = await jiraFetch({
				baseUrl,
				apiToken: tempoToken,
				email, // Though Tempo might not need it, we pass it for consistency
				isTempo: true,
				endpoint: '/4/work-attributes',
				method: 'GET',
				useProxy
			});

			if (attrsRes.ok) {
				const attrsData = await attrsRes.json();
				workAttributeDefinitions = attrsData.results || [];
			}
		}

		for (const migration of migrations) {
			// Resolve Issue ID and Summary for Tempo (required instead of Key)
			let issueIdForTempo: number | undefined;
			let parentSummary = '';

			onProgress?.({
				current: processedWorklogs,
				total: totalWorklogs,
				percentage: Math.round((processedWorklogs / totalWorklogs) * 100),
				currentParent: migration.parentKey,
				currentWorklog: '',
				phase: `Przygotowanie zadania ${migration.parentKey}...`
			});

			if (tempoToken) {
				// Optimization: Check cache first for parent details
				let issueData = Cache.getIssue(migration.parentKey);

				// Try to find issue by key if ID fails
				if (!issueData) {
					try {
						const issueRes = await jiraFetch({
							baseUrl,
							email,
							apiToken,
							endpoint: `/rest/api/2/issue/${migration.parentKey}`,
							method: 'GET',
							useProxy
						});
						if (issueRes.ok) {
							issueData = await issueRes.json();
							Cache.setIssue(migration.parentKey, issueData);
						}
					} catch (e) {
						console.error(e);
					}
				}

				if (issueData) {
					issueIdForTempo = Number(issueData.id);
					parentSummary = issueData.fields?.summary || '';
				}
			}

			// Prepare Attributes Payload for this specific parent
			const attributesForThisMigration: any[] = [];
			if (tempoToken && workAttributeDefinitions.length > 0) {
				workAttributeDefinitions.forEach((attr: any) => {
					if (attr.required) {
						let valueToSend = 'Dev'; // Fallback
						// Logic for Category based on Parent Summary
						const isCategory = attr.name === 'Category' || attr.key === '_Category_';

						if (isCategory && attr.values) {
							const summaryLower = parentSummary.toLowerCase();
							if (
								summaryLower.includes('development') ||
								summaryLower.includes('coding') ||
								summaryLower.includes('dev')
							) {
								if (attr.values.includes('Coding')) valueToSend = 'Coding';
								else if (attr.values.includes('Development')) valueToSend = 'Development';
							} else if (
								summaryLower.includes('communication') ||
								summaryLower.includes('management')
							) {
								if (attr.values.includes('Communication & Management'))
									valueToSend = 'Communication & Management';
								else if (attr.values.includes('Communication')) valueToSend = 'Communication';
							} else {
								// Default fallback if no match
								if (attr.values.length > 0) valueToSend = attr.values[0];
							}
						} else {
							// Generic required attribute
							if (attr.values && attr.values.length > 0) valueToSend = attr.values[0];
						}

						attributesForThisMigration.push({
							key: attr.key,
							value: valueToSend
						});
					}
				});
			}

			for (const worklog of migration.children) {
				processedWorklogs++;
				const percentage = Math.round((processedWorklogs / totalWorklogs) * 100);

				onProgress?.({
					current: processedWorklogs,
					total: totalWorklogs,
					percentage,
					currentParent: migration.parentKey,
					currentWorklog: `${worklog.issueKey} - ${worklog.timeSpentFormatted}`,
					phase: 'Migrowanie worklogów...'
				});

				let response;

				if (tempoToken && authorAccountId && issueIdForTempo) {
					// TEMPO MIGRATION - Use targetDate from calendar
					response = await jiraFetch({
						baseUrl,
						apiToken: tempoToken,
						email,
						isTempo: true,
						endpoint: '/4/worklogs',
						method: 'POST',
						body: {
							issueId: issueIdForTempo,
							timeSpentSeconds: worklog.timeSpentSeconds,
							startDate: targetDateStr, // Use date from calendar
							startTime: '09:00:00',
							description: `[${worklog.issueKey}] ${worklog.comment || worklog.issueSummary}`,
							authorAccountId: authorAccountId,
							attributes:
								attributesForThisMigration.length > 0 ? attributesForThisMigration : undefined
						},
						useProxy
					});
				} else {
					// NATIVE JIRA - Use targetDate from calendar
					response = await jiraFetch({
						baseUrl,
						email,
						apiToken,
						endpoint: `/rest/api/2/issue/${migration.parentKey}/worklog?adjustEstimate=leave`,
						method: 'POST',
						body: {
							timeSpentSeconds: worklog.timeSpentSeconds,
							started: `${targetDateStr}T09:00:00.000+0000`, // Use date from calendar
							comment: `[${worklog.issueKey}] ${worklog.comment || worklog.issueSummary}`
						},
						useProxy
					});
				}

				if (response?.ok) {
					migratedCount++;
				} else {
					if (response) {
						console.error('Migration failed:', await response.text());
					}
				}
			}
		}

		onProgress?.({
			current: totalWorklogs,
			total: totalWorklogs,
			percentage: 100,
			currentParent: '',
			currentWorklog: '',
			phase: 'Zakończono!'
		});

		return { success: migratedCount > 0, migratedCount };
	} catch (error) {
		console.error('Migration error:', error);
		return { success: false, migratedCount };
	}
}

export async function testConnectionToJira(
	baseUrl: string,
	email: string,
	apiToken: string,
	useProxy: boolean = true
): Promise<ConnectionTestResult> {
	if (useProxy === false) {
		try {
			// Direct browser test
			const res = await jiraFetch({
				baseUrl,
				email,
				apiToken,
				endpoint: '/rest/api/2/myself',
				method: 'GET',
				useProxy: false
			});
			if (res.ok) {
				const data = await res.json();
				return {
					success: true,
					message: 'Połączenie bezpośrednie nawiązane!',
					userEmail: data.emailAddress || data.name,
					serverInfo: `Zalogowano jako: ${data.displayName || data.name}`
				};
			} else {
				return {
					success: false,
					message: `Błąd połączenia bezpośredniego (${res.status})`
				};
			}
		} catch (err: any) {
			return {
				success: false,
				message: `Błąd CORS lub sieciowy: ${err.message}. Upewnij się, że Jira pozwala na połączenia z tego adresu.`
			};
		}
	}

	try {
		const r = await fetch('/api/test-connection', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl, email, apiToken, useProxy })
		});
		return await r.json();
	} catch {
		return { success: false, message: 'Błąd połączenia (serwer proxy)' };
	}
}

export async function testConnectionToTempo(
	baseUrl: string,
	tempoToken: string,
	useProxy: boolean = true
): Promise<ConnectionTestResult> {
	if (useProxy === false) {
		try {
			// Direct browser test
			const res = await jiraFetch({
				baseUrl,
				email: '',
				apiToken: tempoToken,
				endpoint: '/4/worklogs?limit=1',
				isTempo: true,
				useProxy: false
			});
			if (res.ok) {
				return {
					success: true,
					message: 'Połączenie bezpośrednie z Tempo nawiązane!'
				};
			} else {
				return {
					success: false,
					message: `Błąd Tempo (${res.status})`
				};
			}
		} catch (err: any) {
			return {
				success: false,
				message: `Błąd CORS lub sieciowy Tempo: ${err.message}`
			};
		}
	}

	try {
		const r = await fetch('/api/test-connection', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl, apiToken: tempoToken, type: 'tempo', useProxy })
		});
		return await r.json();
	} catch {
		return { success: false, message: 'Błąd połączenia z Tempo (serwer proxy)' };
	}
}
export async function deleteWorklogInJiraY(
	baseUrl: string,
	email: string,
	apiToken: string,
	worklogId: string,
	issueKeyOrId?: string, // Required for native Jira
	tempoToken?: string,
	useProxy: boolean = true
): Promise<boolean> {
	try {
		const isTempo = !!tempoToken;
		const endpoint = isTempo
			? `/4/worklogs/${worklogId}`
			: `/rest/api/2/issue/${issueKeyOrId}/worklog/${worklogId}`;

		const response = await jiraFetch({
			baseUrl,
			email,
			apiToken: isTempo ? tempoToken : apiToken,
			isTempo,
			endpoint,
			method: 'DELETE',
			useProxy
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[JiraApi] Delete failed (${response.status}):`, errorText);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Delete worklog error:', error);
		return false;
	}
}

export async function checkTempoPeriodStatus(
	baseUrl: string,
	email: string,
	apiToken: string,
	date: Date,
	tempoToken: string,
	useProxy: boolean = true
): Promise<{ isLocked: boolean; status: string }> {
	if (!tempoToken) return { isLocked: false, status: 'OPEN' };

	try {
		// dateStr variable removed as it was unused
		const myselfData = await getMyself(baseUrl, email, apiToken, useProxy);
		if (!myselfData) return { isLocked: false, status: 'UNKNOWN' };

		const accountId = myselfData.accountId;

		// Check approvals for the specific date
		const response = await jiraFetch({
			baseUrl,
			apiToken: tempoToken,
			email,
			isTempo: true,
			// Fetch approvals specifically for the month of the selected date
			endpoint: `/4/timesheet-approvals/user/${accountId}?from=${getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1))}&to=${getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0))}`,
			method: 'GET',
			useProxy
		});

		if (response.ok) {
			const data = await response.json();
			let results: any[] = [];

			if (Array.isArray(data.results)) {
				results = data.results;
			} else if (data.period && data.status) {
				// Single period response directly in root
				results = [data];
			} else if (Array.isArray(data)) {
				// Sometimes might be direct array, though unlikely for this endpoint
				results = data;
			}

			// Check if any approval period covers the target date
			const targetDateStr = getLocalDateString(date);
			const relevantApproval = results.find((a: any) => {
				const from = a.period?.from;
				const to = a.period?.to;
				// Log each period check
				// console.log(`Checking period: ${from} - ${to} against ${targetDateStr}`);
				if (from && to) {
					return targetDateStr >= from && targetDateStr <= to;
				}
				return false;
			});

			if (relevantApproval) {
				// Check status
				const statusKey = relevantApproval.status?.key || relevantApproval.status;
				const status = (typeof statusKey === 'string' ? statusKey : 'OPEN').toUpperCase();
				const lockedStatuses = ['SUBMITTED', 'APPROVED', 'CLOSED'];

				if (lockedStatuses.includes(status)) {
					return { isLocked: true, status };
				} else {
					// Even if open, return status
					return { isLocked: false, status };
				}
			} else {
				// console.log('[checkTempoPeriodStatus] No relevant approval found for date:', targetDateStr);
			}
		} else {
			console.error('[checkTempoPeriodStatus] API Error:', response.status, await response.text());
		}

		return { isLocked: false, status: 'OPEN' };
	} catch (error) {
		console.error('Check period status error:', error);
		return { isLocked: false, status: 'ERROR' };
	}
}

// function checkTempoPeriodAttributes() has been removed as it was unused and empty.
