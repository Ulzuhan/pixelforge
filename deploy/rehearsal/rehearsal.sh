#!/usr/bin/env bash
set -euo pipefail
umask 077
die(){ echo "$*" >&2; exit 2; }
# Hard stop outside GitHub's disposable test runner and before any Docker write.
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_ENVIRONMENT:-} == github-hosted &&
   ${RUNNER_ARCH:-} == ARM64 && $(uname -s)-$(uname -m) == Linux-aarch64 &&
   ${GITHUB_REPOSITORY,,} == ulzuhan/pixelforge &&
   -n ${RUNNER_TEMP:-} && -z ${DOCKER_HOST:-} && -z ${DOCKER_CONTEXT:-} &&
   $(docker context show) == default ]] || die "requires the isolated hosted ARM64 reviewer runner"
case ${1:-} in
  exact)
    [[ $# == 3 && $2 =~ ^sha256:[0-9a-f]{64}$ && $3 =~ ^[0-9a-f]{40}$ ]] ||
      die "exact CANDIDATE_INDEX CANDIDATE_COMMIT"
    cand_ref="ghcr.io/ulzuhan/pixelforge@$2"
    cand_source=$3
    # Requires reviewed tag v0.8.1 and attestation binding its exact digest/ref.
    gh attestation verify "oci://$cand_ref" --repo Ulzuhan/pixelforge \
      --signer-workflow Ulzuhan/pixelforge/.github/workflows/docker.yml \
      --source-ref refs/tags/v0.8.1 --source-digest "$cand_source" --deny-self-hosted-runners >/dev/null
    docker pull --platform linux/arm64 "$cand_ref" >/dev/null
    ;;
  review)
    [[ $# == 3 && $2 =~ ^sha256:[0-9a-f]{64}$ && $3 =~ ^[0-9a-f]{40}$ ]] ||
      die "review LOCAL_IMAGE_ID REVIEW_COMMIT"
    cand_ref=$2
    cand_source=$3
    ;;
  *) die "choose 'exact' or 'review'; these proofs are not interchangeable" ;;
esac
mode=$1
prior_ref=ghcr.io/ulzuhan/pixelforge@sha256:b7ed4fd60de0ca09c3cb620d97d11d25cfe334186bc55193d84e0ed1e0ab20a0
prior_source=9517188643b7a2be16e04034c0897276a6feca4e
prior_id=sha256:ee1ff6d68085eeed695157f26f8c5aaf76d5ad1db657f0945ae7bc14cd66e591
gh attestation verify "oci://$prior_ref" --repo Ulzuhan/pixelforge \
  --signer-workflow Ulzuhan/pixelforge/.github/workflows/docker.yml \
  --source-ref refs/heads/main --source-digest "$prior_source" --deny-self-hosted-runners >/dev/null
unset GH_TOKEN GITHUB_TOKEN
docker pull --platform linux/arm64 "$prior_ref" >/dev/null
[[ $(docker image inspect "$prior_ref" --format '{{.Id}} {{.Os}}/{{.Architecture}}') == "$prior_id linux/arm64" ]] ||
  die "prior exact ARM64 config mismatch"
[[ $(docker image inspect "$cand_ref" --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}') == "linux/arm64 $cand_source" ]] ||
  die "candidate ARM64 source mismatch"
cand_id=$(docker image inspect "$cand_ref" --format '{{.Id}}')
[[ $cand_id =~ ^sha256:[0-9a-f]{64}$ && "$cand_id" != "$prior_id" ]] || die "expected a distinct tested candidate"
here=$(cd "$(dirname "$0")" && pwd -P)
root=$(mktemp -d "$RUNNER_TEMP/pixelforge-pair.XXXXXXXX")
cid=
cleanup(){
  local rc=$?
  if [[ -n "$cid" ]]; then docker rm -f "$cid" >/dev/null 2>&1 || rc=1; fi
  sudo -n chmod u+rwx -- "$root/state" 2>/dev/null || true
  sudo -n chown "$(id -u):$(id -g)" -- "$root/state" 2>/dev/null || true
  rm -rf -- "$root" || rc=1
  exit "$rc"
}
trap cleanup EXIT
mkdir -m 700 "$root/state"
mkdir -m 755 "$root/models" "$root/probe"
sudo -n chown 10001:10001 -- "$root/state"

cat > "$root/expected-models" <<'MODELS'
60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a  isnet-general-use.onnx
8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491  u2net.onnx
75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb  silueta.onnx
309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8  u2netp.onnx
MODELS
while read -r sha model; do
  curl --silent --show-error --fail --location --proto '=https' --proto-redir '=https' \
      --max-time 120 --max-filesize 250000000 --output "$root/models/$model" \
      "https://github.com/danielgatis/rembg/releases/download/v0.0.0/$model"
  chmod 0444 -- "$root/models/$model"
done < "$root/expected-models"
models_ok(){ (cd "$root/models"; sha256sum --check --strict "$root/expected-models") >/dev/null; }
models_ok
install -m 0444 "$here/runtime.mjs" "$root/probe/"
secret=$(openssl rand -hex 32)
iat=$(node -e 'console.log(Date.now()-1000)')
stage(){
  local label=$1 image=$2 id=$3
  [[ -z "$cid" ]] || die "one-writer invariant"
  models_ok
  cid=$(docker create --pull never --platform linux/arm64 --network none --read-only \
    --user 10001:10001 --init --cap-drop all --security-opt no-new-privileges \
    --memory 2560m --cpus 2 --pids-limit 128 \
    --tmpfs /work:rw,noexec,nosuid,nodev,size=768m,uid=10001,gid=10001,mode=0700 \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=32m,uid=10001,gid=10001,mode=0700 \
    --mount "type=bind,src=$root/models,dst=/models,readonly" \
    --mount "type=bind,src=$root/state,dst=/state" \
    --mount "type=bind,src=$root/probe,dst=/fixture,readonly" \
    -e HOSTNAME=127.0.0.1 -e PORT=3458 -e U2NET_HOME=/models \
    -e PIXELFORGE_TMP_DIR=/work/jobs -e PIXELFORGE_STATE_DIR=/state \
    -e PIXELFORGE_MAX_JOBS=1 -e PIXELFORGE_MAX_QUEUE=6 \
    -e PIXELFORGE_MIN_MEM_AVAILABLE_MB=1024 -e PIXELFORGE_MIN_CGROUP_FREE_MB=768 \
    -e PIXELFORGE_OIDC_ISSUER=http://127.0.0.1:19979/fixture-oidc \
    -e PIXELFORGE_OIDC_CLIENT_ID=pixelforge-arm64-rehearsal \
    -e PIXELFORGE_OIDC_CLIENT_SECRET=local-synthetic-only \
    -e PIXELFORGE_OIDC_REDIRECT_URI=http://127.0.0.1:3458/api/auth/callback \
    -e PIXELFORGE_FIXTURE_IAT="$iat" -e PIXELFORGE_SESSION_SECRET="$secret" "$image")
  [[ "$cid" =~ ^[0-9a-f]{64}$ ]] || die "unexpected container ID"
  [[ $(docker inspect "$cid" --format '{{.Image}} {{.HostConfig.NetworkMode}} {{.HostConfig.ReadonlyRootfs}}') == "$id none true" ]] ||
    die "exact image/isolation guard failed"
  [[ $(docker inspect "$cid" --format '{{range .Mounts}}{{if eq .Destination "/models"}}{{.Source}} {{.RW}}{{end}}{{end}}') == "$root/models false" ]] ||
    die "models mount differs"
  [[ $(docker inspect "$cid" --format '{{range .Mounts}}{{if eq .Destination "/state"}}{{.Source}} {{.RW}}{{end}}{{end}}') == "$root/state true" ]] ||
    die "state mount differs"
  docker start "$cid" >/dev/null
  ok=
  for i in $(seq 1 35); do
    if docker exec "$cid" node -e 'fetch("http://127.0.0.1:3458/api/health",{signal:AbortSignal.timeout(500)}).then(res=>{if(!res.ok)process.exit(1);return res.json()}).then(j=>{if(j.ok!==true)process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then ok=y; break; fi
    sleep 1
  done
  [[ $ok == y ]] || die "readiness did not pass at $label"
  timeout 155s docker exec "$cid" node /fixture/runtime.mjs "$label"
  docker stop --time 20 "$cid" >/dev/null
  local stopped
  stopped=$(docker inspect "$cid" --format '{{.State.Running}} {{.State.OOMKilled}} {{.State.ExitCode}}')
  [[ "$stopped" == "false false 0" || "$stopped" == "false false 143" ]] ||
    die "container did not stop cleanly or OOM at $label"
  docker rm "$cid" >/dev/null
  cid=
  models_ok
}
stage prior "$prior_ref" "$prior_id"
stage candidate "$cand_ref" "$cand_id"
stage return "$prior_ref" "$prior_id"
echo "PIXELFORGE_PAIR_ARM64_OK mode=$mode"
