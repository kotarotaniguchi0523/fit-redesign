import { createClient } from "honox/client";
// 命令的コントローラ（island 不適のため client script として配線）。各 init は対象要素が
// 無いページでは no-op（mountAll が querySelectorAll で空集合）。
import "./features/srs/srs-recorder"; // 採点イベントを購読し SRS を更新する document リスナ
import "./utils/copy-button"; // Markdown コピーボタン（副作用）
import { initDailySession } from "./features/study/dailySession";
import { initStudyHome } from "./features/study/studyHome";
import { initQuestionTimer } from "./features/timer/question-timer";

// islands（AnswerSelector / SelfGrade）の自動ハイドレーション
createClient();

// 命令的コントローラ
initQuestionTimer();
initStudyHome();
initDailySession();

// dashboard の chart.js は重いため、dashboard ページ（#dashboard-data あり）でのみ遅延ロード。
// import 時に自己初期化（DOMContentLoaded / 即時）する。
if (document.getElementById("dashboard-data")) {
	import("./features/dashboard/dashboard");
}
