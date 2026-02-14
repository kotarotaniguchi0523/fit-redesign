import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types/figures";
import { LogicCircuit } from "./LogicCircuit";

describe("LogicCircuit", () => {
	const sampleData = {
		inputs: [
			{ id: "X", label: "X", x: 50, y: 80 },
			{ id: "Y", label: "Y", x: 50, y: 140 },
		] as LogicInput[],
		outputs: [{ id: "Z", label: "Z", x: 450, y: 105, input: "XOR1" }] as LogicOutput[],
		gates: [
			{ id: "AND1", type: "AND", x: 150, y: 80 },
			{ id: "NOT1", type: "NOT", x: 150, y: 120 },
			{ id: "OR1", type: "OR", x: 250, y: 130 },
			{ id: "XOR1", type: "XOR", x: 350, y: 105 },
		] as LogicGate[],
		wires: [
			{ from: "X", to: "AND1" },
			{ from: "Y", to: "AND1" },
			{ from: "X", to: "NOT1" },
			{ from: "NOT1", to: "OR1" },
			{ from: "Y", to: "OR1" },
			{ from: "AND1", to: "XOR1" },
			{ from: "OR1", to: "XOR1" },
			{ from: "XOR1", to: "Z" },
		] as LogicWire[],
	};

	it("renders without crashing", () => {
		const { container } = render(<LogicCircuit {...sampleData} />);
		expect(container.querySelector("svg")).toBeTruthy();
		expect(container.querySelectorAll("g").length).toBeGreaterThan(0);
	});

	it("benchmark rendering performance (small dataset)", { timeout: 15000 }, () => {
		const iterations = 1000;
		const start = performance.now();
		for (let i = 0; i < iterations; i++) {
			render(<LogicCircuit {...sampleData} />);
		}
		const end = performance.now();
		console.log(`Small dataset: Rendering ${iterations} times took ${end - start}ms`);
	});

	it("benchmark rendering performance (large synthetic dataset)", { timeout: 20000 }, () => {
		// Generate a larger dataset
		const largeInputs: LogicInput[] = [];
		const largeGates: LogicGate[] = [];
		const largeOutputs: LogicOutput[] = [];
		const largeWires: LogicWire[] = [];

		const count = 100;

		for (let i = 0; i < count; i++) {
			largeInputs.push({ id: `in${i}`, label: `I${i}`, x: 0, y: i * 10 });
			largeGates.push({ id: `g${i}`, type: "AND", x: 100, y: i * 10 });
			largeOutputs.push({ id: `out${i}`, label: `O${i}`, x: 200, y: i * 10, input: `g${i}` });

			largeWires.push({ from: `in${i}`, to: `g${i}` });
			largeWires.push({ from: `g${i}`, to: `out${i}` });
		}

		// Connect gates to each other to increase wire complexity
		for (let i = 0; i < count - 1; i++) {
			largeWires.push({ from: `g${i}`, to: `g${i + 1}` });
		}

		const largeData = {
			inputs: largeInputs,
			outputs: largeOutputs,
			gates: largeGates,
			wires: largeWires,
		};

		const iterations = 100;
		const start = performance.now();
		for (let i = 0; i < iterations; i++) {
			render(<LogicCircuit {...largeData} />);
		}
		const end = performance.now();
		console.log(
			`Large dataset (${largeWires.length} wires): Rendering ${iterations} times took ${end - start}ms`,
		);
	});
});
