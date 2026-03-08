import {
	ALERT_SOUND,
	DEFAULT_TARGET_TIME,
	TARGET_TIME_PRESETS,
	TIMER_INTERVAL_MS,
} from "../constants";
import type { QuestionId } from "../types/index";
import type { AttemptRecord, TimerMode } from "../types/timer";
import { formatTime } from "../utils/timeFormat";
import { clearQuestionRecords, loadTimerData, saveAttempt } from "../utils/timerStorage";

// SVG icons as raw strings
const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`;
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`;

class QuestionTimer extends HTMLElement {
	// Timer state
	private mode: TimerMode = "stopwatch";
	private elapsedSeconds = 0;
	private isRunning = false;
	private isCompleted = false;
	private targetTime = DEFAULT_TARGET_TIME;

	// Records state
	private attempts: AttemptRecord[] = [];

	// Refs
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private audioContext: AudioContext | null = null;
	private alertTimeout: ReturnType<typeof setTimeout> | null = null;
	private hasSaved = false;

	// DOM elements
	private startStopBtn!: HTMLButtonElement;
	private resetBtn!: HTMLButtonElement;
	private timerDisplay!: HTMLDivElement;
	private clockIcon!: HTMLSpanElement;
	private timeText!: HTMLSpanElement;
	private settingsBtn!: HTMLButtonElement;
	private gearIcon!: HTMLSpanElement;
	private popoverEl!: HTMLDivElement;
	private popoverBackdrop!: HTMLDivElement;
	private modeStopwatchBtn!: HTMLButtonElement;
	private modeCountdownBtn!: HTMLButtonElement;
	private targetTimeContainer!: HTMLDivElement;
	private presetButtons: HTMLButtonElement[] = [];
	private statLast!: HTMLDivElement;
	private statAvg!: HTMLDivElement;
	private statCount!: HTMLDivElement;
	private clearBtn!: HTMLButtonElement;
	private settingsOpen = false;

	get questionId(): string {
		return this.getAttribute("question-id") || "";
	}

	connectedCallback() {
		this.loadRecords();
		this.buildDOM();
		this.updateDisplay();
	}

	disconnectedCallback() {
		this.stopInterval();
		if (this.alertTimeout) {
			clearTimeout(this.alertTimeout);
			this.alertTimeout = null;
		}
		if (this.audioContext) {
			this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}
		this.closePopover();
		this.popoverBackdrop?.remove();
		this.popoverEl?.remove();
	}

	private loadRecords() {
		const loadResult = loadTimerData();
		if (!loadResult.ok) return;
		const questionRecord = loadResult.value.records[this.questionId as QuestionId];
		if (questionRecord) {
			this.attempts = questionRecord.attempts;
		}

		// Background: load from server and merge
		this.loadFromServerAndMerge();
	}

	private loadFromServerAndMerge() {
		import("../utils/timerSync").then(async ({ loadFromServer, mergeData }) => {
			const { getUserId } = await import("../utils/timerStorage");
			const userId = getUserId();
			const remoteData = await loadFromServer(userId);
			if (!remoteData) return;

			const localResult = loadTimerData();
			if (!localResult.ok) return;

			const merged = mergeData(localResult.value, remoteData);

			// Save merged data back to localStorage
			const { saveTimerData } = await import("../utils/timerStorage");
			saveTimerData(merged);

			// Update this timer's attempts
			const record = merged.records[this.questionId as QuestionId];
			if (record) {
				this.attempts = record.attempts;
				if (this.settingsOpen) {
					this.updateStats();
				}
			}
		}).catch(() => {});
	}

	private buildDOM() {
		this.innerHTML = "";
		const wrapper = document.createElement("div");
		wrapper.className = "relative";

		// Main timer area
		const mainRow = document.createElement("div");
		mainRow.className = "flex items-center gap-2";

		// Start/Stop button
		this.startStopBtn = document.createElement("button");
		this.startStopBtn.className =
			"min-w-max whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors";
		this.startStopBtn.textContent = "開始";
		this.startStopBtn.addEventListener("click", () => this.handleStartStop());

		// Reset button (hidden by default)
		this.resetBtn = document.createElement("button");
		this.resetBtn.className =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-amber-500 hover:bg-amber-600 transition-colors hidden";
		this.resetBtn.textContent = "リセット";
		this.resetBtn.addEventListener("click", () => this.handleReset());

		// Timer display capsule
		this.timerDisplay = document.createElement("div");
		this.timerDisplay.className =
			"flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors bg-slate-100 border-slate-200";

		this.clockIcon = document.createElement("span");
		this.clockIcon.className = "w-4 h-4 shrink-0 text-slate-700 inline-flex";
		this.clockIcon.innerHTML = CLOCK_SVG;

		this.timeText = document.createElement("span");
		this.timeText.className =
			"text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-slate-700";

		this.timerDisplay.appendChild(this.clockIcon);
		this.timerDisplay.appendChild(this.timeText);

		// Settings button
		this.settingsBtn = document.createElement("button");
		this.settingsBtn.className = "p-1.5 rounded-lg hover:bg-slate-100 transition-colors";
		this.settingsBtn.setAttribute("aria-label", "タイマー設定");
		this.gearIcon = document.createElement("span");
		this.gearIcon.className =
			"w-5 h-5 text-slate-500 inline-flex transition-transform duration-200";
		this.gearIcon.innerHTML = GEAR_SVG;
		this.settingsBtn.appendChild(this.gearIcon);
		this.settingsBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleSettingsPopover();
		});

		mainRow.appendChild(this.startStopBtn);
		mainRow.appendChild(this.resetBtn);
		mainRow.appendChild(this.timerDisplay);
		mainRow.appendChild(this.settingsBtn);

		// Popover backdrop (invisible click catcher)
		this.popoverBackdrop = document.createElement("div");
		this.popoverBackdrop.className = "fixed inset-0 z-40 hidden";
		this.popoverBackdrop.addEventListener("click", () => this.closePopover());

		// Popover (fixed positioning to escape stacking context created by parent's scale-90)
		this.popoverEl = document.createElement("div");
		this.popoverEl.className =
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

		this.modeStopwatchBtn = document.createElement("button");
		this.modeStopwatchBtn.textContent = "ストップウォッチ";
		this.modeStopwatchBtn.addEventListener("click", () => this.handleModeChange("stopwatch"));

		this.modeCountdownBtn = document.createElement("button");
		this.modeCountdownBtn.textContent = "カウントダウン";
		this.modeCountdownBtn.addEventListener("click", () => this.handleModeChange("countdown"));

		modeRow.appendChild(this.modeStopwatchBtn);
		modeRow.appendChild(this.modeCountdownBtn);
		modeSection.appendChild(modeLabel);
		modeSection.appendChild(modeRow);

		// Target time section (countdown only)
		this.targetTimeContainer = document.createElement("div");
		this.targetTimeContainer.className = "hidden";
		const targetLabel = document.createElement("p");
		targetLabel.className = "text-xs font-semibold text-slate-600 mb-2";
		targetLabel.textContent = "目標時間";
		const presetRow = document.createElement("div");
		presetRow.className = "flex gap-1 flex-wrap";

		this.presetButtons = TARGET_TIME_PRESETS.map((preset) => {
			const btn = document.createElement("button");
			btn.textContent = preset.label;
			btn.dataset.value = String(preset.value);
			btn.addEventListener("click", () => this.handleTargetTimeChange(preset.value));
			presetRow.appendChild(btn);
			return btn;
		});

		this.targetTimeContainer.appendChild(targetLabel);
		this.targetTimeContainer.appendChild(presetRow);

		// Stats section
		const statsSection = document.createElement("div");
		const statsLabel = document.createElement("p");
		statsLabel.className = "text-xs font-semibold text-slate-600 mb-2";
		statsLabel.textContent = "統計";
		const statsGrid = document.createElement("div");
		statsGrid.className = "grid grid-cols-3 gap-1";

		this.statLast = this.createStatCard("前回", "--:--");
		this.statAvg = this.createStatCard("平均", "--:--");
		this.statCount = this.createStatCard("回数", "0回");

		statsGrid.appendChild(this.statLast);
		statsGrid.appendChild(this.statAvg);
		statsGrid.appendChild(this.statCount);
		statsSection.appendChild(statsLabel);
		statsSection.appendChild(statsGrid);

		// Clear button
		this.clearBtn = document.createElement("button");
		this.clearBtn.className =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
		this.clearBtn.textContent = "履歴をクリア";
		this.clearBtn.addEventListener("click", () => this.handleClearRecords());

		popoverInner.appendChild(modeSection);
		popoverInner.appendChild(this.targetTimeContainer);
		popoverInner.appendChild(statsSection);
		popoverInner.appendChild(this.clearBtn);
		this.popoverEl.appendChild(popoverInner);

		wrapper.appendChild(mainRow);
		this.appendChild(wrapper);
		// Append popover and backdrop to body to escape stacking context
		document.body.appendChild(this.popoverBackdrop);
		document.body.appendChild(this.popoverEl);
	}

	private createStatCard(label: string, value: string): HTMLDivElement {
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

	private handleStartStop() {
		if (this.isRunning) {
			this.stop();
		} else {
			this.start();
		}
	}

	private start() {
		this.isRunning = true;
		this.isCompleted = false;
		this.hasSaved = false;
		this.startInterval();
		this.updateDisplay();
	}

	private stop() {
		this.isRunning = false;
		this.stopInterval();
		this.saveAttemptIfNeeded();
		this.updateDisplay();
	}

	private handleReset() {
		this.stopInterval();
		this.isRunning = false;
		this.isCompleted = false;
		this.elapsedSeconds = this.mode === "countdown" ? this.targetTime : 0;
		this.updateDisplay();
	}

	private reset(nextMode?: TimerMode) {
		const effectiveMode = nextMode ?? this.mode;
		this.stopInterval();
		this.isRunning = false;
		this.isCompleted = false;
		this.hasSaved = false;
		this.elapsedSeconds = effectiveMode === "countdown" ? this.targetTime : 0;
		this.updateDisplay();
	}

	private startInterval() {
		this.stopInterval();
		this.intervalId = setInterval(() => {
			if (this.mode === "stopwatch") {
				this.elapsedSeconds += 1;
			} else {
				const next = this.elapsedSeconds - 1;
				this.elapsedSeconds = next <= 0 ? 0 : next;
			}
			this.updateDisplay();

			// Countdown completion check
			if (this.mode === "countdown" && this.isRunning && this.elapsedSeconds === 0) {
				this.isRunning = false;
				this.isCompleted = true;
				this.stopInterval();
				this.playAlertSound();
				this.saveAttemptIfNeeded();
				this.updateDisplay();
			}
		}, TIMER_INTERVAL_MS);
	}

	private stopInterval() {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private saveAttemptIfNeeded() {
		if (this.hasSaved) return;

		const elapsed = this.elapsedSeconds;
		const duration = this.mode === "stopwatch" ? elapsed : this.targetTime - elapsed;

		if (duration > 0) {
			const attempt: AttemptRecord = {
				timestamp: Date.now(),
				duration,
				mode: this.mode,
				completed: this.isCompleted,
				targetTime: this.targetTime,
			};
			saveAttempt(this.questionId as QuestionId, attempt);
			this.attempts = [...this.attempts, attempt];
			this.hasSaved = true;
			this.updateStats();
		}
	}

	private playAlertSound() {
		try {
			if (!this.audioContext) {
				this.audioContext = new AudioContext();
			}
			const ctx = this.audioContext;

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

			this.alertTimeout = setTimeout(() => {
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

	private handleModeChange(nextMode: TimerMode) {
		if (nextMode === this.mode) return;
		this.mode = nextMode;
		this.reset();
	}

	private handleTargetTimeChange(value: number) {
		if (this.isRunning) return;
		this.targetTime = value;
		if (this.mode === "countdown") {
			this.elapsedSeconds = value;
		}
		this.updateDisplay();
	}

	private handleClearRecords() {
		clearQuestionRecords(this.questionId as QuestionId);
		this.attempts = [];
		this.updateStats();
	}

	private toggleSettingsPopover() {
		if (this.settingsOpen) {
			this.closePopover();
		} else {
			this.openPopover();
		}
	}

	private openPopover() {
		this.settingsOpen = true;
		this.popoverEl.classList.remove("hidden");
		this.popoverBackdrop.classList.remove("hidden");
		this.gearIcon.classList.add("rotate-45");
		this.positionPopover();
		this.updatePopoverContent();
	}

	private positionPopover() {
		const rect = this.settingsBtn.getBoundingClientRect();
		const popoverHeight = this.popoverEl.offsetHeight;
		this.popoverEl.style.top = `${rect.top - popoverHeight - 8}px`;
		this.popoverEl.style.left = `${Math.max(8, rect.right - this.popoverEl.offsetWidth)}px`;
	}

	private closePopover() {
		this.settingsOpen = false;
		this.popoverEl.classList.add("hidden");
		this.popoverBackdrop.classList.add("hidden");
		this.gearIcon.classList.remove("rotate-45");
	}

	private updateDisplay() {
		// Start/Stop button
		if (this.isRunning) {
			this.startStopBtn.textContent = "停止";
			this.startStopBtn.className =
				"min-w-max whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors";
		} else {
			this.startStopBtn.textContent = "開始";
			this.startStopBtn.className =
				"min-w-max whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors";
		}

		// Reset button visibility
		if (this.isRunning) {
			this.resetBtn.classList.remove("hidden");
		} else {
			this.resetBtn.classList.add("hidden");
		}

		// Timer display styling
		let bgClass: string;
		let textClass: string;
		if (this.isCompleted) {
			bgClass = "bg-red-100 border-red-500 animate-pulse";
			textClass = "text-red-700 font-bold";
		} else if (this.isRunning) {
			bgClass = "bg-blue-100 border-blue-400";
			textClass = "text-blue-700";
		} else {
			bgClass = "bg-slate-100 border-slate-200";
			textClass = "text-slate-700";
		}

		this.timerDisplay.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${bgClass}`;
		this.clockIcon.className = `w-4 h-4 shrink-0 ${textClass} inline-flex`;

		// Time text
		let timeStr = formatTime(this.elapsedSeconds);
		if (this.mode === "countdown" && !this.isRunning && !this.isCompleted) {
			timeStr += ` / ${formatTime(this.targetTime)}`;
		}
		this.timeText.textContent = timeStr;
		this.timeText.className = `text-sm font-mono font-semibold tabular-nums whitespace-nowrap ${textClass}`;

		// Popover content if open
		if (this.settingsOpen) {
			this.updatePopoverContent();
		}
	}

	private updatePopoverContent() {
		const activeBtn =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors";
		const inactiveBtn =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";

		this.modeStopwatchBtn.className = this.mode === "stopwatch" ? activeBtn : inactiveBtn;
		this.modeCountdownBtn.className = this.mode === "countdown" ? activeBtn : inactiveBtn;

		// Target time section
		if (this.mode === "countdown") {
			this.targetTimeContainer.classList.remove("hidden");
		} else {
			this.targetTimeContainer.classList.add("hidden");
		}

		// Preset buttons
		const presetActive =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors";
		const presetInactive =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";
		const presetDisabled =
			"px-3 py-1.5 text-sm font-medium rounded-xl text-slate-400 border border-slate-200 cursor-not-allowed transition-colors";

		for (const btn of this.presetButtons) {
			const value = Number(btn.dataset.value);
			if (this.isRunning) {
				btn.className = presetDisabled;
				btn.disabled = true;
			} else if (this.targetTime === value) {
				btn.className = presetActive;
				btn.disabled = false;
			} else {
				btn.className = presetInactive;
				btn.disabled = false;
			}
		}

		this.updateStats();
	}

	private updateStats() {
		const lastVal = this.statLast.querySelector("div:last-child") as HTMLDivElement;
		const avgVal = this.statAvg.querySelector("div:last-child") as HTMLDivElement;
		const countVal = this.statCount.querySelector("div:last-child") as HTMLDivElement;

		if (this.attempts.length > 0) {
			const last = this.attempts[this.attempts.length - 1].duration;
			lastVal.textContent = formatTime(last);

			const avg = this.attempts.reduce((sum, a) => sum + a.duration, 0) / this.attempts.length;
			avgVal.textContent = formatTime(Math.round(avg));
		} else {
			lastVal.textContent = "--:--";
			avgVal.textContent = "--:--";
		}

		countVal.textContent = `${this.attempts.length}回`;

		// Clear button disabled state
		this.clearBtn.disabled = this.attempts.length === 0;
	}
}

customElements.define("question-timer", QuestionTimer);
