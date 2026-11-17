#!/usr/bin/env bash
# Two-phase real PostgreSQL concurrency smoke test; isolated CI database only.
set -euo pipefail

guest="quota-ci-race-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

pids=()
for n in $(seq 1 12); do
  (
    psql -X -A -t -q -v ON_ERROR_STOP=1 \
      -c "select outcome from public.reserve_compare_quota(null::uuid, '$guest', 'attempt-$n', 'fingerprint-$n')" \
      > "$tmp_dir/$n"
  ) &
  pids+=("$!")
done

for pid in "${pids[@]}"; do
  wait "$pid"
done

accepted="$(grep -l '^accepted$' "$tmp_dir"/* | wc -l | tr -d ' ')"
limited="$(grep -l '^quota_exceeded$' "$tmp_dir"/* | wc -l | tr -d ' ')"
if [[ "$accepted" -ne 5 || "$limited" -ne 7 ]]; then
  echo "FAIL: concurrent attempts accepted=$accepted limited=$limited; expected 5/7" >&2
  for row in "$tmp_dir"/*; do cat "$row"; done
  exit 1
fi

for bucket_kind in day minute; do
  units="$(psql -X -A -t -q -v ON_ERROR_STOP=1 \
    -c "select units from public.compare_quota_buckets where namespace='prompt-arena-compare' and subject_key='guest:$guest' and bucket_kind='$bucket_kind' and bucket_start=date_trunc('$bucket_kind', clock_timestamp() at time zone 'UTC') at time zone 'UTC'")"
  if [[ "$units" != "5" ]]; then
    echo "FAIL: $bucket_kind bucket usage=$units; expected 5" >&2
    exit 1
  fi
done

echo "PASS: 12 concurrent requests: exactly 5 accepted, 7 quota_exceeded; both UTC buckets=5"
