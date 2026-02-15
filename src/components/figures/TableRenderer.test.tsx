import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableRenderer } from "./TableRenderer";
import type { FigureData } from "../../types/index";

describe("TableRenderer", () => {
    it("renders DataTable correctly", () => {
        const figureData: FigureData = {
            type: "dataTable",
            columns: [
                { key: "id", label: "ID" },
                { key: "name", label: "Name" },
            ],
            rows: [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
            ],
        };

        render(<TableRenderer figureData={figureData} />);

        expect(screen.getByText("ID")).toBeTruthy();
        expect(screen.getByText("Name")).toBeTruthy();
        expect(screen.getByText("Alice")).toBeTruthy();
        expect(screen.getByText("Bob")).toBeTruthy();
    });

    it("renders HuffmanTable correctly", () => {
        const figureData: FigureData = {
            type: "huffmanTable",
            data: {
                characters: ["A", "B"],
                probabilities: [0.5, 0.25],
            },
        };

        render(<TableRenderer figureData={figureData} />);

        expect(screen.getByText("文字")).toBeTruthy();
        expect(screen.getByText("確率")).toBeTruthy();
        expect(screen.getByText("A")).toBeTruthy();
        expect(screen.getByText("0.5")).toBeTruthy();
        expect(screen.getByText("B")).toBeTruthy();
        expect(screen.getByText("0.25")).toBeTruthy();
    });

    it("renders LinkedListTable correctly", () => {
        const figureData: FigureData = {
            type: "linkedListTable",
            entries: [
                { address: 100, data: "Data1", pointer: 200 },
                { address: 200, data: "Data2", pointer: 300 },
            ],
        };

        render(<TableRenderer figureData={figureData} />);

        expect(screen.getByText("アドレス")).toBeTruthy();
        expect(screen.getByText("データ")).toBeTruthy();
        expect(screen.getByText("ポインタ")).toBeTruthy();
        expect(screen.getAllByText("100").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Data1").length).toBeGreaterThan(0);
        expect(screen.getAllByText("200").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Data2").length).toBeGreaterThan(0);
    });

    it("renders NormalDistributionTable correctly", () => {
        const figureData: FigureData = {
            type: "normalDistributionTable",
            entries: [
                { u: 0.0, probability: 0.3989 },
                { u: 1.0, probability: 0.2420 },
            ],
        };

        render(<TableRenderer figureData={figureData} />);

        expect(screen.getByText("u")).toBeTruthy();
        expect(screen.getByText("確率")).toBeTruthy();
        // Exact matching might be tricky with numbers, but let's try string matching
        expect(screen.getByText("0")).toBeTruthy();
        expect(screen.getByText("0.3989")).toBeTruthy();
        expect(screen.getByText("1")).toBeTruthy();
        // 0.2420 might be rendered as 0.242 or 0.2420 depending on String() conversion.
        // String(0.2420) is "0.242".
        expect(screen.getByText("0.242")).toBeTruthy();
    });
});
