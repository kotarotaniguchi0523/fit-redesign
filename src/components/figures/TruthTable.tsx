import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@heroui/react";
import type { TruthTableColumn, TruthTableRow } from "../../types/index";

export interface TruthTableProps {
	columns: TruthTableColumn[];
	rows: TruthTableRow[];
	ariaLabel?: string;
}

/**
 * 真理値表コンポーネント
 * HeroUIのTableを使用して実装
 * PDFのようなグリッド表示にするため、デフォルトのスタイルを上書き
 */
export function TruthTable({ columns, rows, ariaLabel = "Truth table" }: TruthTableProps) {
	return (
		<div className="w-full overflow-x-auto">
			<Table
				aria-label={ariaLabel}
				className="max-w-2xl min-w-max"
				shadow="none"
				radius="none"
				classNames={{
					wrapper: "p-0",
					table: "border-2 border-gray-800 border-collapse",
					thead: "rounded-none",
					tbody: "rounded-none",
					tr: "rounded-none border-none shadow-none",
					th: "border border-gray-800 bg-gray-100 text-black font-bold text-center rounded-none",
					td: "border border-gray-800 text-black font-mono text-center rounded-none",
				}}
			>
				<TableHeader>
					{columns.map((column) => (
						<TableColumn key={column.key}>{column.label}</TableColumn>
					))}
				</TableHeader>
				<TableBody>
					{rows.map((row, rowIndex) => {
						const rowKey = `row-${rowIndex}`;

						return (
							<TableRow key={rowKey}>
								{columns.map((column) => (
									<TableCell key={`${rowKey}-${column.key}`}>
										{String(row[column.key])}
									</TableCell>
								))}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
