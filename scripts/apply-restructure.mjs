/**
 * リアーキテクチャのファイル移設を、import パスの再計算つきで行う。
 *
 * - MOVES に従ってファイルを移動する
 * - 各ファイルの相対 import を「移動前の解決先」で解決し、「移動後」の位置からの
 *   相対パスへ書き換える（プロジェクトは明示拡張子 import なので解決は単純）
 *
 * 使い方: node scripts/apply-restructure.mjs
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

/** 移動前 -> 移動後 */
const MOVES = {
	"app/features/challenge/player/initialPlayerSession.ts": "app/features/challenge/player/session.ts",
	"app/features/challenge/player/initialPlayerSession.test.ts": "app/features/challenge/player/session.test.ts",
	"app/features/challenge/player/initialView.ts": "app/features/challenge/player/view.ts",
	"app/features/challenge/player/initialView.test.ts": "app/features/challenge/player/view.test.ts",
	"app/features/challenge/player/timerRuntime.ts": "app/features/challenge/player/timer.ts",
	"app/features/challenge/player/timerRuntime.test.ts": "app/features/challenge/player/timer.test.ts",
};

const ROOT = process.cwd();
const abs = (p) => resolve(ROOT, p);

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			out.push(...walk(path));
		} else if (/\.tsx?$/.test(entry)) {
			out.push(path);
		}
	}
	return out;
}

const files = walk(abs("app"));
const contents = new Map();
for (const file of files) {
	contents.set(relative(ROOT, file), readFileSync(file, "utf8"));
}

const importPattern = /(from\s+["'])(\.\.?\/[^"']+)(["'])/g;

function rewrite(oldPath, source) {
	const oldDir = dirname(oldPath);
	const newPath = MOVES[oldPath] ?? oldPath;
	const newDir = dirname(newPath);

	return source.replace(importPattern, (match, before, spec, after) => {
		const targetOld = normalize(join(oldDir, spec));
		const targetNew = MOVES[targetOld] ?? targetOld;
		let rel = relative(newDir, targetNew);
		if (!rel.startsWith(".")) {
			rel = `./${rel}`;
		}
		return `${before}${rel}${after}`;
	});
}

for (const [oldPath, source] of contents) {
	const newPath = MOVES[oldPath] ?? oldPath;
	const rewritten = rewrite(oldPath, source);
	mkdirSync(dirname(abs(newPath)), { recursive: true });
	writeFileSync(abs(newPath), rewritten);
	if (newPath !== oldPath) {
		rmSync(abs(oldPath));
	}
}

// 空になったディレクトリを掃除
function prune(dir) {
	if (!statSync(dir).isDirectory()) return false;
	const entries = readdirSync(dir);
	let empty = true;
	for (const entry of entries) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			if (!prune(path)) empty = false;
		} else {
			empty = false;
		}
	}
	if (empty && dir !== abs("app")) {
		rmSync(dir, { recursive: true });
		return true;
	}
	return false;
}
prune(abs("app"));

console.log(`restructured ${Object.keys(MOVES).length} paths`);
