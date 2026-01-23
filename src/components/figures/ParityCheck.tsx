export interface ParityCheckProps {
	data: number[][]; // データビット行列
	width?: number;
	height?: number;
	cellSize?: number;
}

export function ParityCheck({ data, width = 300, height = 300, cellSize = 40 }: ParityCheckProps) {
	const rows = data.length;
	const cols = data[0]?.length || 0;

	// 水平パリティビットを計算
	const horizontalParity = data.map((row) => row.reduce((acc, bit) => acc ^ bit, 0));

	// 垂直パリティビットを計算
	const verticalParity = Array.from({ length: cols }, (_, colIndex) =>
		data.reduce((acc, row) => acc ^ row[colIndex], 0),
	);

	const dataCells = data.flatMap((row, rowIndex) =>
		row.map((bit, colIndex) => ({
			id: `data-${rowIndex}-${colIndex}`,
			bit,
			rowIndex,
			colIndex,
		})),
	);

	const horizontalCells = horizontalParity.map((bit, rowIndex) => ({
		id: `h-parity-${rowIndex}`,
		bit,
		rowIndex,
	}));

	const verticalCells = verticalParity.map((bit, colIndex) => ({
		id: `v-parity-${colIndex}`,
		bit,
		colIndex,
	}));

	// 全体パリティビット（右下）
	const totalParity = horizontalParity.reduce((acc, bit) => acc ^ bit, 0);

	// SVGの実際のサイズを計算
	const svgWidth = (cols + 2) * cellSize;
	const svgHeight = (rows + 2) * cellSize;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${svgWidth} ${svgHeight}`}
			className="border border-gray-300 rounded"
			aria-label="Parity check diagram"
		>
			<title>Parity check diagram</title>
			{/* データビット */}
			{dataCells.map((cell) => (
				<g key={cell.id}>
					{/* セル */}
					<rect
						x={(cell.colIndex + 1) * cellSize}
						y={(cell.rowIndex + 1) * cellSize}
						width={cellSize}
						height={cellSize}
						fill="white"
						stroke="black"
						strokeWidth="1"
					/>
					{/* ビット値 */}
					<text
						x={(cell.colIndex + 1.5) * cellSize}
						y={(cell.rowIndex + 1.5) * cellSize}
						fontSize="16"
						textAnchor="middle"
						dominantBaseline="middle"
						fill="black"
					>
						{cell.bit}
					</text>
				</g>
			))}

			{/* 水平パリティビット（右端） */}
			{horizontalCells.map((cell) => (
				<g key={cell.id}>
					<rect
						x={(cols + 1) * cellSize}
						y={(cell.rowIndex + 1) * cellSize}
						width={cellSize}
						height={cellSize}
						fill="#e0f2fe"
						stroke="black"
						strokeWidth="1"
					/>
					<text
						x={(cols + 1.5) * cellSize}
						y={(cell.rowIndex + 1.5) * cellSize}
						fontSize="16"
						textAnchor="middle"
						dominantBaseline="middle"
						fill="black"
					>
						{cell.bit}
					</text>
				</g>
			))}

			{/* 垂直パリティビット（下端） */}
			{verticalCells.map((cell) => (
				<g key={cell.id}>
					<rect
						x={(cell.colIndex + 1) * cellSize}
						y={(rows + 1) * cellSize}
						width={cellSize}
						height={cellSize}
						fill="#e0f2fe"
						stroke="black"
						strokeWidth="1"
					/>
					<text
						x={(cell.colIndex + 1.5) * cellSize}
						y={(rows + 1.5) * cellSize}
						fontSize="16"
						textAnchor="middle"
						dominantBaseline="middle"
						fill="black"
					>
						{cell.bit}
					</text>
				</g>
			))}

			{/* 全体パリティビット（右下） */}
			<g>
				<rect
					x={(cols + 1) * cellSize}
					y={(rows + 1) * cellSize}
					width={cellSize}
					height={cellSize}
					fill="#dbeafe"
					stroke="black"
					strokeWidth="1"
				/>
				<text
					x={(cols + 1.5) * cellSize}
					y={(rows + 1.5) * cellSize}
					fontSize="16"
					textAnchor="middle"
					dominantBaseline="middle"
					fill="black"
				>
					{totalParity}
				</text>
			</g>

			{/* ラベル */}
			<text
				x={0.5 * cellSize}
				y={0.5 * cellSize}
				fontSize="12"
				textAnchor="middle"
				dominantBaseline="middle"
				fill="black"
			>
				Data
			</text>
			<text
				x={(cols + 1.5) * cellSize}
				y={0.5 * cellSize}
				fontSize="12"
				textAnchor="middle"
				dominantBaseline="middle"
				fill="black"
			>
				H
			</text>
			<text
				x={0.5 * cellSize}
				y={(rows + 1.5) * cellSize}
				fontSize="12"
				textAnchor="middle"
				dominantBaseline="middle"
				fill="black"
			>
				V
			</text>
		</svg>
	);
}
