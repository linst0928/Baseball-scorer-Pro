#!/usr/bin/env bash
set -euo pipefail

# 僅檢查索引中的新建、加入或重新命名檔案，避免工作目錄未暫存的內容影響提交結果。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAX_BYTES="${MAX_STAGED_FILE_BYTES:-10485760}" # 預設 10 MiB

if ! [[ "$MAX_BYTES" =~ ^[0-9]+$ ]] || (( MAX_BYTES <= 0 )); then
  echo "[large-file-check] MAX_STAGED_FILE_BYTES 必須是大於 0 的整數。" >&2
  exit 2
fi

cd "$ROOT_DIR"

blocked=0
while IFS= read -r -d '' path; do
  size="$(git cat-file -s ":$path")"
  if (( size > MAX_BYTES )); then
    size_mib="$(awk -v bytes="$size" 'BEGIN { printf "%.2f", bytes / 1048576 }')"
    limit_mib="$(awk -v bytes="$MAX_BYTES" 'BEGIN { printf "%.2f", bytes / 1048576 }')"
    echo "[large-file-check] 阻擋：$path（${size_mib} MiB；限制 ${limit_mib} MiB）" >&2
    blocked=$((blocked + 1))
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if (( blocked > 0 )); then
  cat >&2 <<'EOF'

提交已中止：請將大型二進位檔改放於 Release／Artifact 儲存，或在確認必要性後拆分檔案。
如確實需要調整限制，可在單次提交前設定 MAX_STAGED_FILE_BYTES；請勿使用 --no-verify 規避檢查。
EOF
  exit 1
fi

echo "[large-file-check] 通過：所有已暫存檔案均未超過 ${MAX_BYTES} bytes。"
