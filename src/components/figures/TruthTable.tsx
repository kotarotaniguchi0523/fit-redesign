import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

export interface TruthTableColumn {
	key: string;
	label: string;
}

export interface TruthTableRow {
	[key: string]: string | number | boolean;
}

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
				{rows.map((row, index) => (
					<TableRow key={`row-${index}`}>
						{columns.map((column) => (
							<TableCell key={`${index}-${column.key}`} className="text-center">
								{String(row[column.key])}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
