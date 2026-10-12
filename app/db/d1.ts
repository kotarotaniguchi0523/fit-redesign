import {
	Database,
	type DatabaseCapabilities,
	type DatabaseDriver,
	type DatabaseOptions,
	type DataManipulationOperation,
	type DataManipulationRequest,
	type DataManipulationResult,
	getTableName,
	type Predicate,
	rawSql,
	type SqlStatement,
	type TableRef,
	type TransactionOptions,
	type TransactionToken,
} from "remix/data-table";

/**
 * D1（SQLite 互換）用の SQL コンパイラ。
 *
 * Remix の `data-table` が渡す canonical operation を、D1 が受け付ける
 * `?` プレースホルダ付き SQL へ変換する。`node:sqlite` を使う公式 SQLite ドライバは
 * Workers では永続化できず、公開 API として D1 ドライバが提供されていないため、
 * Remix の公開拡張点（`DatabaseDriver` / `DataManipulationOperation` / `SqlStatement`）に
 * 沿って実装する。
 */
type Bindings = unknown[];

function quoteIdentifier(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

/** "table.column" のような dotted path を各セグメント引用する。 */
function quotePath(value: string): string {
	return value.split(".").map(quoteIdentifier).join(".");
}

const COMPARISON_SQL: Record<string, string> = {
	eq: "=",
	ne: "<>",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
};

function compilePredicate(predicate: Predicate, values: Bindings): string {
	switch (predicate.type) {
		case "comparison": {
			const column = quotePath(predicate.column);
			if (predicate.valueType === "column") {
				const operator = COMPARISON_SQL[predicate.operator];
				return `${column} ${operator} ${quotePath(String(predicate.value))}`;
			}
			switch (predicate.operator) {
				case "in":
				case "notIn": {
					const list = (predicate.value as unknown[]) ?? [];
					if (list.length === 0) {
						return predicate.operator === "in" ? "0 = 1" : "1 = 1";
					}
					values.push(...list);
					const keyword = predicate.operator === "in" ? "IN" : "NOT IN";
					return `${column} ${keyword} (${list.map(() => "?").join(", ")})`;
				}
				case "like":
				case "ilike": {
					values.push(predicate.value);
					return predicate.operator === "like"
						? `${column} LIKE ?`
						: `${column} LIKE ? COLLATE NOCASE`;
				}
				default: {
					values.push(predicate.value);
					return `${column} ${COMPARISON_SQL[predicate.operator]} ?`;
				}
			}
		}
		case "between":
			values.push(predicate.lower, predicate.upper);
			return `${quotePath(predicate.column)} BETWEEN ? AND ?`;
		case "null":
			return `${quotePath(predicate.column)} IS ${predicate.operator === "isNull" ? "NULL" : "NOT NULL"}`;
		case "logical": {
			const parts = predicate.predicates.map((child) => compilePredicate(child, values));
			if (parts.length === 0) {
				return predicate.operator === "and" ? "1 = 1" : "0 = 1";
			}
			return `(${parts.join(predicate.operator === "and" ? " AND " : " OR ")})`;
		}
	}
}

function compileWhere(predicates: readonly Predicate[], values: Bindings): string {
	if (predicates.length === 0) {
		return "";
	}
	return ` WHERE ${predicates.map((predicate) => compilePredicate(predicate, values)).join(" AND ")}`;
}

function compileJoins(
	joins: readonly { type: string; table: Parameters<typeof getTableName>[0]; on: Predicate }[],
	values: Bindings,
): string {
	if (joins.length === 0) {
		return "";
	}
	return joins
		.map((join) => {
			const kind =
				join.type === "left" ? "LEFT JOIN" : join.type === "right" ? "RIGHT JOIN" : "JOIN";
			return ` ${kind} ${quoteIdentifier(getTableName(join.table))} ON ${compilePredicate(join.on, values)}`;
		})
		.join("");
}

function compileOrderBy(orderBy: readonly { column: string; direction: "asc" | "desc" }[]): string {
	if (orderBy.length === 0) {
		return "";
	}
	return ` ORDER BY ${orderBy
		.map((clause) => `${quotePath(clause.column)} ${clause.direction.toUpperCase()}`)
		.join(", ")}`;
}

function compileReturning(returning: "*" | string[] | undefined): string {
	if (returning === undefined) {
		return "";
	}
	if (returning === "*") {
		return " RETURNING *";
	}
	return ` RETURNING ${returning.map(quoteIdentifier).join(", ")}`;
}

/** canonical operation を SQL 文の配列へコンパイルする。 */
export function compileOperation(operation: DataManipulationOperation): SqlStatement[] {
	const values: Bindings = [];

	switch (operation.kind) {
		case "select": {
			const columns =
				operation.select === "*"
					? "*"
					: operation.select
							.map((entry) =>
								entry.column === entry.alias
									? quotePath(entry.column)
									: `${quotePath(entry.column)} AS ${quoteIdentifier(entry.alias)}`,
							)
							.join(", ");
			const distinct = operation.distinct ? "DISTINCT " : "";
			let text = `SELECT ${distinct}${columns} FROM ${quoteIdentifier(getTableName(operation.table))}`;
			text += compileJoins(operation.joins, values);
			text += compileWhere(operation.where, values);
			if (operation.groupBy.length > 0) {
				text += ` GROUP BY ${operation.groupBy.map(quotePath).join(", ")}`;
			}
			if (operation.having.length > 0) {
				text += ` HAVING ${operation.having.map((p) => compilePredicate(p, values)).join(" AND ")}`;
			}
			text += compileOrderBy(operation.orderBy);
			if (operation.limit !== undefined) {
				values.push(operation.limit);
				text += " LIMIT ?";
				if (operation.offset !== undefined) {
					values.push(operation.offset);
					text += " OFFSET ?";
				}
			} else if (operation.offset !== undefined) {
				text += " LIMIT -1";
				values.push(operation.offset);
				text += " OFFSET ?";
			}
			return [{ text, values }];
		}

		case "count": {
			let text = `SELECT COUNT(*) AS ${quoteIdentifier("count")} FROM ${quoteIdentifier(getTableName(operation.table))}`;
			text += compileJoins(operation.joins, values);
			text += compileWhere(operation.where, values);
			if (operation.groupBy.length > 0) {
				text += ` GROUP BY ${operation.groupBy.map(quotePath).join(", ")}`;
			}
			if (operation.having.length > 0) {
				text += ` HAVING ${operation.having.map((p) => compilePredicate(p, values)).join(" AND ")}`;
			}
			return [{ text, values }];
		}

		case "exists": {
			let text = `SELECT EXISTS(SELECT 1 FROM ${quoteIdentifier(getTableName(operation.table))}`;
			text += compileJoins(operation.joins, values);
			text += compileWhere(operation.where, values);
			if (operation.groupBy.length > 0) {
				text += ` GROUP BY ${operation.groupBy.map(quotePath).join(", ")}`;
			}
			if (operation.having.length > 0) {
				text += ` HAVING ${operation.having.map((p) => compilePredicate(p, values)).join(" AND ")}`;
			}
			text += `) AS ${quoteIdentifier("exists")}`;
			return [{ text, values }];
		}

		case "insert":
		case "insertMany": {
			const rows = operation.kind === "insert" ? [operation.values] : operation.values;
			const table = quoteIdentifier(getTableName(operation.table));
			if (rows.length === 0) {
				return [];
			}
			const columns = new Set<string>();
			for (const row of rows) {
				for (const key of Object.keys(row)) {
					columns.add(key);
				}
			}
			const columnList = [...columns];
			const tuples = rows.map((row) => {
				const placeholders = columnList.map((column) => {
					values.push(row[column] ?? null);
					return "?";
				});
				return `(${placeholders.join(", ")})`;
			});
			let text = `INSERT INTO ${table} (${columnList.map(quoteIdentifier).join(", ")}) VALUES ${tuples.join(", ")}`;
			text += compileReturning(operation.returning);
			return [{ text, values }];
		}

		case "update": {
			const assignments = Object.keys(operation.changes).map((column) => {
				values.push((operation.changes as Record<string, unknown>)[column] ?? null);
				return `${quoteIdentifier(column)} = ?`;
			});
			let text = `UPDATE ${quoteIdentifier(getTableName(operation.table))} SET ${assignments.join(", ")}`;
			text += compileWhere(operation.where, values);
			text += compileReturning(operation.returning);
			return [{ text, values }];
		}

		case "delete": {
			let text = `DELETE FROM ${quoteIdentifier(getTableName(operation.table))}`;
			text += compileWhere(operation.where, values);
			text += compileReturning(operation.returning);
			return [{ text, values }];
		}

		case "upsert": {
			const table = quoteIdentifier(getTableName(operation.table));
			const columnList = Object.keys(operation.values);
			const placeholders = columnList.map((column) => {
				values.push((operation.values as Record<string, unknown>)[column] ?? null);
				return "?";
			});
			let text = `INSERT INTO ${table} (${columnList.map(quoteIdentifier).join(", ")}) VALUES (${placeholders.join(", ")})`;
			const target = (operation.conflictTarget ?? columnList).map(quoteIdentifier).join(", ");
			const updates = Object.keys(operation.update ?? operation.values).map((column) => {
				values.push(
					((operation.update ?? operation.values) as Record<string, unknown>)[column] ?? null,
				);
				return `${quoteIdentifier(column)} = ?`;
			});
			text += ` ON CONFLICT (${target}) DO UPDATE SET ${updates.join(", ")}`;
			text += compileReturning(operation.returning);
			return [{ text, values }];
		}

		case "raw":
			return [operation.sql];
	}
}

function isWriteOperation(operation: DataManipulationOperation): boolean {
	return (
		operation.kind === "insert" ||
		operation.kind === "insertMany" ||
		operation.kind === "update" ||
		operation.kind === "delete" ||
		operation.kind === "upsert" ||
		operation.kind === "raw"
	);
}

/**
 * Cloudflare D1 を `remix/data-table` に接続するドライバ。
 *
 * D1 には対話的トランザクションが無いため、トランザクション中の書き込みは
 * ステートメントをバッファし、commit 時に `batch()` で原子的に送出する
 * （読み取りは即時実行）。savepoints は非対応。
 */
export class D1DatabaseDriver implements DatabaseDriver<"d1"> {
	readonly dialect = "d1" as const;
	readonly capabilities: DatabaseCapabilities = {
		returning: true,
		savepoints: false,
		upsert: true,
		transactionalDdl: false,
		migrationLock: false,
	};

	#db: D1Database;
	#sequences = 0;
	#transactions = new Map<string, D1PreparedStatement[]>();

	constructor(db: D1Database) {
		this.#db = db;
	}

	#prepare(statement: SqlStatement): D1PreparedStatement {
		const prepared = this.#db.prepare(statement.text);
		return statement.values.length > 0 ? prepared.bind(...statement.values) : prepared;
	}

	async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
		const transactionId = request.transaction?.id;
		if (transactionId !== undefined && isWriteOperation(request.operation)) {
			const buffer = this.#transactions.get(transactionId);
			if (buffer !== undefined) {
				for (const statement of compileOperation(request.operation)) {
					buffer.push(this.#prepare(statement));
				}
				return { affectedRows: 0 };
			}
		}

		const statements = compileOperation(request.operation);
		const wantsRows =
			request.operation.kind === "select" ||
			request.operation.kind === "count" ||
			request.operation.kind === "exists" ||
			("returning" in request.operation && request.operation.returning !== undefined);

		if (statements.length === 0) {
			return { rows: [] };
		}

		const statement = this.#prepare(statements[0] as SqlStatement);
		if (wantsRows) {
			const result = await statement.all();
			return { rows: normalizeRows(request.operation, result.results ?? []) };
		}

		const result = await statement.run();
		return {
			affectedRows: result.meta.changes ?? 0,
			insertId: result.meta.last_row_id ?? undefined,
		};
	}

	async executeScript(sql: string): Promise<void> {
		await this.#db.exec(sql);
	}

	async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
		const id = `d1-txn-${++this.#sequences}`;
		this.#transactions.set(id, []);
		return { id };
	}

	async commitTransaction(token: TransactionToken): Promise<void> {
		const buffer = this.#transactions.get(token.id);
		this.#transactions.delete(token.id);
		if (buffer !== undefined && buffer.length > 0) {
			await this.#db.batch(buffer);
		}
	}

	async rollbackTransaction(token: TransactionToken): Promise<void> {
		this.#transactions.delete(token.id);
	}

	async hasTable(table: TableRef): Promise<boolean> {
		const row = await this.#db
			.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
			.bind(table.name)
			.first();
		return row !== null;
	}

	async hasColumn(table: TableRef, column: string): Promise<boolean> {
		const result = await this.#db
			.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`)
			.all();
		return (result.results ?? []).some((row: { name?: unknown }) => row.name === column);
	}

	async createSavepoint(): Promise<void> {
		throw new Error("D1 does not support savepoints");
	}

	async rollbackToSavepoint(): Promise<void> {
		throw new Error("D1 does not support savepoints");
	}

	async releaseSavepoint(): Promise<void> {
		throw new Error("D1 does not support savepoints");
	}

	async wipe(): Promise<void> {
		const result = await this.#db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
			.all();
		for (const row of (result.results ?? []) as Array<{ name: string }>) {
			await this.#db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(row.name)}`);
		}
	}

	close(): void {
		this.#transactions.clear();
	}
}

/** `count`/`exists` の結果を data-table が期待する数値/真偽値へ正規化する。 */
function normalizeRows(
	operation: DataManipulationOperation,
	rows: Record<string, unknown>[],
): Record<string, unknown>[] {
	if (operation.kind === "count") {
		return rows.map((row) => ({ ...row, count: Number(row.count ?? 0) }));
	}
	if (operation.kind === "exists") {
		return rows.map((row) => ({ ...row, exists: Boolean(row.exists) }));
	}
	return rows;
}

export class D1DataTableDatabase extends Database<"d1"> {
	constructor(client: D1Database, options?: DatabaseOptions) {
		super(new D1DatabaseDriver(client), options);
	}
}

/** D1 バインディングから `remix/data-table` の Database を作る。 */
export function createD1Database(
	client: D1Database,
	options?: DatabaseOptions,
): D1DataTableDatabase {
	return new D1DataTableDatabase(client, options);
}

export { rawSql };
