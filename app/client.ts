import { createClient } from "honox/client";
// 命令的コントローラ（island 不適のため client script として配線）。各 init は対象要素が
// 無いページでは no-op（mountAll が querySelectorAll で空集合）。
import "../src/features/srs/srs-recorder"; // 採点イベントを購読し SRS を更新する document リスナ
import "../src/utils/copy-button"; // Markdown コピーボタン（副作用）
import { initDailySession } from "../src/features/study/dailySession";
import { initStudyHome } from "../src/features/study/studyHome";
import { initQuestionTimer } from "../src/features/timer/question-timer";

// islands（AnswerSelector / SelfGrade）の自動ハイドレーション
createClient();

// 命令的コントローラ
initQuestionTimer();
initStudyHome();
initDailySession();
