/**
 * Date Parser Service
 *
 * Natural language date parsing for Portuguese using chrono-node.
 * Supports expressions like "amanhã", "próxima terça-feira", "em 5 minutos", etc.
 */

import { loggers } from '@/utils/logger';
import * as chrono from 'chrono-node';

export interface ParsedDateResult {
	date: Date;
	originalText: string;
	confidence: number;
}

/**
 * Parse a natural language date string in Portuguese
 *
 * @param dateString - The natural language date string to parse
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns The parsed date
 * @throws Error if the date cannot be parsed
 */
export async function parseNaturalDate(dateString: string, referenceDate?: Date): Promise<Date> {
	const ref = referenceDate || new Date();
	const results = chrono.pt.parse(dateString, ref, { forwardDate: true });

	if (results.length === 0) {
		throw new Error(`Não consegui entender a data: "${dateString}"`);
	}

	const parsedDate = results[0].start.date();

	loggers.dateParser.debug(
		{
			input: dateString,
			referenceDate: ref,
			parsedDate,
			confidence: (results[0].start as any)?.certaintyRating?.() ?? undefined,
		},
		'Date parsed successfully',
	);

	return parsedDate;
}

/**
 * Parse a date with additional metadata
 *
 * @param dateString - The natural language date string to parse
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Parsed date with metadata
 */
export async function parseNaturalDateWithMeta(dateString: string, referenceDate?: Date): Promise<ParsedDateResult> {
	const ref = referenceDate || new Date();
	const results = chrono.pt.parse(dateString, ref, { forwardDate: true });

	if (results.length === 0) {
		throw new Error(`Não consegui entender a data: "${dateString}"`);
	}

	const result = results[0];
	const parsedDate = result.start.date();
	const confidence = (result.start as any)?.certaintyRating?.() || 0;

	return {
		date: parsedDate,
		originalText: dateString,
		confidence,
	};
}

/**
 * Parse multiple dates from a string
 * Useful for extracting ranges like "de hoje até sexta"
 *
 * @param dateString - The string potentially containing multiple dates
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Array of parsed dates
 */
export async function parseMultipleDates(dateString: string, referenceDate?: Date): Promise<Date[]> {
	const ref = referenceDate || new Date();
	const results = chrono.pt.parse(dateString, ref, { forwardDate: true });

	if (results.length === 0) {
		throw new Error(`Não consegui entender as datas: "${dateString}"`);
	}

	return results.map((result) => result.start.date());
}

/**
 * Parse a date range from text
 * Looks for patterns like "de amanhã até sexta" or "esta semana"
 *
 * @param dateString - The string containing a date range
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Object with startDate and endDate
 */
export async function parseDateRange(
	dateString: string,
	referenceDate?: Date,
): Promise<{ startDate: Date; endDate: Date }> {
	const ref = referenceDate || new Date();
	const results = chrono.pt.parse(dateString, ref, { forwardDate: true });

	if (results.length === 0) {
		throw new Error(`Não consegui entender o período: "${dateString}"`);
	}

	// Try to find a range
	const result = results[0];

	// If we have both start and end, use them
	if (result.end?.date()) {
		return {
			startDate: result.start.date(),
			endDate: result.end.date(),
		};
	}

	// Single date - treat it as the start, calculate end based on context
	const startDate = result.start.date();

	// Check for keywords that imply a duration
	const lowerInput = dateString.toLowerCase();

	if (lowerInput.includes('hoje')) {
		// Today - end of day
		const endDate = new Date(startDate);
		endDate.setHours(23, 59, 59, 999);
		return { startDate, endDate };
	}

	if (lowerInput.includes('semana') && (lowerInput.includes('esta') || lowerInput.includes('essa'))) {
		// This week - Sunday at end of day
		const endDate = new Date(startDate);
		const dayOfWeek = endDate.getDay();
		const daysUntilSunday = 7 - dayOfWeek;
		endDate.setDate(endDate.getDate() + daysUntilSunday);
		endDate.setHours(23, 59, 59, 999);
		return { startDate, endDate };
	}

	if (lowerInput.includes('mês') && (lowerInput.includes('este') || lowerInput.includes('esse'))) {
		// This month - last day of month
		const endDate = new Date(startDate);
		endDate.setMonth(endDate.getMonth() + 1, 0);
		endDate.setHours(23, 59, 59, 999);
		return { startDate, endDate };
	}

	// Default: treat as a single day event
	const endDate = new Date(startDate);
	endDate.setHours(23, 59, 59, 999);
	return { startDate, endDate };
}

/**
 * Check if a text contains a date expression
 *
 * @param text - The text to check
 * @returns True if a date was found
 */
export function containsDateExpression(text: string): boolean {
	const results = chrono.pt.parse(text);
	return results.length > 0;
}

/**
 * Extract all date expressions from text
 *
 * @param text - The text to extract dates from
 * @returns Array of {text, date} objects
 */
export function extractDateExpressions(text: string): Array<{ text: string; date: Date }> {
	const results = chrono.pt.parse(text);

	return results.map((result) => ({
		text: result.text,
		date: result.start.date(),
	}));
}
