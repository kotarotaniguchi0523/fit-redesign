import { describe, expect, it } from "vitest";
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../../types/index";
import { getGateSymbolPath, getWirePath } from "../logic-circuit";

describe("getGateSymbolPath", () => {
	const gateTypes = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"] as const;

	for (const type of gateTypes) {
		it(`returns a non-empty SVG string for gate type "${type}"`, () => {
			const gate: LogicGate = { id: "g1", type, x: 100, y: 100 };
			const result = getGateSymbolPath(gate);
			expect(result.length).toBeGreaterThan(0);
			expect(result).toContain("<g>");
		});
	}

	it("returns an empty string for an unknown gate type", () => {
		const gate = { id: "g1", type: "UNKNOWN", x: 100, y: 100 } as unknown as LogicGate;
		const result = getGateSymbolPath(gate);
		expect(result).toBe("");
	});
});

describe("getWirePath", () => {
	const inputs: LogicInput[] = [{ id: "i1", label: "A", x: 20, y: 50 }];
	const outputs: LogicOutput[] = [{ id: "o1", label: "Y", x: 300, y: 50, input: "g1" }];
	const gates: LogicGate[] = [{ id: "g1", type: "AND", x: 150, y: 50 }];

	it("returns a path string for a valid wire from input to gate", () => {
		const wire: LogicWire = { from: "i1", to: "g1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		expect(result).not.toBeNull();
		expect(result).toContain("M");
		expect(result).toContain("L");
	});

	it("returns a path string for a valid wire from gate to output", () => {
		const wire: LogicWire = { from: "g1", to: "o1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		expect(result).not.toBeNull();
		expect(result).toContain("M");
	});

	it("returns null for a wire with a missing source element", () => {
		const wire: LogicWire = { from: "nonexistent", to: "g1" };
		const result = getWirePath(wire, inputs, outputs, gates);
		expect(result).toBeNull();
	});

	it("returns null for a wire with a missing target element", () => {
		const wire: LogicWire = { from: "i1", to: "nonexistent" };
		const result = getWirePath(wire, inputs, outputs, gates);
		expect(result).toBeNull();
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
		expect(result).not.toBeNull();
		expect(result).toContain("60 50");
		expect(result).toContain("80 70");
	});
});
