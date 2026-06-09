import { useActionState, useEffect, useMemo } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { QuestionCard } from "../../components/QuestionCard";
import { QUESTION_GRADED_EVENT } from "../../constants";
import type { Question } from "../../types";
import { buildDailySet, loadSrsState, type QuestionGradedDetail, unitReadiness } from "../srs/srs";

interface DailySessionProps {
	unitId: string;
	unitName: string;
	unitNumber: number;
	questions: Question[];
}

interface DailySessionState {
	index: number;
	graded: Record<string, boolean>;
	finished: boolean;
}

type DailySessionAction =
	| { type: "graded"; questionId: string; isCorrect: boolean }
	| { type: "advance"; isLast: boolean }
	| { type: "finish" };

const INITIAL_STATE: DailySessionState = {
	index: 0,
	graded: {},
	finished: false,
};

function reducer(state: DailySessionState, action: DailySessionAction): DailySessionState {
	switch (action.type) {
		case "graded":
			return {
				...state,
				graded: { ...state.graded, [action.questionId]: action.isCorrect },
			};
		case "advance":
			return action.isLast ? { ...state, finished: true } : { ...state, index: state.index + 1 };
		case "finish":
			return { ...state, finished: true };
		default:
			return state;
	}
}

export default function DailySession(props: DailySessionProps): JSX.Element {
	const { unitName, unitNumber, questions } = props;
	const [state, dispatch] = useActionState(reducer, INITIAL_STATE);

	const questionIds = useMemo(() => questions.map((question) => question.id), [questions]);
	const queue = useMemo(
		() => buildDailySet(loadSrsState(), questionIds, Date.now()).questionIds,
		[questionIds],
	);
	const queueSet = useMemo(() => new Set(queue), [queue]);
	const currentId = queue[state.index];
	const isLast = state.index >= queue.length - 1;
	const gradedCount = Object.keys(state.graded).length;
	const correctCount = Object.values(state.graded).filter(Boolean).length;
	const readiness = state.finished ? unitReadiness(loadSrsState(), questionIds) : 0;

	useEffect(() => {
		const onGraded = (event: Event): void => {
			const detail = (event as CustomEvent<QuestionGradedDetail>).detail;
			if (!(detail?.questionId && queueSet.has(detail.questionId))) {
				return;
			}
			dispatch({
				type: "graded",
				questionId: detail.questionId,
				isCorrect: detail.isCorrect,
			});
		};
		document.addEventListener(QUESTION_GRADED_EVENT, onGraded);
		return (): void => document.removeEventListener(QUESTION_GRADED_EVENT, onGraded);
	}, [queueSet]);

	if (queue.length === 0) {
		return <EmptySession />;
	}

	if (state.finished) {
		return (
			<div class="session-summary">
				<p class="session-summary-title">今日のぶん、完了！</p>
				<p class="session-summary-stat">
					<span>{correctCount}</span> / <span>{gradedCount || queue.length > 0}</span> 問 正解
				</p>
				<p class="session-summary-readiness">
					{unitName}の理解度: <strong>{readiness}%</strong>
				</p>
				<a href="/" class="q-btn-primary session-empty-link">
					ホームに戻る
				</a>
			</div>
		);
	}

	return (
		<div data-daily-session data-unit-id={props.unitId} data-unit-name={unitName}>
			<header class="session-header">
				<div class="session-head-row">
					<span class="q-num">{unitNumber}</span>
					<div>
						<p class="q-eyebrow">今日の道</p>
						<h1 class="session-title">{unitName}</h1>
					</div>
				</div>
				<p class="session-sub">忘れた頃の復習と、新しい1問ずつ。今日のぶんだけでOK。</p>
				<div class="session-progress">
					<div class="session-bar-track">
						<div
							class="session-bar-fill"
							style={`width:${Math.round(((state.index + 1) / queue.length) * 100)}%`}
						/>
					</div>
					<span class="session-progress-label">
						{state.index + 1} / {queue.length}
					</span>
				</div>
			</header>

			<div class="session-cards">
				{questions
					.filter((question) => queueSet.has(question.id))
					.map((question) => (
						<QuestionCard question={question} hidden={question.id !== currentId} />
					))}
			</div>

			<div class="session-nav">
				<button
					type="button"
					class={`session-next ${state.graded[currentId] === undefined ? "" : "is-ready"}`}
					onClick={(): void => dispatch({ type: "advance", isLast })}
				>
					{isLast ? "今日のぶんを終える" : "次の問題へ"}
				</button>
			</div>
		</div>
	);
}

function EmptySession(): JSX.Element {
	return (
		<div class="session-empty">
			<p class="session-empty-title">今日のぶんは完了！</p>
			<p class="session-empty-sub">
				この単元で今日復習する問題はありません。また明日、忘れた頃に戻ってきましょう。
			</p>
			<a href="/" class="q-btn-primary session-empty-link">
				ホームに戻る
			</a>
		</div>
	);
}
