import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type {
	DataTableColumn,
	DataTableRow,
	FigureData,
	HuffmanTableData,
	LinkedListEntry,
	NormalDistributionEntry,
} from "../../types/index";

// TableRenderer が扱う FigureData 型のみを抽出
type TableFigureData = Extract<
	FigureData,
	| { type: "dataTable" }
	| { type: "huffmanTable" }
	| { type: "linkedListTable" }
	| { type: "normalDistributionTable" }
>;

export interface TableRendererProps {
	figureData: TableFigureData;
}

export function TableRenderer({ figureData }: TableRendererProps) {
	switch (figureData.type) {
		case "dataTable":
			return <DataTable columns={figureData.columns} rows={figureData.rows} />;
		case "huffmanTable":
			return <HuffmanTable data={figureData.data} />;
		case "linkedListTable":
			return <LinkedListTable entries={figureData.entries} />;
		case "normalDistributionTable":
			return <NormalDistributionTable entries={figureData.entries} />;
	}
}

// 汎用データテーブル
interface DataTableProps {
	columns: DataTableColumn[];
	rows: DataTableRow[];
}

function DataTable({ columns, rows }: DataTableProps) {
	return (
		<Table aria-label="Data table" className="max-w-2xl">
			<TableHeader>
				{columns.map((column) => (
					<TableColumn key={column.key} className="text-center">
						{column.label}
					</TableColumn>
				))}
			</TableHeader>
			<TableBody>
				{rows.map((row, index) => {
					const rowKey = `row-${index}-${columns.map((col) => String(row[col.key])).join("-")}`;
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

// ハフマン符号表
interface HuffmanTableProps {
	data: HuffmanTableData;
}

function HuffmanTable({ data }: HuffmanTableProps) {
	const columns = [
		{ key: "character", label: "文字" },
		{ key: "probability", label: "確率" },
	];

	return (
		<Table aria-label="Huffman coding table" className="max-w-2xl">
			<TableHeader>
				{columns.map((column) => (
					<TableColumn key={column.key} className="text-center">
						{column.label}
					</TableColumn>
				))}
			</TableHeader>
			<TableBody>
				{data.characters.map((character, index) => {
					const rowKey = `huffman-${index}-${character}`;
					return (
						<TableRow key={rowKey}>
							<TableCell className="text-center">{character}</TableCell>
							<TableCell className="text-center">{data.probabilities[index]}</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

// リンクリスト（ポインタ）表
interface LinkedListTableProps {
	entries: LinkedListEntry[];
}

function LinkedListTable({ entries }: LinkedListTableProps) {
	const columns = [
		{ key: "address", label: "アドレス" },
		{ key: "data", label: "データ" },
		{ key: "pointer", label: "ポインタ" },
	];

	return (
		<Table aria-label="Linked list table" className="max-w-2xl">
			<TableHeader>
				{columns.map((column) => (
					<TableColumn key={column.key} className="text-center">
						{column.label}
					</TableColumn>
				))}
			</TableHeader>
			<TableBody>
				{entries.map((entry, index) => {
					const rowKey = `linkedlist-${index}-${entry.address}`;
					return (
						<TableRow key={rowKey}>
							<TableCell className="text-center">{String(entry.address)}</TableCell>
							<TableCell className="text-center">{entry.data}</TableCell>
							<TableCell className="text-center">{String(entry.pointer)}</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

// 正規分布表
interface NormalDistributionTableProps {
	entries: NormalDistributionEntry[];
}

function NormalDistributionTable({ entries }: NormalDistributionTableProps) {
	const columns = [
		{ key: "u", label: "u" },
		{ key: "probability", label: "確率" },
	];

	return (
		<Table aria-label="Normal distribution table" className="max-w-2xl">
			<TableHeader>
				{columns.map((column) => (
					<TableColumn key={column.key} className="text-center">
						{column.label}
					</TableColumn>
				))}
			</TableHeader>
			<TableBody>
				{entries.map((entry, index) => {
					const rowKey = `normal-${index}-${entry.u}`;
					return (
						<TableRow key={rowKey}>
							<TableCell className="text-center">{entry.u}</TableCell>
							<TableCell className="text-center">{entry.probability}</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
