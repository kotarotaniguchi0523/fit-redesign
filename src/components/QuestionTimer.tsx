import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuestionTimeRecord } from "../hooks/useQuestionTimeRecord";
import { useTimer } from "../hooks/useTimer";
import type { TimerMode } from "../types/timer";

interface Props {
	questionId: string;
}

/** 秒数をMM:SS形式にフォーマット */
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** 目標時間のプリセット（秒） */
const TARGET_TIME_PRESETS = [
	{ label: "1分", value: 60 },
	{ label: "2分", value: 120 },
	{ label: "3分", value: 180 },
	{ label: "5分", value: 300 },
];

/** 時計アイコン */
function ClockIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
			/>
		</svg>
	);
}

/** 下矢印アイコン */
function ChevronDownIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={2}
			stroke="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
		</svg>
	);
}

export function QuestionTimer({ questionId }: Props) {
	const [mode, setMode] = useState<TimerMode>("stopwatch");
	const [isExpanded, setIsExpanded] = useState(false);

	const timer = useTimer(mode, 60);
	const record = useQuestionTimeRecord(questionId);

	// このセッションで既に保存したかを追跡（重複保存防止）
	const hasSavedRef = useRef(false);
	// 前回のisRunning値を追跡
	const prevIsRunningRef = useRef(false);

	// useEffectEvent: タイマー停止時の保存処理
	const saveAttempt = useEffectEvent(() => {
		const elapsed = timer.elapsedSeconds;
		const duration = mode === "stopwatch" ? elapsed : timer.targetTime - elapsed;

		if (duration > 0) {
			record.addAttempt(duration, mode, timer.isCompleted, timer.targetTime);
		}
	});

	// タイマー停止時に記録を自動保存
	useEffect(() => {
		const wasRunning = prevIsRunningRef.current;
		const isNowStopped = !timer.isRunning;

		if (wasRunning && isNowStopped && !hasSavedRef.current) {
			saveAttempt();
			hasSavedRef.current = true;
		}

		if (timer.isRunning && !wasRunning) {
			hasSavedRef.current = false;
		}

		prevIsRunningRef.current = timer.isRunning;
	}, [timer.isRunning]);

	const handleModeChange = (nextMode: TimerMode) => {
		if (nextMode === mode) return;
		timer.reset(nextMode);
		setMode(nextMode);
		hasSavedRef.current = false;
	};

	const handleTargetTimeChange = (value: number) => {
		timer.setTargetTime(value);
	};

	const handleClearRecords = () => {
		record.clearRecords();
	};

	// タイマー表示の背景色とスタイル
	const timerBgClass = timer.isCompleted
		? "bg-red-100 border-red-500 animate-pulse"
		: timer.isRunning
			? "bg-blue-100 border-blue-400"
			: "bg-slate-100 border-slate-200";

	const timerTextClass = timer.isCompleted
		? "text-red-700 font-bold"
		: timer.isRunning
			? "text-blue-700"
			: "text-slate-700";

	return (
		<div className="relative">
			{/* メインタイマーエリア */}
			<div className="flex items-center gap-2">
				{/* タイマー表示（背景付きカプセル） */}
				<div
					className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${timerBgClass}`}
				>
					<ClockIcon className={`w-4 h-4 ${timerTextClass}`} />
					<span className={`text-sm font-mono font-semibold tabular-nums ${timerTextClass}`}>
						{formatTime(timer.elapsedSeconds)}
					</span>
					{mode === "countdown" && !timer.isRunning && !timer.isCompleted && (
						<span className="text-xs text-slate-500">/ {formatTime(timer.targetTime)}</span>
					)}
				</div>

				{/* 操作ボタン */}
				<Button
					size="sm"
					color={timer.isRunning ? "danger" : "primary"}
					variant="solid"
					onPress={timer.isRunning ? timer.stop : timer.start}
				>
					{timer.isRunning ? "停止" : "開始"}
				</Button>

				{timer.isRunning && (
					<Button size="sm" color="warning" variant="solid" onPress={() => timer.reset()}>
						リセット
					</Button>
				)}

				{/* 設定トグルボタン */}
				<Button
					size="sm"
					variant="light"
					onPress={() => setIsExpanded(!isExpanded)}
					aria-expanded={isExpanded}
					endContent={
						<ChevronDownIcon
							className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
						/>
					}
				>
					設定
				</Button>
			</div>

			{/* 展開パネル */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden absolute right-0 top-full z-10 w-80"
					>
						<div className="mt-2 p-3 bg-white rounded-lg border border-slate-300 shadow-lg space-y-3">
							{/* モード切替 */}
							<div>
								<p className="text-xs font-semibold text-slate-600 mb-2">タイマーモード</p>
								<div className="flex gap-1">
									<Button
										size="sm"
										color={mode === "stopwatch" ? "primary" : "default"}
										variant={mode === "stopwatch" ? "solid" : "bordered"}
										onPress={() => handleModeChange("stopwatch")}
										className={mode === "stopwatch" ? "bg-blue-600 text-white" : ""}
									>
										ストップウォッチ
									</Button>
									<Button
										size="sm"
										color={mode === "countdown" ? "primary" : "default"}
										variant={mode === "countdown" ? "solid" : "bordered"}
										onPress={() => handleModeChange("countdown")}
										className={mode === "countdown" ? "bg-blue-600 text-white" : ""}
									>
										カウントダウン
									</Button>
								</div>
							</div>

							{/* 目標時間選択（カウントダウン時のみ） */}
							{mode === "countdown" && (
								<div>
									<p className="text-xs font-semibold text-slate-600 mb-2">目標時間</p>
									<div className="flex gap-1 flex-wrap">
										{TARGET_TIME_PRESETS.map((preset) => (
											<Button
												key={preset.value}
												size="sm"
												color={timer.targetTime === preset.value ? "success" : "default"}
												variant={timer.targetTime === preset.value ? "solid" : "bordered"}
												onPress={() => handleTargetTimeChange(preset.value)}
												className={timer.targetTime === preset.value ? "bg-green-600 text-white" : ""}
											>
												{preset.label}
											</Button>
										))}
									</div>
								</div>
							)}

							{/* 統計表示（カード型） */}
							<div>
								<p className="text-xs font-semibold text-slate-600 mb-2">統計</p>
								<div className="grid grid-cols-3 gap-1">
									<div className="bg-slate-50 rounded p-2 text-center">
										<div className="text-xs text-slate-500">前回</div>
										<div className="font-mono font-semibold text-slate-800 text-sm">
											{record.lastAttemptDuration !== null
												? formatTime(record.lastAttemptDuration)
												: "--:--"}
										</div>
									</div>
									<div className="bg-slate-50 rounded p-2 text-center">
										<div className="text-xs text-slate-500">平均</div>
										<div className="font-mono font-semibold text-slate-800 text-sm">
											{record.averageDuration !== null
												? formatTime(Math.round(record.averageDuration))
												: "--:--"}
										</div>
									</div>
									<div className="bg-slate-50 rounded p-2 text-center">
										<div className="text-xs text-slate-500">回数</div>
										<div className="font-mono font-semibold text-slate-800 text-sm">
											{record.totalAttempts}回
										</div>
									</div>
								</div>
							</div>

							{/* 履歴クリアボタン */}
							<Button
								size="sm"
								color="danger"
								variant="flat"
								onPress={handleClearRecords}
								isDisabled={record.totalAttempts === 0}
							>
								履歴をクリア
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
