import { useActionState, useEffect, useMemo } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { QUESTION_GRADED_EVENT } from "../../constants";
import type { UnitManifestEntry } from "../srs/questionManifest";
import { buildDailySet, loadSrsState, unitReadiness } from "../srs/srs";

interface StudyHomeProps {
	manifest: UnitManifestEntry[];
}

interface UnitStat {
	entry: UnitManifestEntry;
	readiness: number;
	due: number;
}

function refreshAction(version: number, _action: "refresh"): number {
	return version + 1;
}

function lowerReadiness(current: UnitStat | undefined, candidate: UnitStat): UnitStat {
	return !current || candidate.readiness < current.readiness ? candidate : current;
}

function pickTarget(stats: UnitStat[]): UnitStat | undefined {
	const dueTarget = stats.filter((u) => u.due > 0).reduce(lowerReadiness, undefined);
	const incompleteTarget = stats
		.filter((u) => u.entry.questionIds.length > 0 && u.readiness < 100)
		.reduce(lowerReadiness, undefined);
	return dueTarget ?? incompleteTarget ?? stats[0];
}

export default function StudyHome({ manifest }: StudyHomeProps): JSX.Element {
	const [version, refresh] = useActionState(refreshAction, 0);

	const view = useMemo(() => {
		const state = loadSrsState();
		const now = Date.now();
		const stats: UnitStat[] = manifest.map((entry) => ({
			entry,
			readiness: unitReadiness(state, entry.questionIds),
			due: buildDailySet(state, entry.questionIds, now).questionIds.length,
		}));
		const uniqueIds = [...new Set(manifest.flatMap((u) => u.questionIds))];
		const overall = unitReadiness(state, uniqueIds);
		const target = pickTarget(stats);
		return { stats, overall, target };
	}, [manifest, version]);

	useEffect(() => {
		const onGraded = (): void => refresh("refresh");
		document.addEventListener(QUESTION_GRADED_EVENT, onGraded);
		return (): void => document.removeEventListener(QUESTION_GRADED_EVENT, onGraded);
	}, []);

	const fallbackCta = manifest[0] ? `/today/${manifest[0].id}` : "/";
	const target = view.target;
	const hasDueToday = Boolean(target?.due && target.due > 0);
	const ctaSubText = ((): string => {
		if (hasDueToday && target) {
			return `${target.entry.name}に今日のぶんが ${target.due}問あります`;
		}
		if (target) {
			return `${target.entry.name}から始めましょう`;
		}
		return "まずは1問だけでもOK";
	})();

	return (
		<div data-study-home>
			<section class="py-2">
				<p class="home-eyebrow">基本情報技術の演習</p>
				<h1 class="home-title">勉強が嫌いな日でも、まず今日のぶんだけ。</h1>
				<p class="home-lede">
					何から手をつけるか迷わなくて大丈夫。アプリが「今日やる分」を少しずつ出します。間違えた問題は、忘れた頃にまた戻ってきます。
				</p>
			</section>

			<section class="home-hero-card">
				<div class="home-meter">
					<div class="home-meter-head">
						<span class="home-meter-label">いまの仕上がり</span>
						<span class="home-meter-value">{view.overall}%</span>
					</div>
					<div class="home-meter-track">
						<div class="home-meter-fill" style={`width:${view.overall}%`} />
					</div>
					<p class="home-meter-note">
						今日やる分: <strong>{target?.due ?? 0}</strong> 問
					</p>
				</div>
				<a href={target ? `/today/${target.entry.id}` : fallbackCta} class="home-cta">
					<span class="home-cta-label">
						{hasDueToday && target ? `今日の道を始める（${target.entry.name}）` : "復習を始める"}
					</span>
					<span class="home-cta-sub">{ctaSubText}</span>
				</a>
			</section>

			<section class="mt-8">
				<div class="home-section-head">
					<h2 class="home-section-title">単元ごとの仕上がり</h2>
					<a href="/slide-only" class="home-textlink">
						講義資料だけ見る
					</a>
				</div>

				<div class="home-unit-list">
					{view.stats.map((stat, index) => (
						<div class="home-unit-row">
							<a href={`/today/${stat.entry.id}`} class="home-unit-link">
								<span class="home-unit-num">{index + 1}</span>
								<div class="home-unit-main">
									<div class="home-unit-titlerow">
										<span class="home-unit-name">{stat.entry.name}</span>
									</div>
									<p class="home-unit-desc">{stat.entry.description}</p>
									<div class="home-unit-meterrow">
										<div class="home-unit-track">
											<div class="home-unit-fill" style={`width:${stat.readiness}%`} />
										</div>
										<span class="home-unit-value">{stat.readiness}%</span>
									</div>
								</div>
							</a>
							<a href={`/${stat.entry.id}/${stat.entry.primaryYear}`} class="home-unit-practice">
								この単元の年度ごとに解く →
							</a>
						</div>
					))}
				</div>

				<p class="home-foot-note">
					全単元×全年度をまとめて見るときは、ヘッダーの「演習一覧」から選べます。
				</p>
			</section>
		</div>
	);
}
