import {
	Button,
	ButtonGroup,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Radio,
	RadioGroup,
} from "@heroui/react";
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

export function QuestionTimer({ questionId }: Props) {
	const [mode, setMode] = useState<TimerMode>("stopwatch");
	const [popoverOpen, setPopoverOpen] = useState(false);

	const timer = useTimer(mode, 60);
	const record = useQuestionTimeRecord(questionId);

	// このセッションで既に保存したかを追跡（重複保存防止）
	const hasSavedRef = useRef(false);
	// 前回のisRunning値を追跡
	const prevIsRunningRef = useRef(false);

	// useEffectEvent: タイマー停止時の保存処理
	// - timer.isRunningの変更にのみ反応したい
	// - しかし mode, record, timer.elapsedSeconds 等の最新値を読みたい
	// React公式: "Effect Events provide a way to separate reactive and non-reactive logic"
	const saveAttempt = useEffectEvent(() => {
		const elapsed = timer.elapsedSeconds;
		// ストップウォッチ: そのまま経過時間
		// カウントダウン: targetTime - 残り時間 = 経過時間
		const duration = mode === "stopwatch" ? elapsed : timer.targetTime - elapsed;

		// 1秒以上経過した場合のみ保存
		if (duration > 0) {
			record.addAttempt(duration, mode, timer.isCompleted, timer.targetTime);
		}
	});

	// タイマー停止時に記録を自動保存（running -> stopped の遷移時のみ）
	// 依存配列は timer.isRunning のみ（useEffectEventで最新値を読む）
	useEffect(() => {
		const wasRunning = prevIsRunningRef.current;
		const isNowStopped = !timer.isRunning;

		// running から stopped への遷移を検知
		if (wasRunning && isNowStopped && !hasSavedRef.current) {
			saveAttempt();
			hasSavedRef.current = true;
		}

		// タイマー開始時にフラグをリセット
		if (timer.isRunning && !wasRunning) {
			hasSavedRef.current = false;
		}

		prevIsRunningRef.current = timer.isRunning;
	}, [timer.isRunning]);

	const handleModeChange = (value: string) => {
		setMode(value as TimerMode);
		// timer.reset()は不要: useTimer内のuseEffectがmode変更時に自動リセットする
		hasSavedRef.current = false;
	};

	const handleTargetTimeChange = (value: number) => {
		timer.setTargetTime(value);
	};

	const handleClearRecords = () => {
		record.clearRecords();
	};

	return (
		<div className="flex items-center gap-2">
			{/* タイマー表示 */}
			<div className="flex items-center gap-1.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={1.5}
					stroke="currentColor"
					className="w-5 h-5 text-gray-600"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
					/>
				</svg>
				<span
					className={`text-sm font-mono font-medium ${
						timer.isCompleted ? "text-red-600" : "text-gray-700"
					}`}
				>
					{formatTime(timer.elapsedSeconds)}
				</span>
			</div>

			{/* 開始/停止ボタン */}
			<Button
				size="sm"
				color={timer.isRunning ? "danger" : "primary"}
				variant="flat"
				onPress={timer.isRunning ? timer.stop : timer.start}
			>
				{timer.isRunning ? "停止" : "開始"}
			</Button>

			{/* リセットボタン（実行中のみ） */}
			{timer.isRunning && (
				<Button size="sm" color="default" variant="flat" onPress={timer.reset}>
					リセット
				</Button>
			)}

			{/* 設定Popover */}
			<Popover placement="bottom-end" isOpen={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger>
					<Button size="sm" variant="light" isIconOnly aria-label="設定">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="w-5 h-5"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
							/>
						</svg>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-4">
					<div className="space-y-4">
						{/* モード切替 */}
						<div>
							<p className="text-xs font-semibold text-gray-600 mb-2">タイマーモード</p>
							<RadioGroup value={mode} onValueChange={handleModeChange} size="sm">
								<Radio value="stopwatch">ストップウォッチ</Radio>
								<Radio value="countdown">カウントダウン</Radio>
							</RadioGroup>
						</div>

						{/* 目標時間選択（カウントダウン時のみ） */}
						{mode === "countdown" && (
							<div>
								<p className="text-xs font-semibold text-gray-600 mb-2">目標時間</p>
								<ButtonGroup size="sm" variant="flat" fullWidth>
									{TARGET_TIME_PRESETS.map((preset) => (
										<Button
											key={preset.value}
											color={timer.targetTime === preset.value ? "primary" : "default"}
											onPress={() => handleTargetTimeChange(preset.value)}
										>
											{preset.label}
										</Button>
									))}
								</ButtonGroup>
							</div>
						)}

						{/* 統計表示 */}
						<div className="border-t pt-3">
							<p className="text-xs font-semibold text-gray-600 mb-2">統計</p>
							<div className="space-y-1 text-xs text-gray-700">
								<div className="flex justify-between">
									<span>前回:</span>
									<span className="font-mono">
										{record.lastAttemptDuration !== null
											? formatTime(record.lastAttemptDuration)
											: "--:--"}
									</span>
								</div>
								<div className="flex justify-between">
									<span>平均:</span>
									<span className="font-mono">
										{record.averageDuration !== null
											? formatTime(Math.round(record.averageDuration))
											: "--:--"}
									</span>
								</div>
								<div className="flex justify-between">
									<span>試行回数:</span>
									<span className="font-mono">{record.totalAttempts}回</span>
								</div>
							</div>
						</div>

						{/* 履歴クリアボタン */}
						<Button
							size="sm"
							color="danger"
							variant="flat"
							fullWidth
							onPress={handleClearRecords}
							isDisabled={record.totalAttempts === 0}
						>
							履歴をクリア
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
