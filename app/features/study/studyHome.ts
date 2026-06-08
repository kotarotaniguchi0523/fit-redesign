import { QUESTION_GRADED_EVENT } from "../../constants";
import { mountAll } from "../../utils/mountAll";
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

function render(el: HTMLElement): void {
	const manifest = readEmbeddedManifest(el);
	if (manifest.length === 0) return;

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
	renderOverall(el, overall, target);
	renderUnits(el, stats);
	renderCta(el, target);
}

/** 今日取り組む単元: 今日やる分がある中で習熟度が最も低いもの。なければ未完了で最も低いもの */
function pickTarget(stats: UnitStat[]): UnitStat | undefined {
	const withDue = stats.filter((u) => u.due > 0).sort((a, b) => a.readiness - b.readiness);
	const incomplete = stats
		.filter((u) => u.entry.questionIds.length > 0 && u.readiness < 100)
		.sort((a, b) => a.readiness - b.readiness);
	return withDue[0] ?? incomplete[0] ?? stats[0];
}

function renderOverall(el: HTMLElement, overall: number, target: UnitStat | undefined): void {
	const valueEl = el.querySelector<HTMLElement>("[data-overall-value]");
	const barEl = el.querySelector<HTMLElement>("[data-overall-bar]");
	const dueEl = el.querySelector<HTMLElement>("[data-overall-due]");
	if (valueEl) valueEl.textContent = `${overall}%`;
	if (barEl) barEl.style.width = `${overall}%`;
	// 「今日やる分」は今取り組む単元の分だけ（小さく区切る）
	if (dueEl) dueEl.textContent = String(target?.due ?? 0);
}

function renderUnits(el: HTMLElement, stats: UnitStat[]): void {
	for (const stat of stats) {
		const row = el.querySelector<HTMLElement>(`[data-unit-row="${stat.entry.id}"]`);
		if (!row) continue;

		const bar = row.querySelector<HTMLElement>("[data-unit-bar]");
		const value = row.querySelector<HTMLElement>("[data-unit-value]");
		if (bar) bar.style.width = `${stat.readiness}%`;
		if (value) value.textContent = `${stat.readiness}%`;
	}
}

function renderCta(el: HTMLElement, target: UnitStat | undefined): void {
	const cta = el.querySelector<HTMLAnchorElement>("[data-today-cta]");
	const label = el.querySelector<HTMLElement>("[data-cta-label]");
	const sub = el.querySelector<HTMLElement>("[data-cta-sub]");
	if (!target) return;

	if (cta) cta.href = `/today/${target.entry.id}`;
	if (label) {
		label.textContent =
			target.due > 0 ? `今日の道を始める（${target.entry.name}）` : "復習を始める";
	}
	if (sub) {
		sub.textContent =
			target.due > 0
				? `${target.entry.name}に今日のぶんが ${target.due}問あります`
				: `${target.entry.name}から始めましょう`;
	}
}

/** `[data-study-home]` 要素を初期描画し、採点イベントで再描画する。 */
export function initStudyHome(): void {
	mountAll("[data-study-home]", (el) => {
		const rerender = () => render(el);
		rerender();
		// 他タブ等で採点された場合に備えて更新（同一ページでは通常発火しない）。
		// 解除しない（mountAll のライフサイクル契約: ページ寿命まで生存）。
		document.addEventListener(QUESTION_GRADED_EVENT, rerender);
	});
}
