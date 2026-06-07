import {
	ALERT_SOUND,
	DEFAULT_TARGET_TIME,
	TARGET_TIME_PRESETS,
	TIMER_INTERVAL_MS,
} from "../../constants";
import type { QuestionId } from "../../types/index";
import { mountAll } from "../../utils/mountAll";
import { formatTime } from "./timeFormat";
import { clearQuestionRecords, loadTimerData, saveAttempt } from "./timerStorage";
import type { AttemptRecord, TimerMode } from "./types";

// SVG icons as raw strings
const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`;
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`;

/**
 * 1 問題のタイマー（ストップウォッチ / カウントダウン）。旧 question-timer Web Component の
 * 脱 customElements 版。連続ティック・設定ポップオーバー・音・localStorage 記録・サーバー同期を
 * 司るステートフルコントローラのため、状態はクロージャ内のローカル変数に保持する（関数型）。
 */
export function setupQuestionTimer(el: HTMLElement): void {
	const questionId = el.dataset.questionId || el.getAttribute("question-id") || "";

	// Timer state
	let mode: TimerMode = "stopwatch";
	let elapsedSeconds = 0;
	let isRunning = false;
	let isCompleted = false;
	let targetTime = DEFAULT_TARGET_TIME;

	// Records state
	let attempts: AttemptRecord[] = [];

	// Refs
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let audioContext: AudioContext | null = null;
	let alertTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasSaved = false;

	// DOM elements
	let startStopBtn: HTMLButtonElement;
	let resetBtn: HTMLButtonElement;
	let timerDisplay: HTMLDivElement;
	let clockIcon: HTMLSpanElement;
	let timeText: HTMLSpanElement;
	let settingsBtn: HTMLButtonElement;
	let gearIcon: HTMLSpanElement;
	let popoverEl: HTMLDivElement;
	let popoverBackdrop: HTMLDivElement;
	let modeStopwatchBtn: HTMLButtonElement;
	let modeCountdownBtn: HTMLButtonElement;
	let targetTimeContainer: HTMLDivElement;
	let presetButtons: HTMLButtonElement[] = [];
	let statLast: HTMLDivElement;
	let statAvg: HTMLDivElement;
	let statCount: HTMLDivElement;
	let clearBtn: HTMLButtonElement;
	let settingsOpen = false;

	function destroy() {
		stopInterval();
		if (alertTimeout) {
			clearTimeout(alertTimeout);
			alertTimeout = null;
		}
		if (audioContext) {
			audioContext.close().catch(() => {});
			audioContext = null;
		}
		closePopover();
		popoverBackdrop?.remove();
		popoverEl?.remove();
	}

	function loadRecords() {
		const loadResult = loadTimerData();
		if (!loadResult.ok) return;
		const questionRecord = loadResult.value.records[questionId as QuestionId];
		if (questionRecord) {
			attempts = questionRecord.attempts;
		}

		// Background: load from server and merge
		loadFromServerAndMerge();
	}

	function loadFromServerAndMerge() {
		import("./timerSync")
			.then(async ({ loadFromServer, mergeData }) => {
				const { getUserId } = await import("../../utils/userId");
				const userId = getUserId();
				const remoteData = await loadFromServer(userId);
				if (!remoteData) return;

				const localResult = loadTimerData();
				if (!localResult.ok) return;

				const merged = mergeData(localResult.value, remoteData);

				// Save merged data back to localStorage
				const { saveTimerData } = await import("./timerStorage");
				saveTimerData(merged);

				// Update this timer's attempts
				const record = merged.records[questionId as QuestionId];
				if (record) {
					attempts = record.attempts;
					if (settingsOpen) {
						updateStats();
					}
				}
			})
			.catch(() => {});
	}

	function buildDOM() {
		el.innerHTML = "";
		const wrapper = document.createElement("div");
		wrapper.className = "relative";

		// Main timer area
		const mainRow = document.createElement("div");
		mainRow.className = "flex flex-wrap items-center gap-2";

		// Start/Stop button
		startStopBtn = document.createElement("button");
		startStopBtn.className =
			"min-w-max whitespace-nowrap rounded-xl bg-green-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-green-700";
		startStopBtn.textContent = "開始";
		startStopBtn.addEventListener("click", () => handleStartStop());

		// Reset button (hidden by default)
		resetBtn = document.createElement("button");
		resetBtn.className =
			"hidden rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-amber-600";
		resetBtn.textContent = "リセット";
		resetBtn.addEventListener("click", () => handleReset());

		// Timer display capsule
		timerDisplay = document.createElement("div");
		timerDisplay.className =
			"flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors bg-slate-100 border-slate-200";

		clockIcon = document.createElement("span");
		clockIcon.className = "w-4 h-4 shrink-0 text-slate-700 inline-flex";
		clockIcon.innerHTML = CLOCK_SVG;

		timeText = document.createElement("span");
		timeText.className =
			"text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-slate-700";

		timerDisplay.appendChild(clockIcon);
		timerDisplay.appendChild(timeText);

		// Settings button
		settingsBtn = document.createElement("button");
		settingsBtn.className = "rounded-lg p-1.5 transition-colors hover:bg-white";
		settingsBtn.setAttribute("aria-label", "タイマー設定");
		gearIcon = document.createElement("span");
		gearIcon.className = "w-5 h-5 text-slate-500 inline-flex transition-transform duration-200";
		gearIcon.innerHTML = GEAR_SVG;
		settingsBtn.appendChild(gearIcon);
		settingsBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleSettingsPopover();
		});

		mainRow.appendChild(startStopBtn);
		mainRow.appendChild(resetBtn);
		mainRow.appendChild(timerDisplay);
		mainRow.appendChild(settingsBtn);

		// Popover backdrop (invisible click catcher)
		popoverBackdrop = document.createElement("div");
		popoverBackdrop.className = "fixed inset-0 z-40 hidden";
		popoverBackdrop.addEventListener("click", () => closePopover());

		// Popover (fixed positioning to escape stacking context created by parent's scale-90)
		popoverEl = document.createElement("div");
		popoverEl.className =
			"fixed w-80 p-0 border border-slate-200 shadow-lg rounded-xl bg-white z-50 hidden";

		const popoverInner = document.createElement("div");
		popoverInner.className = "p-3 space-y-3";

		// Mode toggle section
		const modeSection = document.createElement("div");
		const modeLabel = document.createElement("p");
		modeLabel.className = "text-xs font-semibold text-slate-600 mb-2";
		modeLabel.textContent = "タイマーモード";
		const modeRow = document.createElement("div");
		modeRow.className = "flex gap-1";

		modeStopwatchBtn = document.createElement("button");
		modeStopwatchBtn.textContent = "ストップウォッチ";
		modeStopwatchBtn.addEventListener("click", () => handleModeChange("stopwatch"));

		modeCountdownBtn = document.createElement("button");
		modeCountdownBtn.textContent = "カウントダウン";
		modeCountdownBtn.addEventListener("click", () => handleModeChange("countdown"));

		modeRow.appendChild(modeStopwatchBtn);
		modeRow.appendChild(modeCountdownBtn);
		modeSection.appendChild(modeLabel);
		modeSection.appendChild(modeRow);

		// Target time section (countdown only)
		targetTimeContainer = document.createElement("div");
		targetTimeContainer.className = "hidden";
		const targetLabel = document.createElement("p");
		targetLabel.className = "text-xs font-semibold text-slate-600 mb-2";
		targetLabel.textContent = "目標時間";
		const presetRow = document.createElement("div");
		presetRow.className = "flex gap-1 flex-wrap";

		presetButtons = TARGET_TIME_PRESETS.map((preset) => {
			const btn = document.createElement("button");
			btn.textContent = preset.label;
			btn.dataset.value = String(preset.value);
			btn.addEventListener("click", () => handleTargetTimeChange(preset.value));
			presetRow.appendChild(btn);
			return btn;
		});

		targetTimeContainer.appendChild(targetLabel);
		targetTimeContainer.appendChild(presetRow);

		// Stats section
		const statsSection = document.createElement("div");
		const statsLabel = document.createElement("p");
		statsLabel.className = "text-xs font-semibold text-slate-600 mb-2";
		statsLabel.textContent = "統計";
		const statsGrid = document.createElement("div");
		statsGrid.className = "grid grid-cols-3 gap-1";

		statLast = createStatCard("前回", "--:--");
		statAvg = createStatCard("平均", "--:--");
		statCount = createStatCard("回数", "0回");

		statsGrid.appendChild(statLast);
		statsGrid.appendChild(statAvg);
		statsGrid.appendChild(statCount);
		statsSection.appendChild(statsLabel);
		statsSection.appendChild(statsGrid);

		// Clear button
		clearBtn = document.createElement("button");
		clearBtn.className =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
		clearBtn.textContent = "履歴をクリア";
		clearBtn.addEventListener("click", () => handleClearRecords());

		popoverInner.appendChild(modeSection);
		popoverInner.appendChild(targetTimeContainer);
		popoverInner.appendChild(statsSection);
		popoverInner.appendChild(clearBtn);
		popoverEl.appendChild(popoverInner);

		wrapper.appendChild(mainRow);
		el.appendChild(wrapper);
		// Append popover and backdrop to body to escape stacking context
		document.body.appendChild(popoverBackdrop);
		document.body.appendChild(popoverEl);
	}

	function createStatCard(label: string, value: string): HTMLDivElement {
		const card = document.createElement("div");
		card.className = "bg-slate-50 rounded p-2 text-center";
		const labelEl = document.createElement("div");
		labelEl.className = "text-xs text-slate-500";
		labelEl.textContent = label;
		const valueEl = document.createElement("div");
		valueEl.className = "font-mono font-semibold text-slate-800 text-sm";
		valueEl.textContent = value;
		card.appendChild(labelEl);
		card.appendChild(valueEl);
		return card;
	}

	function handleStartStop() {
		if (isRunning) {
			stop();
		} else {
			start();
		}
	}

	function start() {
		isRunning = true;
		isCompleted = false;
		hasSaved = false;
		startInterval();
		updateDisplay();
	}

	function stop() {
		isRunning = false;
		stopInterval();
		saveAttemptIfNeeded();
		updateDisplay();
	}

	function handleReset() {
		// resetBtn は isRunning 中のみ表示され、その時 hasSaved は必ず false なので reset() に委譲できる
		reset();
	}

	function reset(nextMode?: TimerMode) {
		const effectiveMode = nextMode ?? mode;
		stopInterval();
		isRunning = false;
		isCompleted = false;
		hasSaved = false;
		elapsedSeconds = effectiveMode === "countdown" ? targetTime : 0;
		updateDisplay();
	}

	function startInterval() {
		stopInterval();
		intervalId = setInterval(() => {
			if (mode === "stopwatch") {
				elapsedSeconds += 1;
			} else {
				const next = elapsedSeconds - 1;
				elapsedSeconds = next <= 0 ? 0 : next;
			}
			updateDisplay();

			// Countdown completion check
			if (mode === "countdown" && isRunning && elapsedSeconds === 0) {
				isRunning = false;
				isCompleted = true;
				stopInterval();
				playAlertSound();
				saveAttemptIfNeeded();
				updateDisplay();
			}
		}, TIMER_INTERVAL_MS);
	}

	function stopInterval() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function saveAttemptIfNeeded() {
		if (hasSaved) return;

		const elapsed = elapsedSeconds;
		const duration = mode === "stopwatch" ? elapsed : targetTime - elapsed;

		if (duration > 0) {
			const attempt: AttemptRecord = {
				timestamp: Date.now(),
				duration,
				mode: mode,
				completed: isCompleted,
				targetTime: targetTime,
			};
			saveAttempt(questionId as QuestionId, attempt);
			attempts = [...attempts, attempt];
			hasSaved = true;
			updateStats();
		}
	}

	function playAlertSound() {
		try {
			if (!audioContext) {
				audioContext = new AudioContext();
			}
			const ctx = audioContext;

			if (ctx.state === "suspended") {
				ctx.resume().catch(() => {});
			}

			const osc1 = ctx.createOscillator();
			const gain1 = ctx.createGain();
			osc1.connect(gain1);
			gain1.connect(ctx.destination);
			osc1.frequency.value = ALERT_SOUND.FIRST_FREQUENCY;
			osc1.type = "sine";
			gain1.gain.value = ALERT_SOUND.GAIN;
			osc1.start();
			osc1.stop(ctx.currentTime + ALERT_SOUND.DURATION);

			alertTimeout = setTimeout(() => {
				const osc2 = ctx.createOscillator();
				const gain2 = ctx.createGain();
				osc2.connect(gain2);
				gain2.connect(ctx.destination);
				osc2.frequency.value = ALERT_SOUND.SECOND_FREQUENCY;
				osc2.type = "sine";
				gain2.gain.value = ALERT_SOUND.GAIN;
				osc2.start();
				osc2.stop(ctx.currentTime + ALERT_SOUND.DURATION);
			}, ALERT_SOUND.SECOND_DELAY);
		} catch {
			// AudioContext not supported
		}
	}

	function handleModeChange(nextMode: TimerMode) {
		if (nextMode === mode) return;
		mode = nextMode;
		reset();
	}

	function handleTargetTimeChange(value: number) {
		if (isRunning) return;
		targetTime = value;
		if (mode === "countdown") {
			elapsedSeconds = value;
		}
		updateDisplay();
	}

	function handleClearRecords() {
		clearQuestionRecords(questionId as QuestionId);
		attempts = [];
		updateStats();
	}

	function toggleSettingsPopover() {
		if (settingsOpen) {
			closePopover();
		} else {
			openPopover();
		}
	}

	function openPopover() {
		settingsOpen = true;
		popoverEl.classList.remove("hidden");
		popoverBackdrop.classList.remove("hidden");
		gearIcon.classList.add("rotate-45");
		positionPopover();
		updatePopoverContent();
	}

	function positionPopover() {
		const rect = settingsBtn.getBoundingClientRect();
		const popoverHeight = popoverEl.offsetHeight;
		popoverEl.style.top = `${rect.top - popoverHeight - 8}px`;
		popoverEl.style.left = `${Math.max(8, rect.right - popoverEl.offsetWidth)}px`;
	}

	function closePopover() {
		settingsOpen = false;
		popoverEl.classList.add("hidden");
		popoverBackdrop.classList.add("hidden");
		gearIcon.classList.remove("rotate-45");
	}

	function updateDisplay() {
		// 解いた時間（秒）を data-elapsed に露出する。回答記録の duration に使う（readTimerDuration）。
		const spent = mode === "stopwatch" ? elapsedSeconds : targetTime - elapsedSeconds;
		el.dataset.elapsed = String(spent);

		// Start/Stop button
		if (isRunning) {
			startStopBtn.textContent = "停止";
			startStopBtn.className =
				"min-w-max whitespace-nowrap rounded-xl bg-red-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-red-700";
		} else {
			startStopBtn.textContent = "開始";
			startStopBtn.className =
				"min-w-max whitespace-nowrap rounded-xl bg-green-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-green-700";
		}

		// Reset button visibility
		if (isRunning) {
			resetBtn.classList.remove("hidden");
		} else {
			resetBtn.classList.add("hidden");
		}

		// Timer display styling
		let bgClass: string;
		let textClass: string;
		if (isCompleted) {
			bgClass = "bg-red-100 border-red-500 animate-pulse";
			textClass = "text-red-700 font-bold";
		} else if (isRunning) {
			bgClass = "bg-blue-100 border-blue-400";
			textClass = "text-blue-700";
		} else {
			bgClass = "bg-slate-100 border-slate-200";
			textClass = "text-slate-700";
		}

		timerDisplay.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${bgClass}`;
		clockIcon.className = `w-4 h-4 shrink-0 ${textClass} inline-flex`;

		// Time text
		let timeStr = formatTime(elapsedSeconds);
		if (mode === "countdown" && !isRunning && !isCompleted) {
			timeStr += ` / ${formatTime(targetTime)}`;
		}
		timeText.textContent = timeStr;
		timeText.className = `text-sm font-mono font-semibold tabular-nums whitespace-nowrap ${textClass}`;

		// Popover content if open
		if (settingsOpen) {
			updatePopoverContent();
		}
	}

	function updatePopoverContent() {
		const activeBtn =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors";
		const inactiveBtn =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";

		modeStopwatchBtn.className = mode === "stopwatch" ? activeBtn : inactiveBtn;
		modeCountdownBtn.className = mode === "countdown" ? activeBtn : inactiveBtn;

		// Target time section
		if (mode === "countdown") {
			targetTimeContainer.classList.remove("hidden");
		} else {
			targetTimeContainer.classList.add("hidden");
		}

		// Preset buttons
		const presetActive =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors";
		const presetInactive =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";
		const presetDisabled =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-400 border border-slate-200 cursor-not-allowed transition-colors";

		for (const btn of presetButtons) {
			const value = Number(btn.dataset.value);
			if (isRunning) {
				btn.className = presetDisabled;
				btn.disabled = true;
			} else if (targetTime === value) {
				btn.className = presetActive;
				btn.disabled = false;
			} else {
				btn.className = presetInactive;
				btn.disabled = false;
			}
		}

		updateStats();
	}

	function updateStats() {
		const lastVal = statLast.querySelector("div:last-child") as HTMLDivElement;
		const avgVal = statAvg.querySelector("div:last-child") as HTMLDivElement;
		const countVal = statCount.querySelector("div:last-child") as HTMLDivElement;

		if (attempts.length > 0) {
			const last = attempts[attempts.length - 1].duration;
			lastVal.textContent = formatTime(last);

			const avg = attempts.reduce((sum, a) => sum + a.duration, 0) / attempts.length;
			avgVal.textContent = formatTime(Math.round(avg));
		} else {
			lastVal.textContent = "--:--";
			avgVal.textContent = "--:--";
		}

		countVal.textContent = `${attempts.length}回`;

		// Clear button disabled state
		clearBtn.disabled = attempts.length === 0;
	}

	// 初期化（関数宣言は巻き上げられるので末尾呼び出しで全 DOM が構築される）
	loadRecords();
	buildDOM();
	updateDisplay();
	// destroy はページ寿命のタイマーでは通常呼ばれない（必要時の手動 cleanup 用）
	void destroy;
}

/** `[data-question-timer]` 要素すべてにタイマーを設定する。 */
export function initQuestionTimer(): void {
	mountAll("[data-question-timer]", setupQuestionTimer);
}
