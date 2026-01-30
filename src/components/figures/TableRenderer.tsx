import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { ReactNode } from "react";
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

function TableWrapper({ children }: { children: ReactNode }) {
	return <div className="w-full overflow-x-auto">{children}</div>;
}

// 共通のテーブルスタイル定義
const commonTableProps = {
	shadow: "none" as const,
	radius: "none" as const,
	classNames: {
		wrapper: "p-0",
		table: "border-2 border-gray-800 border-collapse",
		thead: "rounded-none",
		tbody: "rounded-none",
		tr: "rounded-none border-none shadow-none",
		th: "border border-gray-800 bg-gray-100 text-black font-bold text-center rounded-none",
		td: "border border-gray-800 text-black font-mono text-center rounded-none",
	},
};

// 汎用データテーブル
interface DataTableProps {
	columns: DataTableColumn[];
	rows: DataTableRow[];
}

function DataTable({ columns, rows }: DataTableProps) {
	return (
		<TableWrapper>
			<Table aria-label="Data table" className="max-w-2xl min-w-max" {...commonTableProps}>
				<TableHeader>
					{columns.map((column) => (
						<TableColumn key={column.key}>{column.label}</TableColumn>
					))}
				</TableHeader>
				<TableBody>
					{rows.map((row, index) => {
						const rowKey = `row-${index}-${columns.map((col) => String(row[col.key])).join("-")}`;
						return (
							<TableRow key={rowKey}>
								{columns.map((column) => (
									<TableCell key={`${rowKey}-${column.key}`}>{String(row[column.key])}</TableCell>
								))}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableWrapper>
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
		<TableWrapper>
			<Table
				aria-label="Huffman coding table"
				className="max-w-2xl min-w-max"
				{...commonTableProps}
			>
				<TableHeader>
					{columns.map((column) => (
						<TableColumn key={column.key}>{column.label}</TableColumn>
					))}
				</TableHeader>
				<TableBody>
					{data.characters.map((character, index) => {
						const rowKey = `huffman-${index}-${character}`;
						return (
							<TableRow key={rowKey}>
								<TableCell>{character}</TableCell>
								<TableCell>{data.probabilities[index]}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableWrapper>
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
		<TableWrapper>
			<Table aria-label="Linked list table" className="max-w-2xl min-w-max" {...commonTableProps}>
				<TableHeader>
					{columns.map((column) => (
						<TableColumn key={column.key}>{column.label}</TableColumn>
					))}
				</TableHeader>
				<TableBody>
					{entries.map((entry, index) => {
						const rowKey = `linkedlist-${index}-${entry.address}`;
						return (
							<TableRow key={rowKey}>
								<TableCell>{String(entry.address)}</TableCell>
								<TableCell>{entry.data}</TableCell>
								<TableCell>{String(entry.pointer)}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableWrapper>
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
		<TableWrapper>
			<Table
				aria-label="Normal distribution table"
				className="max-w-2xl min-w-max"
				{...commonTableProps}
			>
				<TableHeader>
					{columns.map((column) => (
						<TableColumn key={column.key}>{column.label}</TableColumn>
					))}
				</TableHeader>
				<TableBody>
					{entries.map((entry, index) => {
						const rowKey = `normal-${index}-${entry.u}`;
						return (
							<TableRow key={rowKey}>
								<TableCell>{entry.u}</TableCell>
								<TableCell>{entry.probability}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableWrapper>
	);
}
