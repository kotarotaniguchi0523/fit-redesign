import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types/index.ts";
import { getGateSymbolPath, getLogicCircuitViewport, getWirePath } from "./logic-circuit.ts";

describe("getGateSymbolPath", () => {
	const gateTypes = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"] as const;

	for (const type of gateTypes) {
		it(`returns a non-empty SVG string for gate type "${type}"`, () => {
			const gate: LogicGate = { id: "g1", type, x: 100, y: 100 };
			const result = getGateSymbolPath(gate);
			assert.ok((result.length) > (0));
			assert.ok((result).includes("<g>"));
		});
	}
});

describe("getWirePath", () => {
	const inputs: LogicInput[] = [{ id: "i1", label: "A", x: 20, y: 50 }];
	const outputs: LogicOutput[] = [{ id: "o1", label: "Y", x: 300, y: 50, input: "g1" }];
	const gates: LogicGate[] = [{ id: "g1", type: "AND", x: 150, y: 50 }];

	it("returns a path string for a valid wire from input to gate", () => {
		const wire: LogicWire = { from: "i1", to: "g1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		assert.ok(result !== null);
		assert.ok((result).includes("M"));
		assert.ok((result).includes("L"));
	});

	it("returns a path string for a valid wire from gate to output", () => {
		const wire: LogicWire = { from: "g1", to: "o1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		assert.ok(result !== null);
		assert.ok((result).includes("M"));
	});

	it("returns null for a wire with a missing source element", () => {
		const wire: LogicWire = { from: "nonexistent", to: "g1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		assert.equal(result, null);
	});

	it("returns null for a wire with a missing target element", () => {
		const wire: LogicWire = { from: "i1", to: "nonexistent" };
		const result = getWirePath(wire, inputs, outputs, gates);
		assert.equal(result, null);
	});

	it("includes all waypoints in the path when wire has points", () => {
		const wire: LogicWire = {
			from: "i1",
			to: "g1",
			points: [
				{ x: 60, y: 50 },
				{ x: 80, y: 70 },
			],
		};
		const result = getWirePath(wire, inputs, outputs, gates);
		assert.ok(result !== null);
		assert.ok((result).includes("60 50"));
		assert.ok((result).includes("80 70"));
	});

	it("connects an explicit route horizontally to a gate input", () => {
		const wire: LogicWire = {
			from: "i1",
			to: "g1",
			points: [
				{ x: 60, y: 50 },
				{ x: 80, y: 40 },
			],
		};

		assert.equal(getWirePath(wire, inputs, outputs, gates), "M 40 50 L 60 50 L 80 40 L 125 40");
	});
});

describe("getLogicCircuitViewport", () => {
	it("fits the 2016 circuit to its content instead of the 500x300 default canvas", () => {
		const viewport = getLogicCircuitViewport(
			[
				{ id: "A", label: "A", x: 50, y: 60 },
				{ id: "B", label: "B", x: 50, y: 120 },
			],
			[{ id: "X", label: "X", x: 300, y: 90, input: "OR1" }],
			[
				{ id: "NOT1", type: "NOT", x: 120, y: 120 },
				{ id: "OR1", type: "OR", x: 200, y: 90 },
			],
			[],
		);

		assert.ok((viewport.width) < (350));
		assert.ok((viewport.height) < (150));
		assert.ok((viewport.x) < (50));
		assert.ok((viewport.y) < (60));
	});
});
