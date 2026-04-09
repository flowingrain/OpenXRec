#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the Next.js project..."
# 与 dev 一致：默认 webpack，避免部分环境下 Turbopack/SWC 子进程异常。需要 Turbopack 构建：NEXT_BUILD_TURBO=1
if [[ "${NEXT_BUILD_TURBO:-}" == "1" ]]; then
  pnpm next build
else
  pnpm next build --webpack
fi

echo "Build completed successfully!"
