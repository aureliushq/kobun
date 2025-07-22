/**
 * Structured logging utility for Kobun
 */

export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error'
}

export interface LogContext {
	operation?: string
	component?: string
	userId?: string
	requestId?: string
	[key: string]: unknown
}

export interface LogEntry {
	level: LogLevel
	message: string
	timestamp: string
	context?: LogContext
	error?: {
		name: string
		message: string
		stack?: string
		code?: string
	}
}

class Logger {
	private isDevelopment: boolean

	constructor() {
		this.isDevelopment = process.env.NODE_ENV === 'development'
	}

	private formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
		const entry: LogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
		}

		if (context) {
			entry.context = context
		}

		if (error) {
			entry.error = {
				name: error.name,
				message: error.message,
				stack: error.stack,
				code: (error as any).code
			}
		}

		return entry
	}

	private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
		const entry = this.formatLogEntry(level, message, context, error)

		if (this.isDevelopment) {
			// Pretty print for development
			const contextStr = context ? ` [${Object.entries(context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : ''
			const errorStr = error ? ` Error: ${error.message}` : ''
			console.log(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}${contextStr}${errorStr}`)
		} else {
			// Structured JSON for production
			console.log(JSON.stringify(entry))
		}
	}

	debug(message: string, context?: LogContext): void {
		this.log(LogLevel.DEBUG, message, context)
	}

	info(message: string, context?: LogContext): void {
		this.log(LogLevel.INFO, message, context)
	}

	warn(message: string, context?: LogContext, error?: Error): void {
		this.log(LogLevel.WARN, message, context, error)
	}

	error(message: string, context?: LogContext, error?: Error): void {
		this.log(LogLevel.ERROR, message, context, error)
	}
}

export const logger = new Logger()