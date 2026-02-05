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

			const tempoRes = await fetch('/api/jira/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					email,
					apiToken: tempoToken,
					isTempo: true,
					endpoint: `/worklogs/user/${accountId}?from=${dateStr}&to=${dateStr}&limit=1000`,
					method: 'GET'
				})
			});

			if (tempoRes.ok) {
				const tempoData = await tempoRes.json();
				const yourWorklogs = tempoData.results || [];

				if (yourWorklogs.length > 0) {
					const issuesMap = new Map();
					yourWorklogs.forEach((wl: any) => {
						const issueId = wl.issue?.id;
						if (!issueId) return;

						const current = issuesMap.get(issueId) || {
							id: issueId,
							totalSeconds: 0,
							rawWorklogs: []
						};

						current.totalSeconds += wl.timeSpentSeconds;
						current.rawWorklogs.push(wl);
						issuesMap.set(issueId, current);
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
								const children = info.rawWorklogs.map((wl: any) => ({
									id: wl.tempoWorklogId || wl.id,
									issueKey: issueData.key,
									issueSummary: wl.description || issueData.fields?.summary || 'Brak opisu',
									timeSpentFormatted: formatSeconds(wl.timeSpentSeconds),
									timeSpentSeconds: wl.timeSpentSeconds,
									comment: wl.description || issueData.fields?.summary,
									date: dateStr
								}));

								results.push({
									id: id,
									issueKey: issueData.key,
									issueSummary: issueData.fields?.summary || 'Brak tytułu',
									type: issueData.fields?.issuetype?.name || 'Task',
									status: issueData.fields?.status?.name || 'Status',
									totalTimeSpentFormatted: formatSeconds(info.totalSeconds),
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
				body: { jql, fields: ['key', 'summary', 'labels'], maxResults: 100 }
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
				if (wl.started.startsWith(dateStr)) {
					results.push({
						id: wl.id,
						issueKey: issue.key,
						issueSummary: issue.fields.summary,
						timeSpentFormatted: formatSeconds(wl.timeSpentSeconds), // Initial load always HM, store handles switch
						timeSpentSeconds: wl.timeSpentSeconds,
						comment:
							wl.comment?.content?.[0]?.content?.[0]?.text || wl.comment || issue.fields.summary,
						labels: issue.fields.labels || [],
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
		const jql = `key ~ "${cleanQuery}*" OR summary ~ "${cleanQuery}*" OR project = "${cleanQuery}"`;
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
	migrations: { parentKey: string; children: any[] }[]
): Promise<{ success: boolean; migratedCount: number }> {
	let migratedCount = 0;
	try {
		for (const migration of migrations) {
			for (const worklog of migration.children) {
				const response = await fetch('/api/jira/proxy', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						baseUrl,
						email,
						apiToken,
						endpoint: `/rest/api/3/issue/${migration.parentKey}/worklog`,
						method: 'POST',
						body: {
							timeSpentSeconds: worklog.timeSpentSeconds,
							started: worklog.started
								? `${worklog.started}T09:00:00.000+0000`
								: new Date().toISOString(),
							comment: {
								type: 'doc',
								version: 1,
								content: [
									{
										type: 'paragraph',
										content: [
											{
												type: 'text',
												text:
													worklog.comment ||
													`Zmigrowano z ${worklog.issueKey}: ${worklog.issueSummary}`
											}
										]
									}
								]
							}
						}
					})
				});

				if (response.ok) {
					migratedCount++;
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
