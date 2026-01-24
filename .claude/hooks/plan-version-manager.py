#!/usr/bin/env python3
"""
plan-version-manager.py
プランファイルのメタデータを自動更新するHookスクリプト
"""

import json
import os
import re
import sys
from datetime import datetime


def get_file_path_from_input() -> str | None:
    """stdinからJSON入力を読み取り、ファイルパスを取得"""
    try:
        input_data = json.load(sys.stdin)
        return input_data.get("tool_input", {}).get("file_path")
    except (json.JSONDecodeError, KeyError):
        return None


def is_plan_file(file_path: str, project_dir: str) -> bool:
    """プランファイルかどうかを判定"""
    plans_dir = os.path.join(project_dir, ".claude", "plans")
    abs_path = file_path if os.path.isabs(file_path) else os.path.join(project_dir, file_path)
    return abs_path.startswith(plans_dir) and os.path.isfile(abs_path)


def parse_version(version_str: str) -> tuple[int, int]:
    """バージョン文字列をメジャー・マイナーに分解"""
    match = re.match(r"(\d+)\.(\d+)", version_str)
    if match:
        return int(match.group(1)), int(match.group(2))
    return 1, 0


def increment_version(major: int, minor: int) -> str:
    """バージョンをインクリメント（1.9 → 2.0）"""
    minor += 1
    if minor >= 10:
        major += 1
        minor = 0
    return f"{major}.{minor}"


def extract_metadata(content: str) -> dict | None:
    """ファイル内容からメタデータを抽出"""
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        return None

    metadata = {}
    for line in match.group(1).strip().split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip()
    return metadata


def create_metadata(version: str, created: str, updated: str) -> str:
    """メタデータブロックを生成"""
    return f"---\nversion: {version}\ncreated: {created}\nupdated: {updated}\n---\n\n"


def update_plan_file(file_path: str) -> None:
    """プランファイルのメタデータを更新"""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
    metadata = extract_metadata(content)

    if metadata:
        # 既存メタデータを更新
        major, minor = parse_version(metadata.get("version", "1.0"))
        new_version = increment_version(major, minor)
        created = metadata.get("created", current_time)

        # メタデータ部分を置換
        new_metadata = create_metadata(new_version, created, current_time)
        new_content = re.sub(r"^---\n.*?\n---\n+", new_metadata, content, flags=re.DOTALL)
    else:
        # 新規メタデータを追加
        new_metadata = create_metadata("1.0", current_time, current_time)
        new_content = new_metadata + content

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def main():
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    file_path = get_file_path_from_input()

    if not file_path:
        sys.exit(0)

    # 絶対パスに変換
    abs_path = file_path if os.path.isabs(file_path) else os.path.join(project_dir, file_path)

    if is_plan_file(abs_path, project_dir):
        update_plan_file(abs_path)


if __name__ == "__main__":
    main()
