/**
 * Jira & Tempo Cloud API client
 */
import { formatSeconds, getLocalDateString } from '$lib/utils';

export interface ConnectionTestResult {
	success: boolean;
	message: string;
	userEmail?: string;
	serverInfo?: string;
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
	tempoToken?: string
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];

	try {
		const dateStr = getLocalDateString(date);

		// Calculate date range: 7 days before the selected date to the selected date
		const startDate = new Date(date);
		startDate.setDate(startDate.getDate() - 6); // 7 days total (including selected date)
		const startDateStr = getLocalDateString(startDate);

		if (tempoToken && tempoToken.trim() !== '') {
			// Get current user ID for Tempo
			const myselfRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					email,
					apiToken,
					endpoint: '/rest/api/3/myself',
					method: 'GET'
				})
			});

			if (!myselfRes.ok) return [];

			const userData = await myselfRes.json();
			const accountId = userData.accountId;

			// Fetch worklogs from the last 7 days instead of just the selected date
			const tempoRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					email,
					apiToken: tempoToken, // Pass Tempo token as apiToken for the proxy
					isTempo: true,
					endpoint: `/4/worklogs/user/${accountId}?from=${startDateStr}&to=${dateStr}&limit=1000`,
					method: 'GET'
				})
			});

			if (tempoRes.ok) {
				const tempoData = await tempoRes.json();
				const yourWorklogs = tempoData.results || [];

				if (yourWorklogs.length > 0) {
					// Map to track unique issues from the last 7 days
					const issuesMap = new Map();

					// First pass: collect all unique issues from the last 7 days
					yourWorklogs.forEach((wl: any) => {
						const issueId = wl.issue?.id;
						if (!issueId) return;

						if (!issuesMap.has(issueId)) {
							issuesMap.set(issueId, {
								id: issueId,
								worklogsForSelectedDate: []
							});
						}

						// Only add worklogs from the selected date to the children list
						const worklogDate = wl.startDate; // Tempo uses 'startDate' field (YYYY-MM-DD)
						if (worklogDate === dateStr) {
							const current = issuesMap.get(issueId);
							current.worklogsForSelectedDate.push(wl);
						}
					});

					const results: any[] = [];
					const issueIds = Array.from(issuesMap.keys());

					for (const id of issueIds) {
						try {
							const jiraRes = await fetch('/api/jira/proxy', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									baseUrl,
									email,
									apiToken,
									endpoint: `/rest/api/2/issue/${id}`,
									method: 'GET'
								})
							});

							const info = issuesMap.get(id);

							if (jiraRes.ok) {
								const issueData = await jiraRes.json();

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
									id: id,
									issueKey: issueData.key,
									issueSummary: issueData.fields?.summary || 'Brak tytułu',
									type: issueData.fields?.issuetype?.name || 'Task',
									status: issueData.fields?.status?.name || 'Status',
									totalTimeSpentFormatted: formatSeconds(totalSecondsForSelectedDate),
									isExpanded: true,
									children: children
								});
							}
						} catch (e) {
							console.error(`Error fetching issue ${id}:`, e);
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
	date: Date
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];
	try {
		const dateStr = getLocalDateString(date);

		// 1. Get current user's accountId to filter worklogs strictly
		const myselfRes = await fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken,
				endpoint: '/rest/api/3/myself',
				method: 'GET'
			})
		});

		let currentUserAccountId: string | undefined;
		let currentUserName: string | undefined;
		if (myselfRes.ok) {
			const myselfData = await myselfRes.json();
			currentUserAccountId = myselfData.accountId;
			currentUserName = myselfData.name;
		}

		// 2. Search for issues where the user has logged time today
		const jql = `worklogDate = '${dateStr}' AND worklogAuthor = currentUser()`;
		const response = await fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken,
				endpoint: '/rest/api/3/search/jql',
				method: 'POST',
				body: { jql, fields: ['key', 'summary', 'labels', 'issuetype'], maxResults: 100 }
			})
		});
		const data = await response.json();
		const results: any[] = [];
		for (const issue of data.issues || []) {
			const wlRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					email,
					apiToken,
					endpoint: `/rest/api/3/issue/${issue.key}/worklog`,
					method: 'GET'
				})
			});
			if (!wlRes.ok) continue;
			const wlData = await wlRes.json();
			(wlData.worklogs || []).forEach((wl: any) => {
				// Filter by date AND author
				// Check strict date match (string prefix YYYY-MM-DD)
				const isDateMatch = wl.started.startsWith(dateStr);

				// Check author match
				let isAuthorMatch = false;

				// 1. Match by Email (Server/DC/App.js logic)
				if (email && wl.author?.emailAddress) {
					if (wl.author.emailAddress.toLowerCase() === email.toLowerCase()) {
						isAuthorMatch = true;
					}
				}

				// 2. Match by AccountId (Cloud logic)
				if (!isAuthorMatch && currentUserAccountId && wl.author?.accountId) {
					if (wl.author.accountId === currentUserAccountId) {
						isAuthorMatch = true;
					}
				}

				// 3. Match by Display Name/Self (Fallback for really old servers or weird proxies)
				// If we haven't matched yet, and we are desperate...
				// However, defaulting to 'true' caused the bug of showing other's worklogs.
				// optimizing: if JQL worked correctly with 'currentUser()', we should theoretically only see our worklogs.
				// But if JQL returned an issue where *multiple* people logged time (common), fetching /worklog returns ALL worklogs.
				// We MUST filter strictly. If neither Email nor ID matches, we skip.

				// 4. Special case: If user provided 'myself' data has a 'name' and worklog has 'name' (username)
				// This handles cases where emailAddress might be hidden but username is visible
				if (!isAuthorMatch && currentUserName && wl.author?.name) {
					if (currentUserName === wl.author.name) {
						isAuthorMatch = true;
					}
				}

				if (isDateMatch && isAuthorMatch) {
					results.push({
						id: wl.id,
						issueKey: issue.key,
						issueSummary: issue.fields.summary,
						timeSpentFormatted: formatSeconds(wl.timeSpentSeconds), // Initial load always HM, store handles switch
						timeSpentSeconds: wl.timeSpentSeconds,
						comment:
							wl.comment?.content?.[0]?.content?.[0]?.text || wl.comment || issue.fields.summary,
						labels: issue.fields.labels || [],
						issueType: issue.fields.issuetype?.name || '',
						date: dateStr
					});
				}
			});
		}
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
	query: string
): Promise<any[]> {
	if (typeof window === 'undefined' || !baseUrl.startsWith('http')) return [];
	if (!query || query.length < 2) return [];

	const cleanQuery = query.trim();

	try {
		// 1. Try JQL Search
		// Build JQL dynamically to avoid 400 Bad Request on invalid project keys (e.g. searching for "PROJ-123" in project field)
		const isIssueKey = /^[a-zA-Z]+-\d+$/.test(cleanQuery);
		let jql = `summary ~ "${cleanQuery}*"`; // Always search summary

		if (isIssueKey) {
			// If it looks like a specific issue key, match exact key strongly
			jql = `key = "${cleanQuery}" OR ${jql}`;
		} else {
			// Loose key match
			jql = `key ~ "${cleanQuery}*" OR ${jql}`;

			// Only try project search if query doesn't look like an issue key
			// and looks like a potential project key (alphanumeric)
			if (/^[a-zA-Z0-9]+$/.test(cleanQuery)) {
				jql += ` OR project = "${cleanQuery}"`;
			}
		}

		console.log('Searching JQL:', jql); // Debugging

		const response = await fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken,
				endpoint: '/rest/api/3/search/jql',
				method: 'POST',
				body: {
					jql,
					fields: ['key', 'summary', 'issuetype', 'status'],
					maxResults: 100
				}
			})
		});

		if (response.ok) {
			const data = await response.json();
			if (data.issues && data.issues.length > 0) {
				return data.issues.map((issue: any) => ({
					id: issue.id,
					issueKey: issue.key,
					issueSummary: issue.fields?.summary || 'Brak tytułu',
					type: issue.fields?.issuetype?.name || 'Task',
					status: issue.fields?.status?.name || 'Status',
					totalTimeSpentFormatted: '0h',
					isExpanded: true,
					children: []
				}));
			}
		}

		// 2. Fallback to Issue Picker
		const pickerRes = await fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken,
				endpoint: `/rest/api/3/issue/picker?query=${encodeURIComponent(cleanQuery)}`,
				method: 'GET'
			})
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
	tempoToken?: string
): Promise<{ success: boolean; migratedCount: number }> {
	let migratedCount = 0;
	try {
		// 1. Get Account ID if using Tempo
		let authorAccountId = '';
		if (tempoToken) {
			const myselfRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					email,
					apiToken,
					endpoint: '/rest/api/3/myself',
					method: 'GET'
				})
			});
			if (myselfRes.ok) {
				const data = await myselfRes.json();
				authorAccountId = data.accountId;
			}
		}

		// 2. Fetch Work Attributes definitions (Reference)
		let workAttributeDefinitions: any[] = [];
		if (tempoToken) {
			const attrsRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					apiToken: tempoToken,
					isTempo: true,
					endpoint: '/4/work-attributes',
					method: 'GET'
				})
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

			if (tempoToken) {
				const issueRes = await fetch('/api/jira/proxy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						baseUrl,
						email,
						apiToken,
						endpoint: `/rest/api/2/issue/${migration.parentKey}`,
						method: 'GET'
					})
				});
				if (issueRes.ok) {
					const issueData = await issueRes.json();
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
				let response;

				if (tempoToken && authorAccountId && issueIdForTempo) {
					// TEMPO MIGRATION
					response = await fetch('/api/jira/proxy', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							baseUrl,
							apiToken: tempoToken,
							isTempo: true,
							endpoint: '/4/worklogs',
							method: 'POST',
							body: {
								issueId: issueIdForTempo,
								timeSpentSeconds: worklog.timeSpentSeconds, // Use actual time
								startDate: worklog.started || new Date().toISOString().split('T')[0],
								startTime: '09:00:00',
								description: `[${worklog.issueKey}] ${worklog.comment || worklog.issueSummary}`,
								authorAccountId: authorAccountId,
								attributes:
									attributesForThisMigration.length > 0 ? attributesForThisMigration : undefined
							}
						})
					});
				} else {
					// NATIVE JIRA
					response = await fetch('/api/jira/proxy', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							baseUrl,
							email,
							apiToken,
							endpoint: `/rest/api/2/issue/${migration.parentKey}/worklog?adjustEstimate=leave`,
							method: 'POST',
							body: {
								timeSpentSeconds: worklog.timeSpentSeconds,
								started: worklog.started
									? `${worklog.started}T09:00:00.000+0000`
									: new Date().toISOString(),
								comment: `[${worklog.issueKey}] ${worklog.comment || worklog.issueSummary}`
							}
						})
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
		return { success: migratedCount > 0, migratedCount };
	} catch (error) {
		console.error('Migration error:', error);
		return { success: false, migratedCount };
	}
}

export async function testConnectionToJira(
	baseUrl: string,
	email: string,
	apiToken: string
): Promise<ConnectionTestResult> {
	try {
		const r = await fetch('/api/test-connection', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl, email, apiToken })
		});
		return await r.json();
	} catch {
		return { success: false, message: 'Błąd połączenia' };
	}
}

export async function testConnectionToTempo(
	baseUrl: string,
	tempoToken: string
): Promise<ConnectionTestResult> {
	try {
		const r = await fetch('/api/test-connection', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl, apiToken: tempoToken, type: 'tempo' })
		});
		return await r.json();
	} catch {
		return { success: false, message: 'Błąd połączenia z Tempo' };
	}
}
export async function deleteWorklogInJiraY(
	baseUrl: string,
	email: string,
	apiToken: string,
	worklogId: string,
	issueKeyOrId?: string, // Required for native Jira
	tempoToken?: string
): Promise<boolean> {
	try {
		const isTempo = !!tempoToken;
		const endpoint = isTempo
			? `/4/worklogs/${worklogId}`
			: `/rest/api/2/issue/${issueKeyOrId}/worklog/${worklogId}`;

		console.log(`[JiraApi] Deleting worklog ${worklogId} from ${isTempo ? 'Tempo' : 'Jira'}...`);

		const response = await fetch('/api/jira/proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseUrl,
				email,
				apiToken: isTempo ? tempoToken : apiToken,
				isTempo,
				endpoint,
				method: 'DELETE'
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[JiraApi] Delete failed (${response.status}):`, errorText);
			return false;
		}

		console.log(`[JiraApi] Worklog ${worklogId} deleted successfully.`);
		return true;
	} catch (error) {
		console.error('Delete worklog error:', error);
		return false;
	}
}
