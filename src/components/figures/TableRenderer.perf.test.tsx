import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { TableRenderer } from "./TableRenderer";
import type { DataTableColumn, DataTableRow, FigureData } from "../../types/figures";

describe("TableRenderer Performance", () => {
	const rowCount = 200;
	const colCount = 20;
	const largeColumns: DataTableColumn[] = [];
	const largeRows: DataTableRow[] = [];

	for (let i = 0; i < colCount; i++) {
		largeColumns.push({ key: `col${i}`, label: `Col ${i}` });
	}

	for (let i = 0; i < rowCount; i++) {
		const row: DataTableRow = {};
		for (let j = 0; j < colCount; j++) {
			row[`col${j}`] = `val-${i}-${j}`;
		}
		largeRows.push(row);
	}

	const figureData: FigureData = {
		type: "dataTable",
		columns: largeColumns,
		rows: largeRows,
	};

	it("benchmark re-render performance", { timeout: 60000 }, () => {
		const { rerender } = render(<TableRenderer figureData={figureData} />);

		const iterations = 20; // Reduced iterations to avoid timeout in CI
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			// Trigger re-render by creating a new object reference for rows
			// React usually optimizes if props are strictly equal, so we shallow copy rows
			// to simulate a prop update.
			const newRows = [...largeRows];
            // We modify one value to ensure it's not just referential equality check skipping everything (if memoized)
            // But TableRenderer likely isn't memoized deeply anyway.
            newRows[0] = { ...newRows[0], col0: `val-update-${i}` };

			rerender(
				<TableRenderer
					figureData={{
						...figureData,
						rows: newRows,
					}}
				/>,
			);
		}

		const end = performance.now();
		console.log(`Re-rendering ${iterations} times took ${end - start}ms`);
	});
});
