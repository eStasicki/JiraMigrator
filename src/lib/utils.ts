import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatSeconds(seconds: number): string {
	if (!seconds || seconds <= 0) return '0h';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	let result = '';
	if (h > 0) result += `${h}h `;
	if (m > 0) result += `${m}m`;
	return result.trim() || '0m';
}

export function getLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function getTotalProgress(worklogs: any[]): string {
	const totalSeconds = worklogs.reduce((sum, w) => sum + (w.timeSpentSeconds || 0), 0);
	return formatSeconds(totalSeconds);
}
