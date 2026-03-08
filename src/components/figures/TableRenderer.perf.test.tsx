import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import type { DataTableColumn, DataTableRow, FigureData } from "../../types/index";
import { TableRenderer } from "./TableRenderer";

describe("TableRenderer Performance", () => {
	const rowCount = 1000;
	const colCount = 10;
	const columns: DataTableColumn[] = Array.from({ length: colCount }, (_, i) => ({
		key: `col${i}`,
		label: `Column ${i}`,
	}));
	const rows: DataTableRow[] = Array.from({ length: rowCount }, (_, r) => {
		const row: DataTableRow = {};
		for (let c = 0; c < colCount; c++) {
			row[`col${c}`] = `val-${r}-${c}`;
		}
		return row;
	});

	const figureData: FigureData = {
		type: "dataTable",
		columns,
		rows,
	};

	it("benchmark render performance", { timeout: 60000 }, () => {
		const start = performance.now();
		const { rerender } = render(<TableRenderer figureData={figureData} />);

		// Initial render time
		const initial = performance.now();
		console.log(`Initial render took ${initial - start}ms`);

		const iterations = 5;
		for (let i = 0; i < iterations; i++) {
			// Force re-render by passing a new object (shallow copy)
			rerender(<TableRenderer figureData={{ ...figureData }} />);
		}

		const end = performance.now();
		console.log(`Re-rendering ${iterations} times took ${end - initial}ms`);
		console.log(`Average re-render time: ${(end - initial) / iterations}ms`);
	});
});
