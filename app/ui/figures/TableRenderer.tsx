import type { Handle } from "remix/component";
import { css } from "remix/component";

import { buildTableConfig, type TableFigureData } from "../../lib/figures/table-renderer.ts";

const tableWrapStyle = css({ width: "100%", overflowX: "auto" });
const figureTableStyle = css({
	maxWidth: "42rem",
	minWidth: "max-content",
	borderCollapse: "collapse",
	border: "2px solid #1f2937",
	"& th, & td": { border: "1px solid #1f2937", padding: "0.5rem 0.75rem", textAlign: "center" },
	"& th": { background: "#f3f4f6", fontWeight: 700 },
	"& td": { fontFamily: "var(--font-mono)" },
});

interface TableRendererProps {
	figureData: TableFigureData;
}

export function TableRenderer(handle: Handle<TableRendererProps>) {
	return () => {
		const { figureData } = handle.props;

		const config = buildTableConfig(figureData);

		return (
			<div mix={tableWrapStyle}>
				<table aria-label={config.ariaLabel} mix={figureTableStyle}>
					<thead>
						<tr>
							{config.columns.map((column) => (
								<th>{column.label}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{config.rows.map((row) => (
							<tr>
								{config.columns.map((column) => (
									<td>{String(row[column.key])}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	};
}
