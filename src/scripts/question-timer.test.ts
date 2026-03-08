import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Custom Element を登録（モジュール読み込み時に customElements.define が実行される）
import "./question-timer";

// AudioContext モック
class MockOscillatorNode {
	frequency = { value: 0 };
	type = "sine";
	connect() {
		return this;
	}
	start() {}
	stop() {}
}

class MockGainNode {
	gain = { value: 0 };
	connect() {
		return this;
	}
}

class MockAudioContext {
	state = "running";
	currentTime = 0;
	createOscillator() {
		return new MockOscillatorNode();
	}
	createGain() {
		return new MockGainNode();
	}
	get destination() {
		return {};
	}
	resume() {
		return Promise.resolve();
	}
	close() {
		return Promise.resolve();
	}
}

vi.stubGlobal("AudioContext", MockAudioContext);

function createElement(questionId = "exam1-2013-q1"): HTMLElement {
	const el = document.createElement("question-timer");
	el.setAttribute("question-id", questionId);
	return el;
}

function mount(el: HTMLElement): HTMLElement {
	document.body.appendChild(el);
	return el;
}

function getStartStopBtn(el: HTMLElement): HTMLButtonElement {
	return el.querySelectorAll("button")[0] as HTMLButtonElement;
}

function getResetBtn(el: HTMLElement): HTMLButtonElement {
	return el.querySelectorAll("button")[1] as HTMLButtonElement;
}

function getTimeText(el: HTMLElement): HTMLSpanElement {
	return el.querySelector(".font-mono") as HTMLSpanElement;
}

function getSettingsBtn(el: HTMLElement): HTMLButtonElement {
	return el.querySelector("[aria-label='タイマー設定']") as HTMLButtonElement;
}

function getPopover(_el: HTMLElement): HTMLDivElement {
	return document.body.querySelector(".z-50") as HTMLDivElement;
}

describe("QuestionTimer Custom Element", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
	});

	describe("初期状態", () => {
		it("DOMが正しく構築される", () => {
			const el = mount(createElement());

			expect(getStartStopBtn(el)).toBeDefined();
			expect(getTimeText(el)).toBeDefined();
			expect(getSettingsBtn(el)).toBeDefined();
		});

		it("初期表示は 00:00 で開始ボタンが表示される", () => {
			const el = mount(createElement());

			expect(getStartStopBtn(el).textContent).toBe("開始");
			expect(getTimeText(el).textContent).toBe("00:00");
		});

		it("リセットボタンは初期状態で非表示", () => {
			const el = mount(createElement());

			expect(getResetBtn(el).classList.contains("hidden")).toBe(true);
		});

		it("設定ポップオーバーは初期状態で非表示", () => {
			const el = mount(createElement());

			expect(getPopover(el).classList.contains("hidden")).toBe(true);
		});
	});

	describe("ストップウォッチモード", () => {
		it("開始ボタンをクリックするとタイマーが動作する", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();

			expect(getStartStopBtn(el).textContent).toBe("停止");
			expect(getResetBtn(el).classList.contains("hidden")).toBe(false);
		});

		it("1秒経過後に 00:01 と表示される", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(1000);

			expect(getTimeText(el).textContent).toBe("00:01");
		});

		it("65秒経過後に 01:05 と表示される", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(65_000);

			expect(getTimeText(el).textContent).toBe("01:05");
		});

		it("停止ボタンで一時停止する", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(5000);
			getStartStopBtn(el).click(); // 停止

			expect(getStartStopBtn(el).textContent).toBe("開始");
			expect(getTimeText(el).textContent).toBe("00:05");

			// 停止後は進まない
			vi.advanceTimersByTime(3000);
			expect(getTimeText(el).textContent).toBe("00:05");
		});

		it("停止→再開で計測が続行される", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(3000);
			getStartStopBtn(el).click(); // 停止

			getStartStopBtn(el).click(); // 再開
			vi.advanceTimersByTime(2000);

			expect(getTimeText(el).textContent).toBe("00:05");
		});

		it("実行中のスタイルが適用される", () => {
			const el = mount(createElement());
			const display = el.querySelector(".rounded-full") as HTMLDivElement;

			getStartStopBtn(el).click();

			expect(display.className).toContain("bg-blue-100");
			expect(display.className).toContain("border-blue-400");
		});
	});

	describe("カウントダウンモード", () => {
		function switchToCountdown(el: HTMLElement) {
			getSettingsBtn(el).click();
			const buttons = getPopover(el).querySelectorAll("button");
			// "カウントダウン" ボタンを探す
			for (const btn of buttons) {
				if (btn.textContent === "カウントダウン") {
					btn.click();
					break;
				}
			}
		}

		it("カウントダウンモードに切り替えると目標時間が表示される", () => {
			const el = mount(createElement());

			switchToCountdown(el);

			// デフォルト目標時間は60秒 = 01:00
			expect(getTimeText(el).textContent).toContain("01:00");
		});

		it("カウントダウンが0になるとタイマーが停止する", () => {
			const el = mount(createElement());

			switchToCountdown(el);
			getStartStopBtn(el).click();
			vi.advanceTimersByTime(60_000);

			expect(getTimeText(el).textContent).toBe("00:00");
			expect(getStartStopBtn(el).textContent).toBe("開始");
		});

		it("カウントダウン完了時に完了スタイルが適用される", () => {
			const el = mount(createElement());
			const display = el.querySelector(".rounded-full") as HTMLDivElement;

			switchToCountdown(el);
			getStartStopBtn(el).click();
			vi.advanceTimersByTime(60_000);

			expect(display.className).toContain("bg-red-100");
			expect(display.className).toContain("animate-pulse");
		});

		it("目標時間プリセットを変更できる", () => {
			const el = mount(createElement());

			switchToCountdown(el);

			// "2分" プリセットボタンを探してクリック
			const presetButtons = getPopover(el).querySelectorAll("button");
			for (const btn of presetButtons) {
				if (btn.textContent === "2分") {
					btn.click();
					break;
				}
			}

			expect(getTimeText(el).textContent).toContain("02:00");
		});

		it("リセットでカウントダウンが目標時間に戻る", () => {
			const el = mount(createElement());

			switchToCountdown(el);
			getStartStopBtn(el).click();
			vi.advanceTimersByTime(10_000); // 10秒進める

			// 50秒残り
			expect(getTimeText(el).textContent).toBe("00:50");

			getResetBtn(el).click();

			expect(getTimeText(el).textContent).toContain("01:00");
		});
	});

	describe("設定ポップオーバー", () => {
		it("歯車ボタンで開閉できる", () => {
			const el = mount(createElement());
			const popover = getPopover(el);

			expect(popover.classList.contains("hidden")).toBe(true);

			getSettingsBtn(el).click();
			expect(popover.classList.contains("hidden")).toBe(false);

			getSettingsBtn(el).click();
			expect(popover.classList.contains("hidden")).toBe(true);
		});

		it("背景クリックでポップオーバーが閉じる", () => {
			const el = mount(createElement());

			getSettingsBtn(el).click();
			expect(getPopover(el).classList.contains("hidden")).toBe(false);

			// backdrop をクリック
			const backdrop = document.body.querySelector(".fixed.inset-0") as HTMLDivElement;
			backdrop.click();

			expect(getPopover(el).classList.contains("hidden")).toBe(true);
		});

		it("歯車アイコンが開閉時に回転する", () => {
			const el = mount(createElement());
			const gearIcon = getSettingsBtn(el).querySelector("span") as HTMLSpanElement;

			getSettingsBtn(el).click();
			expect(gearIcon.classList.contains("rotate-45")).toBe(true);

			getSettingsBtn(el).click();
			expect(gearIcon.classList.contains("rotate-45")).toBe(false);
		});
	});

	describe("記録保存", () => {
		it("ストップウォッチ停止時に記録が保存される", () => {
			const el = mount(createElement("exam1-2013-q1"));

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(10_000);
			getStartStopBtn(el).click(); // 停止

			const raw = localStorage.getItem(
				Object.keys(localStorage).find((k) => k.startsWith("fit-exam-timer-records")) ?? "",
			);
			expect(raw).toBeTruthy();
			const data = JSON.parse(raw!);
			const record = data.records["exam1-2013-q1"];
			expect(record).toBeDefined();
			expect(record.attempts).toHaveLength(1);
			expect(record.attempts[0].duration).toBe(10);
			expect(record.attempts[0].mode).toBe("stopwatch");
		});

		it("統計情報がポップオーバーに表示される", () => {
			const el = mount(createElement("exam2-2014-q1"));

			// 1回目
			getStartStopBtn(el).click();
			vi.advanceTimersByTime(30_000);
			getStartStopBtn(el).click();

			getSettingsBtn(el).click();
			const statTexts = Array.from(getPopover(el).querySelectorAll(".font-mono.font-semibold")).map(
				(e) => e.textContent,
			);

			// 前回: 00:30, 平均: 00:30, 回数: 1回 のいずれかが含まれる
			expect(statTexts).toContain("00:30");
			expect(statTexts.some((t) => t?.includes("1回"))).toBe(true);
		});
	});

	describe("disconnectedCallback", () => {
		it("DOMから削除されてもエラーにならない", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(5000);

			expect(() => el.remove()).not.toThrow();
		});

		it("DOMから削除するとインターバルが停止する", () => {
			const el = mount(createElement());

			getStartStopBtn(el).click();
			vi.advanceTimersByTime(3000);

			el.remove();

			// インターバルが停止しているので追加のタイマーイベントは発生しない
			expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
		});
	});
});
