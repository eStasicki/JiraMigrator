import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatSeconds(seconds: number): string {
	if (!seconds || seconds <= 0) return '0h';

	// If it's a "clean" decimal (like 0.5, 1.25, etc. - multiples of 15 mins)
	// we could potentially show it as decimal, but Jira standard is often h/m.
	// However, the user wants decimal support.

	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);

	// If it's exactly a half-hour or quarter-hour, some might prefer 0.5h
	// but let's stick to a robust h/m by default and ensure parsing supports both.

	let result = '';
	if (h > 0) result += `${h}h `;
	if (m > 0) result += `${m}m`;
	return result.trim() || '0m';
}

export function formatSecondsDecimal(seconds: number): string {
	if (!seconds || seconds <= 0) return '0';
	const hours = seconds / 3600;
	// Round to 2 decimal places and remove trailing zeros, use dot as decimal separator
	return Number(hours.toFixed(2)).toString();
}

export function formatTime(seconds: number, format: 'hm' | 'decimal' = 'hm'): string {
	if (!seconds || seconds <= 0) return format === 'decimal' ? '0' : '0h';
	if (format === 'decimal') {
		return formatSecondsDecimal(seconds);
	}
	return formatSeconds(seconds);
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
