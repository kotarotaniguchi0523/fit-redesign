import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types/figures";
import { LogicCircuit } from "./LogicCircuit";

describe("LogicCircuit Performance", () => {
	// Large dataset for noticeable impact
	const count = 300;
	const largeInputs: LogicInput[] = [];
	const largeGates: LogicGate[] = [];
	const largeOutputs: LogicOutput[] = [];
	const largeWires: LogicWire[] = [];

	for (let i = 0; i < count; i++) {
		largeInputs.push({ id: `in${i}`, label: `I${i}`, x: 0, y: i * 10 });
		largeGates.push({ id: `g${i}`, type: "AND", x: 100, y: i * 10 });
		largeOutputs.push({ id: `out${i}`, label: `O${i}`, x: 200, y: i * 10, input: `g${i}` });

		largeWires.push({ from: `in${i}`, to: `g${i}` });
		largeWires.push({ from: `g${i}`, to: `out${i}` });
	}
	// Interconnect gates
	for (let i = 0; i < count - 1; i++) {
		largeWires.push({ from: `g${i}`, to: `g${i + 1}` });
	}

	const largeData = {
		inputs: largeInputs,
		outputs: largeOutputs,
		gates: largeGates,
		wires: largeWires,
	};

	it("benchmark re-render performance", { timeout: 60000 }, () => {
		const { rerender } = render(<LogicCircuit {...largeData} width={500} />);

		const iterations = 500;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			// Change a prop that is NOT involved in the elementMap (e.g., width)
			// to trigger a re-render.
			// If useMemo is working, elementMap construction should be skipped.
			rerender(<LogicCircuit {...largeData} width={500 + i} />);
		}

		const end = performance.now();
		console.log(`Re-rendering ${iterations} times took ${end - start}ms`);
	});
});
