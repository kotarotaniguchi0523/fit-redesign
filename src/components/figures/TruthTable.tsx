import type { TruthTableColumn, TruthTableRow } from "../../types/index";

export interface TruthTableProps {
	columns: TruthTableColumn[];
	rows: TruthTableRow[];
	ariaLabel?: string;
}

/**
 * 真理値表コンポーネント
 * PDFの試験問題と同様のマス目（枠線）付きテーブルを表示
 */
export function TruthTable({ columns, rows, ariaLabel = "Truth table" }: TruthTableProps) {
	return (
		<div className="overflow-x-auto">
			<table
				aria-label={ariaLabel}
				className="border-collapse border-2 border-gray-800 text-center"
			>
				<thead>
					<tr className="bg-gray-100">
						{columns.map((column) => (
							<th
								key={column.key}
								className="border border-gray-800 px-4 py-2 font-semibold min-w-[3rem]"
							>
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => {
						const rowKey = `row-${rowIndex}`;

						return (
							<tr key={rowKey}>
								{columns.map((column) => (
									<td
										key={`${rowKey}-${column.key}`}
										className="border border-gray-800 px-4 py-2 font-mono"
									>
										{String(row[column.key])}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
