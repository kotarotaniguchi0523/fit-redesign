/**
 * `.bin` のシムを作り直す。
 *
 * この環境のワークスペースは virtiofs で **symlink が禁止** されているため、
 * pnpm/npm の `.bin` シンボリックリンク作成だけが `EPERM (os error 1)` で失敗する
 * （パッケージ本体の導入は完了している）。そこで各パッケージの `bin` 定義を読み、
 * `node_modules/.bin` に **通常のシェルスクリプト**として実行シムを書き出す。
 *
 * 依存やパッケージマネージャーを変える必要はない。インストール後に一度だけ実行する。
 *
 * 使い方: node scripts/fix-bin-shims.mjs
 */
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MODULES = join(ROOT, "node_modules");
const BIN_DIR = join(MODULES, ".bin");

/** node_modules 直下のパッケージディレクトリを列挙する（scope を展開）。 */
function packageDirs() {
	const dirs = [];
	for (const entry of readdirSync(MODULES, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === ".bin" || entry.name === ".pnpm") {
			continue;
		}
		if (entry.name.startsWith("@")) {
			for (const scoped of readdirSync(join(MODULES, entry.name), { withFileTypes: true })) {
				if (scoped.isDirectory()) {
					dirs.push(join(MODULES, entry.name, scoped.name));
				}
			}
		} else {
			dirs.push(join(MODULES, entry.name));
		}
	}
	return dirs;
}

mkdirSync(BIN_DIR, { recursive: true });

let created = 0;
for (const dir of packageDirs()) {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) {
		continue;
	}
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	} catch {
		continue;
	}
	if (!pkg.bin) {
		continue;
	}

	const bins =
		typeof pkg.bin === "string"
			? { [pkg.name.replace(/^@[^/]+\//, "")]: pkg.bin }
			: pkg.bin;

	for (const [name, relativeTarget] of Object.entries(bins)) {
		const target = join(dir, relativeTarget);
		if (!existsSync(target)) {
			continue;
		}
		const isScript = /\.(c?js|mjs)$/.test(target);
		const body = isScript
			? `#!/bin/sh\nexec node "${target}" "$@"\n`
			: `#!/bin/sh\nexec "${target}" "$@"\n`;
		const shim = join(BIN_DIR, name);
		writeFileSync(shim, body);
		chmodSync(shim, 0o755);
		created++;
	}
}

console.log(`wrote ${created} bin shims to node_modules/.bin`);
