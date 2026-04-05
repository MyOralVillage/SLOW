#!/usr/bin/env bash
# Usage: ./scripts/commit-with-date.sh "2026-04-04T15:00:00" git commit -m "Your message"
# Sets both author and committer date (for work-log alignment).
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 \"YYYY-MM-DDTHH:MM:SS\" git commit ..." >&2
  exit 1
fi
DATE="$1"
shift
export GIT_AUTHOR_DATE="$DATE"
export GIT_COMMITTER_DATE="$DATE"
git "$@"
