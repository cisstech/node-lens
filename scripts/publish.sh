#!/usr/bin/env bash
# Publishes every non-private package to npm. Run after `nx run-many -t build`.
# In CI, npm authenticates through trusted publishing (OIDC); locally, run
# `npm login` first.
set -euo pipefail

node ./scripts/sync-versions.mjs

# Provenance needs a supported CI's OIDC token, so only request it on CI. This
# lets the same script publish locally as a fallback.
provenance=""
if [ "${CI:-}" = "true" ]; then
  provenance="--provenance"
fi

for dir in packages/*/; do
  pkg="${dir}package.json"
  [ -f "$pkg" ] || continue

  private=$(node -p "require('./${pkg}').private || false")
  if [ "$private" = "true" ]; then
    echo "skipping private package: $dir"
    continue
  fi

  cp -f LICENSE "${dir}LICENSE"
  echo "publishing ${dir}"
  (cd "$dir" && npm publish --access public ${provenance})
done
