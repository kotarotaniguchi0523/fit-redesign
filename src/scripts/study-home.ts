import { QUESTION_GRADED_EVENT } from "../constants";
import { readEmbeddedManifest, type UnitManifestEntry } from "./progressClient";
import { buildDailySet, loadSrsState, unitReadiness } from "./srs";

interface UnitStat {
	entry: UnitManifestEntry;
	readiness: number;
	due: number;
}

/**
 * ホームのハブ。試験本番メーター・今日の道・単元別習熟度を、
 * 埋め込みマニフェスト＋localStorageのSRS状態から描画する。
 */
class StudyHome extends HTMLElement {
	connectedCallback() {
		this.render();
		// 他タブ等で採点された場合に備えて更新（同一ページでは通常発火しない）
		document.addEventListener(QUESTION_GRADED_EVENT, this.handleGraded);
	}

	disconnectedCallback() {
		document.removeEventListener(QUESTION_GRADED_EVENT, this.handleGraded);
	}

	private handleGraded = () => this.render();

	private render() {
		const manifest = readEmbeddedManifest(this);
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

		const target = this.pickTarget(stats);
		this.renderOverall(overall, target);
		this.renderUnits(stats);
		this.renderCta(target);
	}

	/** 今日取り組む単元: 今日やる分がある中で習熟度が最も低いもの。なければ未完了で最も低いもの */
	private pickTarget(stats: UnitStat[]): UnitStat | undefined {
		const withDue = stats.filter((u) => u.due > 0).sort((a, b) => a.readiness - b.readiness);
		const incomplete = stats
			.filter((u) => u.entry.questionIds.length > 0 && u.readiness < 100)
			.sort((a, b) => a.readiness - b.readiness);
		return withDue[0] ?? incomplete[0] ?? stats[0];
	}

	private renderOverall(overall: number, target: UnitStat | undefined) {
		const valueEl = this.querySelector<HTMLElement>("[data-overall-value]");
		const barEl = this.querySelector<HTMLElement>("[data-overall-bar]");
		const dueEl = this.querySelector<HTMLElement>("[data-overall-due]");
		if (valueEl) valueEl.textContent = `${overall}%`;
		if (barEl) barEl.style.width = `${overall}%`;
		// 「今日やる分」は今取り組む単元の分だけ（小さく区切る）
		if (dueEl) dueEl.textContent = String(target?.due ?? 0);
	}

	private renderUnits(stats: UnitStat[]) {
		for (const stat of stats) {
			const row = this.querySelector<HTMLElement>(`[data-unit-row="${stat.entry.id}"]`);
			if (!row) continue;

			const bar = row.querySelector<HTMLElement>("[data-unit-bar]");
			const value = row.querySelector<HTMLElement>("[data-unit-value]");
			const due = row.querySelector<HTMLElement>("[data-unit-due]");
			if (bar) bar.style.width = `${stat.readiness}%`;
			if (value) value.textContent = `${stat.readiness}%`;
			if (due) {
				if (stat.due > 0) {
					due.textContent = `今日 ${stat.due}問`;
					due.hidden = false;
				} else {
					due.hidden = true;
				}
			}
		}
	}

	private renderCta(target: UnitStat | undefined) {
		const cta = this.querySelector<HTMLAnchorElement>("[data-today-cta]");
		const label = this.querySelector<HTMLElement>("[data-cta-label]");
		const sub = this.querySelector<HTMLElement>("[data-cta-sub]");
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
}

customElements.define("study-home", StudyHome);
