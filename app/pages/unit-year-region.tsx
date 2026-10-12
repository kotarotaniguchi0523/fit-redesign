import type { Handle } from "remix/component";

import { type ExamSection, ExamSections } from "./exam-sections.tsx";

/**
 * 単元・年度の小テスト一覧のみを返す Frame ソース。
 * `Document` を含めない（Remix ガイド: frame action は領域だけを返す）。
 */
export function UnitYearRegion(
	handle: Handle<{ unitId: string; year: string; sections: readonly ExamSection[] }>,
) {
	return () => (
		<ExamSections
			unitId={handle.props.unitId}
			year={handle.props.year}
			sections={handle.props.sections}
		/>
	);
}
