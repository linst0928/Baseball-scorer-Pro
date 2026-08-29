#!/usr/bin/env bash
set -euo pipefail

# 以專案受追蹤的 .githooks 目錄取代機器本機的 .git/hooks，確保團隊規則一致。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git rev-parse --is-inside-work-tree >/dev/null
git config --local core.hooksPath .githooks

echo "[hooks] 已啟用專案 hooks：$(git config --local --get core.hooksPath)"
echo "[hooks] pre-commit 會阻擋超過 ${MAX_STAGED_FILE_BYTES:-10485760} bytes 的已暫存檔案。"
