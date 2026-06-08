import type { TruthTableColumn, TruthTableRow } from "../../../src/types/index";

interface TruthTableProps {
	columns: TruthTableColumn[];
	rows: TruthTableRow[];
	ariaLabel?: string;
}

export function TruthTable({ columns, rows, ariaLabel = "Truth table" }: TruthTableProps) {
	return (
		<div class="w-full overflow-x-auto">
			<table
				aria-label={ariaLabel}
				class="max-w-2xl min-w-max border-2 border-gray-800 border-collapse"
			>
				<thead>
					<tr>
						{columns.map((column) => (
							<th class="border border-gray-800 bg-gray-100 text-black font-bold text-center px-3 py-2">
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr>
							{columns.map((column) => (
								<td class="border border-gray-800 text-black font-mono text-center px-3 py-2">
									{String(row[column.key])}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
