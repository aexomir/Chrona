#!/usr/bin/env bash
input="$(cat)"
cmd="$(echo "$input" | jq -r '.tool_input.command // empty')"

if echo "$cmd" | grep -qE '(^|[;&|]|[[:space:]])git[[:space:]]+push([[:space:]]|$|--|$)'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"git push is blocked by project policy (.claude/hooks/block-git-push.sh). Ask the user to push manually."}}'
else
  echo '{}'
fi
