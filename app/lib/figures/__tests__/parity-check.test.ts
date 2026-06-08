import { describe, expect, it } from "vitest";
import { calculateParity } from "../parity-check";

describe("calculateParity", () => {
	it("calculates correct XOR parity for a known input", () => {
		const data = [
			[1, 0, 1],
			[0, 1, 0],
		];
		const result = calculateParity(data, 40);

		// Horizontal parity: row0 = 1^0^1 = 0, row1 = 0^1^0 = 1
		expect(result.horizontalParity).toEqual([0, 1]);

		// Vertical parity: col0 = 1^0 = 1, col1 = 0^1 = 1, col2 = 1^0 = 1
		expect(result.verticalParity).toEqual([1, 1, 1]);

		// Total parity: 0^1 = 1 (XOR of horizontal parity bits)
		expect(result.totalParity).toBe(1);
	});

	it("returns total parity 0 when all horizontal parities cancel", () => {
		const data = [
			[1, 1],
			[1, 1],
		];
		const result = calculateParity(data, 40);

		// Horizontal: row0 = 1^1 = 0, row1 = 1^1 = 0
		expect(result.horizontalParity).toEqual([0, 0]);
		// Total: 0^0 = 0
		expect(result.totalParity).toBe(0);
	});

	it("produces correct data cells", () => {
		const data = [
			[1, 0],
			[0, 1],
		];
		const result = calculateParity(data, 40);

		expect(result.dataCells).toHaveLength(4);
		expect(result.dataCells[0]).toEqual({ bit: 1, rowIndex: 0, colIndex: 0 });
		expect(result.dataCells[3]).toEqual({ bit: 1, rowIndex: 1, colIndex: 1 });
	});

	it("calculates SVG dimensions correctly", () => {
		const data = [
			[1, 0, 1],
			[0, 1, 0],
		];
		const cellSize = 40;
		const result = calculateParity(data, cellSize);

		// rows=2, cols=3 => svgWidth = (3+2)*40 = 200, svgHeight = (2+2)*40 = 160
		expect(result.svgWidth).toBe((3 + 2) * cellSize);
		expect(result.svgHeight).toBe((2 + 2) * cellSize);
	});

	it("reports correct rows and cols counts", () => {
		const data = [
			[0, 0, 0, 1],
			[1, 1, 0, 0],
			[0, 1, 1, 0],
		];
		const result = calculateParity(data, 30);
		expect(result.rows).toBe(3);
		expect(result.cols).toBe(4);
	});
});
