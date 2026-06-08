/**
 * 開発環境専用のログユーティリティ
 * セキュリティ要件:
 * - 本番環境ではログを出力しない
 * - センシティブ情報（ユーザーデータの内容）は含めない
 * - 操作の種類とステータスのみをログに記録
 */

type LogLevel = "info" | "warn" | "error";

interface LoggerOptions {
	prefix: string;
}

class Logger {
	private prefix: string;
	private isDev: boolean;

	constructor(options: LoggerOptions) {
		this.prefix = options.prefix;
		this.isDev = import.meta.env.DEV;
	}

	private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
		if (!this.isDev) return;

		const timestamp = new Date().toISOString().split("T")[1].slice(0, 12); // HH:MM:SS.mmm
		const formattedPrefix = `[${timestamp}] ${this.prefix}`;

		switch (level) {
			case "info":
				console.info(formattedPrefix, message, ...args);
				break;
			case "warn":
				console.warn(formattedPrefix, message, ...args);
				break;
			case "error":
				console.error(formattedPrefix, message, ...args);
				break;
		}
	}

	/**
	 * 正常な操作をログ出力
	 */
	info(message: string, ...args: unknown[]): void {
		this.formatMessage("info", message, ...args);
	}

	/**
	 * 警告（エラー回復可能な状態）をログ出力
	 */
	warn(message: string, ...args: unknown[]): void {
		this.formatMessage("warn", message, ...args);
	}

	/**
	 * エラー（致命的な問題）をログ出力
	 */
	error(message: string, ...args: unknown[]): void {
		this.formatMessage("error", message, ...args);
	}
}

/**
 * ロガーインスタンスを作成
 * @param prefix - ログのプレフィックス（例: "TimerStorage"）
 */
export function createLogger(prefix: string): Logger {
	return new Logger({ prefix });
}
