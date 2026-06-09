import { createClient } from "honox/client";
// document-level side effects only. UI state is owned by islands.
import "./features/srs/srs-recorder"; // 採点イベントを購読し SRS を更新する document リスナ

// islands の自動ハイドレーション
createClient();

// dashboard の chart.js は重いため、dashboard ページ（#dashboard-data あり）でのみ遅延ロード。
// import 時に自己初期化（DOMContentLoaded / 即時）する。
if (document.getElementById("dashboard-data")) {
	import("./features/dashboard/dashboard");
}
