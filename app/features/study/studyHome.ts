import { QUESTION_GRADED_EVENT } from "../../constants";
import { readEmbeddedManifest, type UnitManifestEntry } from "../srs/progressClient";
import { buildDailySet, loadSrsState, unitReadiness } from "../srs/srs";

/**
 * ホームのハブ。試験本番メーター・今日の道・単元別習熟度を、埋め込みマニフェスト＋
 * localStorage の SRS 状態から描画する。旧 study-home Web Component の脱 customElements 版。
 *
 * UI 自体はサーバー描画済み（バー・行・CTA）で、本モジュールは算出した値を既存 DOM に
 * 反映する命令的アップデータ。hono/jsx で再描画するとサーバー構造を二重化するため、
 * ここでは値の同期に徹する（採点イベントで再計算）。
 */

interface UnitStat {
	entry: UnitManifestEntry;
	readiness: number;
	due: number;
}

/** mount 時に 1 回だけ引く DOM 参照。rerender はこれを使い回す（毎回 querySelector しない）。 */
interface StudyHomeRefs {
	overallValue: HTMLElement | null;
	overallBar: HTMLElement | null;
	overallDue: HTMLElement | null;
	unitRows: Map<string, { bar: HTMLElement | null; value: HTMLElement | null }>;
	cta: HTMLAnchorElement | null;
	ctaLabel: HTMLElement | null;
	ctaSub: HTMLElement | null;
}

/** manifest（静的）と DOM 参照を mount 時に 1 回だけ確定し、rerender 用にキャッシュする。 */
function cacheRefs(el: HTMLElement, manifest: UnitManifestEntry[]): StudyHomeRefs {
	const unitRows = new Map<string, { bar: HTMLElement | null; value: HTMLElement | null }>(
		manifest.map((entry) => {
			const row = el.querySelector<HTMLElement>(`[data-unit-row="${entry.id}"]`);
			return [
				entry.id,
				{
					bar: row?.querySelector<HTMLElement>("[data-unit-bar]") ?? null,
					value: row?.querySelector<HTMLElement>("[data-unit-value]") ?? null,
				},
			];
		}),
	);

	return {
		overallValue: el.querySelector<HTMLElement>("[data-overall-value]"),
		overallBar: el.querySelector<HTMLElement>("[data-overall-bar]"),
		overallDue: el.querySelector<HTMLElement>("[data-overall-due]"),
		unitRows,
		cta: el.querySelector<HTMLAnchorElement>("[data-today-cta]"),
		ctaLabel: el.querySelector<HTMLElement>("[data-cta-label]"),
		ctaSub: el.querySelector<HTMLElement>("[data-cta-sub]"),
	};
}

function render(manifest: UnitManifestEntry[], refs: StudyHomeRefs): void {
	const state = loadSrsState();
	const now = Date.now();

	const stats: UnitStat[] = manifest.map((entry) => ({
		entry,
		readiness: unitReadiness(state, entry.questionIds),
		due: buildDailySet(state, entry.questionIds, now).questionIds.length,
	}));

	// 全体メーターは統合試験で共有される問題IDを二重計上しないようユニーク化して計算
	const uniqueIds = [...new Set(manifest.flatMap((u) => u.questionIds))];
	const overall = unitReadiness(state, uniqueIds);

	const target = pickTarget(stats);
	renderOverall(refs, overall, target);
	renderUnits(refs, stats);
	renderCta(refs, target);
}

/** 今日取り組む単元: 今日やる分がある中で習熟度が最も低いもの。なければ未完了で最も低いもの */
function pickTarget(stats: UnitStat[]): UnitStat | undefined {
	const withDue = stats.filter((u) => u.due > 0).sort((a, b) => a.readiness - b.readiness);
	const incomplete = stats
		.filter((u) => u.entry.questionIds.length > 0 && u.readiness < 100)
		.sort((a, b) => a.readiness - b.readiness);
	return withDue[0] ?? incomplete[0] ?? stats[0];
}

function renderOverall(refs: StudyHomeRefs, overall: number, target: UnitStat | undefined): void {
	if (refs.overallValue) refs.overallValue.textContent = `${overall}%`;
	if (refs.overallBar) refs.overallBar.style.width = `${overall}%`;
	// 「今日やる分」は今取り組む単元の分だけ（小さく区切る）
	if (refs.overallDue) refs.overallDue.textContent = String(target?.due ?? 0);
}

function renderUnits(refs: StudyHomeRefs, stats: UnitStat[]): void {
	// キャッシュ済み DOM ref を更新する副作用ループ。
	for (const stat of stats) {
		const row = refs.unitRows.get(stat.entry.id);
		if (!row) continue;
		if (row.bar) row.bar.style.width = `${stat.readiness}%`;
		if (row.value) row.value.textContent = `${stat.readiness}%`;
	}
}

function renderCta(refs: StudyHomeRefs, target: UnitStat | undefined): void {
	if (!target) return;

	if (refs.cta) refs.cta.href = `/today/${target.entry.id}`;
	if (refs.ctaLabel) {
		refs.ctaLabel.textContent =
			target.due > 0 ? `今日の道を始める（${target.entry.name}）` : "復習を始める";
	}
	if (refs.ctaSub) {
		refs.ctaSub.textContent =
			target.due > 0
				? `${target.entry.name}に今日のぶんが ${target.due}問あります`
				: `${target.entry.name}から始めましょう`;
	}
}

/** `[data-study-home]` 要素を初期描画し、採点イベントで再描画する。 */
export function initStudyHome(): void {
	// mount 時に manifest（静的）と DOM 参照を 1 回だけ確定し、各要素の rerender を作る。
	// manifest が空の要素はサーバー DOM に反映すべき値が無いので rerender を持たない。
	const rerenders = Array.from(document.querySelectorAll<HTMLElement>("[data-study-home]"))
		.map((el) => {
			const manifest = readEmbeddedManifest(el);
			if (manifest.length === 0) return undefined;
			const refs = cacheRefs(el, manifest);
			const rerender = () => render(manifest, refs);
			rerender();
			return rerender;
		})
		.filter((rerender): rerender is () => void => rerender !== undefined);

	if (rerenders.length === 0) return;

	// 採点イベントは要素ごとでなく document に 1 回だけ登録し、全 mount 済み要素を再描画する
	// （要素ごとに addEventListener すると複数要素時に多重発火する）。他タブ等で採点された
	// 場合に備えた更新で、同一ページでは通常発火しない。解除しない（mountAll のライフサイクル
	// 契約: ページ寿命まで生存）。
	document.addEventListener(QUESTION_GRADED_EVENT, () => {
		rerenders.map((rerender) => rerender());
	});
}
