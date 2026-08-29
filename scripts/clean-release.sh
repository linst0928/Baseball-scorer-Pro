#!/usr/bin/env bash
set -euo pipefail

# 清除可安全重建的快取與 Android 建置產物；不刪除原始碼、設定、簽章或 node_modules。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
elif [[ $# -gt 0 ]]; then
  echo "用法：bash scripts/clean-release.sh [--dry-run]" >&2
  exit 2
fi

cd "$ROOT_DIR"

targets=(
  ".expo"
  ".cache"
  "dist"
  "build"
  "android/.gradle"
  "android/build"
  "android/app/build"
  "android/.cxx"
  "android/app/.cxx"
  "android/app/.externalNativeBuild"
)

removed_count=0
remove_target() {
  local target="$1"
  if [[ -e "$target" || -L "$target" ]]; then
    echo "[release-clean] 移除：$target"
    if [[ "$DRY_RUN" == false ]]; then
      rm -rf -- "$target"
    fi
    removed_count=$((removed_count + 1))
  fi
}

for target in "${targets[@]}"; do
  remove_target "$target"
done

while IFS= read -r -d '' artifact; do
  remove_target "$artifact"
done < <(
  find . \
    -path "./.git" -prune -o \
    -path "./node_modules" -prune -o \
    -type f \( -name "*.apk" -o -name "*.aab" \) -print0
)

if [[ "$DRY_RUN" == true ]]; then
  echo "[release-clean] 預覽完成：將清除 $removed_count 個快取或建置項目。"
else
  echo "[release-clean] 完成：已清除 $removed_count 個快取或建置項目。"
fi
