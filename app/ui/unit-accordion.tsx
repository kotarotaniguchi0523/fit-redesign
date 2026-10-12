import * as accordion from "@remix-run/ui/accordion";
import type { Handle } from "remix/component";
import { clientEntry, css } from "remix/component";

import { routes } from "../routes.ts";

export type AccordionUnit = Readonly<{
	id: string;
	icon: string;
	name: string;
	years: readonly string[];
}>;

const rootStyle = css({
	"& button": {
		width: "100%",
		padding: "0.625rem 0.75rem",
		border: "1px solid var(--color-border)",
		borderRadius: "var(--radius-control)",
		background: "var(--color-bg-card)",
		font: "inherit",
		textAlign: "left",
		cursor: "pointer",
	},
});

const panelStyle = css({
	display: "grid",
	gap: "0.25rem",
	padding: "0.5rem 0.75rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/**
 * ホームの単元リスト（狭い画面用のアコーディオン）。
 * `@remix-run/ui/accordion` の開閉を `mix` で借り、`clientEntry` で hydrate する。
 */
export const UnitAccordion = clientEntry(
	"/assets/client.js#UnitAccordion",
	function UnitAccordionEntry(handle: Handle<{ units: readonly AccordionUnit[] }>) {
		return () => (
			<accordion.Context type="multiple">
				<div mix={rootStyle}>
					{handle.props.units.map((unit) => (
						<accordion.ItemContext key={unit.id} value={unit.id}>
							<div mix={accordion.item()}>
								<button type="button" mix={accordion.trigger()}>
									{unit.icon} {unit.name}
								</button>
								<div mix={accordion.content()}>
									<div mix={panelStyle}>
										{unit.years.map((year) => (
											<a
												key={year}
												mix={linkStyle}
												href={routes.unitYear.href({ unit: unit.id, year })}
											>
												{year}年度
											</a>
										))}
									</div>
								</div>
							</div>
						</accordion.ItemContext>
					))}
				</div>
			</accordion.Context>
		);
	},
);
