import type { Handle } from 'remix/component'

import type { FigureData } from "../../types/index.ts";
import { BinaryTree } from "./BinaryTree.tsx";
import { Flowchart } from "./Flowchart.tsx";
import { LogicCircuit } from "./LogicCircuit.tsx";
import { ParityCheck } from "./ParityCheck.tsx";
import { StateDiagram } from "./StateDiagram.tsx";
import { TableRenderer } from "./TableRenderer.tsx";

interface FigureProps {
	data: FigureData;
	mode?: FigureRenderMode;
}

export type FigureRenderMode = "responsive" | "fixed" | "raster";

function assertNever(value: never): never {
	throw new Error(`Unknown figure type: ${JSON.stringify(value)}`);
}

/** FigureData の判別可能 Union を、対応する Hono JSX 図表へ変換する。 */
export function Figure(handle: Handle<FigureProps>) {
	return () => {
		const { data, mode = "responsive" } = handle.props

	switch (data.type) {
		case "stateDiagram":
			return <StateDiagram nodes={data.nodes} transitions={data.transitions} />;
		case "binaryTree":
			return <BinaryTree root={data.root} width={data.width} height={data.height} />;
		case "parityCheck":
			return <ParityCheck data={data.data} />;
		case "logicCircuit":
			return <LogicCircuit circuit={data} mode={mode} />;
		case "flowchart":
			return (
				<Flowchart nodes={data.nodes} edges={data.edges} width={data.width} height={data.height} />
			);
		case "dataTable":
		case "truthTable":
		case "huffmanTable":
		case "linkedListTable":
		case "normalDistributionTable":
			return <TableRenderer figureData={data} />;
		default:
			return assertNever(data);
	}
}

}
