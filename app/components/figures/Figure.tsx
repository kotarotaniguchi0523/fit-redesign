import type { JSX } from "hono/jsx/jsx-runtime";
import type { FigureData } from "../../types";
import { BinaryTree } from "./BinaryTree";
import { Flowchart } from "./Flowchart";
import { LogicCircuit } from "./LogicCircuit";
import { ParityCheck } from "./ParityCheck";
import { StateDiagram } from "./StateDiagram";
import { TableRenderer } from "./TableRenderer";
import { TruthTable } from "./TruthTable";

interface FigureProps {
	data: FigureData;
	responsive?: boolean;
	rasterTextOverlay?: boolean;
}

function assertNever(value: never): never {
	throw new Error(`Unknown figure type: ${JSON.stringify(value)}`);
}

/** FigureData の判別可能 Union を、対応する Hono JSX 図表へ変換する。 */
export function Figure({
	data,
	responsive = true,
	rasterTextOverlay = false,
}: FigureProps): JSX.Element {
	switch (data.type) {
		case "stateDiagram":
			return <StateDiagram nodes={data.nodes} transitions={data.transitions} />;
		case "binaryTree":
			return <BinaryTree root={data.root} width={data.width} height={data.height} />;
		case "truthTable":
			return <TruthTable columns={data.columns} rows={data.rows} />;
		case "parityCheck":
			return <ParityCheck data={data.data} />;
		case "logicCircuit":
			return (
				<LogicCircuit
					inputs={data.inputs}
					outputs={data.outputs}
					gates={data.gates}
					wires={data.wires}
					width={data.width}
					height={data.height}
					responsive={responsive}
					rasterTextOverlay={rasterTextOverlay}
				/>
			);
		case "flowchart":
			return (
				<Flowchart nodes={data.nodes} edges={data.edges} width={data.width} height={data.height} />
			);
		case "dataTable":
		case "huffmanTable":
		case "linkedListTable":
		case "normalDistributionTable":
			return <TableRenderer figureData={data} />;
		default:
			return assertNever(data);
	}
}
