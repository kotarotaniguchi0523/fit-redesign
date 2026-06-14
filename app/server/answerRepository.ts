import { eq, sql } from "drizzle-orm";
import { type QuestionId, QuestionIdSchema, type UserId, UserIdSchema } from "../types";
import type { AnswerRecord, AnswerStatus } from "../types/answer";
import { answers, type Db, questions } from "./schema";
import { upsertUser } from "./userRepository";

/**
 * leftJoin で取得する行のシェイプ（json_id は questions から復元するため string | null）。
 * question_id は NOT NULL FK のため実データでは null にならないが、型は join が付ける null を持つ。
 */
interface AnswerJoinRow {
	id: number;
	userId: string;
	jsonId: string | null;
	selectedLabel: string;
	isCorrect: number;
	duration: number | null;
	setId: string | null;
	createdAt: number;
}

function rowToRecord(row: AnswerJoinRow): AnswerRecord | null {
	// 未登録 question（jsonId が null）は記録対象外。read 側でも除外する。
	if (row.jsonId == null) {
		return null;
	}
	return {
		id: row.id,
		userId: UserIdSchema.parse(row.userId),
		questionId: QuestionIdSchema.parse(row.jsonId),
		selectedLabel: row.selectedLabel,
		isCorrect: row.isCorrect === 1,
		duration: row.duration,
		setId: row.setId,
		createdAt: row.createdAt,
	};
}

export interface InsertAnswerInput {
	userId: UserId;
	questionId: QuestionId;
	selectedLabel: string;
	isCorrect: boolean;
	duration: number | null;
	setId: string | null;
}

/**
 * 採点済み解答を記録する。
 *
 * クライアントから来る json_id（例 exam1-2013-q1）を questions.id に解決してから INSERT する。
 * 未登録の json_id は解決できず記録しない（門番。null を返す）。created_at はサーバー時刻
 * （Date.now()）を付与する。記録できた場合は answers.id、未登録なら null を返す。
 */
export async function insertAnswer(db: Db, input: InsertAnswerInput): Promise<number | null> {
	const { userId, questionId, selectedLabel, isCorrect, duration, setId } = input;
	// FK 整合性のため answers より先に users 行を保証する。
	await upsertUser(db, userId);

	// json_id → questions.id を解決する門番（未登録なら 0 行＝記録しない）。
	const matched = await db
		.select({ id: questions.id })
		.from(questions)
		.where(eq(questions.jsonId, questionId))
		.limit(1);
	const questionPk = matched[0]?.id;
	if (questionPk === undefined) {
		return null;
	}

	// 列名指定の values() insert（insert-from-select の haveSameKeys 検査・物理列順依存を避ける）。
	const inserted = await db
		.insert(answers)
		.values({
			userId,
			questionId: questionPk,
			selectedLabel,
			isCorrect: isCorrect ? 1 : 0,
			duration,
			setId,
			createdAt: Date.now(),
		})
		.returning({ id: answers.id });

	return inserted[0]?.id ?? null;
}

/**
 * ユーザーの question 毎の最新回答（MAX(id)）を json_id 付きで返す。
 * AnswerStatusMap（json_id → { label, isCorrect }）として status / cache が読む。
 */
export async function getLatestAnswers(
	db: Db,
	userId: UserId,
): Promise<Record<string, AnswerStatus>> {
	const rows = await db
		.select({
			jsonId: questions.jsonId,
			selectedLabel: answers.selectedLabel,
			isCorrect: answers.isCorrect,
		})
		.from(answers)
		.leftJoin(questions, eq(answers.questionId, questions.id))
		.where(
			sql`${answers.userId} = ${userId} and ${answers.id} = (
				select max(a2.id) from ${answers} a2
				where a2.user_id = ${answers.userId} and a2.question_id = ${answers.questionId}
			)`,
		)
		.orderBy(questions.jsonId);

	return Object.fromEntries(
		rows.flatMap((row) =>
			row.jsonId == null
				? []
				: [[row.jsonId, { label: row.selectedLabel, isCorrect: row.isCorrect === 1 }] as const],
		),
	);
}

/**
 * D1 から取得した join 行を questionId ごとの AnswerRecord[] にグルーピングする純粋関数。
 * クエリ結果と分離して getUserAnswerHistory とベンチ（dashboardAggregator.bench.ts）の
 * 双方が同一実装を呼ぶため export している。
 *
 * Map はこの関数内の accumulator としてだけ使い、返す値は新しい Record に変換する。
 * first-seen のキー挿入順を保持し、Record キー順・同値の出力になる。
 */
export function groupRowsByQuestion(rows: AnswerJoinRow[]): Record<string, AnswerRecord[]> {
	// accumulator(private Map)の配列を in-place で push する。[...prev, record] で作り直すと
	// 問題あたり O(k²)（全体 O(m²)）になるため避ける。Map 挿入順 = first-seen キー順は維持される。
	const groupedRows = rows.reduce((history, row) => {
		const record = rowToRecord(row);
		// 未登録 question（jsonId null）はスキップ。
		if (record == null) {
			return history;
		}
		const bucket = history.get(record.questionId);
		if (bucket) {
			bucket.push(record);
		} else {
			history.set(record.questionId, [record]);
		}
		return history;
	}, new Map<string, AnswerRecord[]>());

	return Object.fromEntries(groupedRows);
}

/**
 * ユーザーの全 answer を json_id 付き・created_at 昇順で取得し、questionId 毎にグルーピングする。
 * dashboard が aggregateStats で集計する分析ソース。
 * created_at は Date.now()(ms) 採番のため同一 ms が衝突しうる。SRS リプレイ（replay.ts）は
 * この並び順を真の時系列として畳むので、id（autoincrement=挿入順）を副キーにして同値時も確定させる。
 */
export async function getUserAnswerHistory(
	db: Db,
	userId: UserId,
): Promise<Record<string, AnswerRecord[]>> {
	const rows = await db
		.select({
			id: answers.id,
			userId: answers.userId,
			jsonId: questions.jsonId,
			selectedLabel: answers.selectedLabel,
			isCorrect: answers.isCorrect,
			duration: answers.duration,
			setId: answers.setId,
			createdAt: answers.createdAt,
		})
		.from(answers)
		.leftJoin(questions, eq(answers.questionId, questions.id))
		.where(eq(answers.userId, userId))
		.orderBy(answers.createdAt, answers.id);

	return groupRowsByQuestion(rows);
}

export type { AnswerJoinRow };
