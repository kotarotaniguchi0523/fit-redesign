import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { calculateParity } from "./parity-check.ts";

describe("calculateParity", () => {
	it("calculates correct XOR parity for a known input", () => {
		const data = [
			[1, 0, 1],
			[0, 1, 0],
		];
		const result = calculateParity(data, 40);

		// Horizontal parity: row0 = 1^0^1 = 0, row1 = 0^1^0 = 1
		assert.deepEqual(result.horizontalParity, [0, 1]);

		// Vertical parity: col0 = 1^0 = 1, col1 = 0^1 = 1, col2 = 1^0 = 1
		assert.deepEqual(result.verticalParity, [1, 1, 1]);

		// Total parity: 0^1 = 1 (XOR of horizontal parity bits)
		assert.equal(result.totalParity, 1);
	});

	it("returns total parity 0 when all horizontal parities cancel", () => {
		const data = [
			[1, 1],
			[1, 1],
		];
		const result = calculateParity(data, 40);

		// Horizontal: row0 = 1^1 = 0, row1 = 1^1 = 0
		assert.deepEqual(result.horizontalParity, [0, 0]);
		// Total: 0^0 = 0
		assert.equal(result.totalParity, 0);
	});

	it("produces correct data cells", () => {
		const data = [
			[1, 0],
			[0, 1],
		];
		const result = calculateParity(data, 40);

		assert.equal((result.dataCells).length, 4);
		assert.deepEqual(result.dataCells[0], { bit: 1, rowIndex: 0, colIndex: 0 });
		assert.deepEqual(result.dataCells[3], { bit: 1, rowIndex: 1, colIndex: 1 });
	});

	it("calculates SVG dimensions correctly", () => {
		const data = [
			[1, 0, 1],
			[0, 1, 0],
		];
		const cellSize = 40;
		const result = calculateParity(data, cellSize);

		// rows=2, cols=3 => svgWidth = (3+2)*40 = 200, svgHeight = (2+2)*40 = 160
		assert.equal(result.svgWidth, (3 + 2) * cellSize);
		assert.equal(result.svgHeight, (2 + 2) * cellSize);
	});

	it("reports correct rows and cols counts", () => {
		const data = [
			[0, 0, 0, 1],
			[1, 1, 0, 0],
			[0, 1, 1, 0],
		];
		const result = calculateParity(data, 30);
		assert.equal(result.rows, 3);
		assert.equal(result.cols, 4);
	});
});
