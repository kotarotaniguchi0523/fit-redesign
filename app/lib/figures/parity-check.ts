export interface ParityCell {
	bit: number;
	rowIndex: number;
	colIndex: number;
}

export interface ParityResult {
	rows: number;
	cols: number;
	dataCells: ParityCell[];
	horizontalParity: number[];
	verticalParity: number[];
	totalParity: number;
	svgWidth: number;
	svgHeight: number;
}

export function calculateParity(data: number[][], cellSize: number): ParityResult {
	const rows = data.length;
	const cols = data[0]?.length || 0;

	const horizontalParity = data.map((row) => row.reduce((acc, bit) => acc ^ bit, 0));

	const verticalParity = Array.from({ length: cols }, (_, colIndex) =>
		data.reduce((acc, row) => acc ^ row[colIndex], 0),
	);

	const dataCells = data.flatMap((row, rowIndex) =>
		row.map((bit, colIndex) => ({
			bit,
			rowIndex,
			colIndex,
		})),
	);

	const totalParity = horizontalParity.reduce((acc, bit) => acc ^ bit, 0);

	return {
		rows,
		cols,
		dataCells,
		horizontalParity,
		verticalParity,
		totalParity,
		svgWidth: (cols + 2) * cellSize,
		svgHeight: (rows + 2) * cellSize,
	};
}
