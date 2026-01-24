import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { TruthTableColumn, TruthTableRow } from "../../types/figures";

export interface TruthTableProps {
	columns: TruthTableColumn[];
	rows: TruthTableRow[];
	ariaLabel?: string;
}

export function TruthTable({ columns, rows, ariaLabel = "Truth table" }: TruthTableProps) {
	return (
		<Table aria-label={ariaLabel} className="max-w-2xl">
			<TableHeader>
				{columns.map((column) => (
					<TableColumn key={column.key} className="text-center">
						{column.label}
					</TableColumn>
				))}
			</TableHeader>
			<TableBody>
				{rows.map((row, rowIndex) => {
					const rowKey = `row-${rowIndex}`;

					return (
						<TableRow key={rowKey}>
							{columns.map((column) => (
								<TableCell key={`${rowKey}-${column.key}`} className="text-center">
									{String(row[column.key])}
								</TableCell>
							))}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
