/**
 * Simple in-memory cache for Jira API responses
 */

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const ISSUE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

const userCache = new Map<string, CacheEntry<any>>();
const issueCache = new Map<string, CacheEntry<any>>();

export const Cache = {
	getUser: (key: string) => {
		const entry = userCache.get(key);
		if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
			return entry.data;
		}
		return null;
	},

	setUser: (key: string, data: any) => {
		userCache.set(key, { data, timestamp: Date.now() });
	},

	getIssue: (issueIdOrKey: string) => {
		const entry = issueCache.get(issueIdOrKey);
		if (entry && Date.now() - entry.timestamp < ISSUE_CACHE_TTL) {
			return entry.data;
		}
		return null;
	},

	setIssue: (issueIdOrKey: string, data: any) => {
		issueCache.set(issueIdOrKey, { data, timestamp: Date.now() });
		// Also cache by Key if available and distinct from ID
		if (data.key && data.key !== issueIdOrKey) {
			issueCache.set(data.key, { data, timestamp: Date.now() });
		}
		// Also cache by ID if available and distinct from Key
		if (data.id && data.id !== issueIdOrKey) {
			issueCache.set(data.id, { data, timestamp: Date.now() });
		}
	},

	clear: () => {
		userCache.clear();
		issueCache.clear();
	}
};
