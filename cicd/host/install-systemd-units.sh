#!/usr/bin/env bash
set -euo pipefail

release_dir="${1:-}"
[[ -n "${release_dir}" ]] || { echo "Usage: install-systemd-units.sh <absolute-release-directory>" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "Systemd unit installation must run as root." >&2; exit 1; }
release_dir="$(cd "${release_dir}" && pwd)"

unit_source="${release_dir}/cicd/host/systemd"
unit_target="/etc/systemd/system"
units=(
  morning-briefing-snapshot-refresh.service
  morning-briefing-snapshot-refresh.timer
  morning-briefing-dashboard-audio-refresh.service
  morning-briefing-dashboard-audio-refresh.timer
)

for service in \
  morning-briefing-snapshot-refresh.service \
  morning-briefing-dashboard-audio-refresh.service; do
  grep -Fqx 'User=root' "${unit_source}/${service}"
  grep -Fqx 'Group=root' "${unit_source}/${service}"
  grep -Fqx 'UMask=0077' "${unit_source}/${service}"
  grep -Fqx 'NoNewPrivileges=true' "${unit_source}/${service}"
done

test -x "${release_dir}/cicd/host/run-scheduled-job.sh"
systemd-analyze verify "${units[@]/#/${unit_source}/}"
install -o root -g root -m 0644 "${units[@]/#/${unit_source}/}" "${unit_target}/"
systemctl daemon-reload

for unit in "${units[@]}"; do
  cmp --silent "${unit_source}/${unit}" "${unit_target}/${unit}"
done

echo "Installed root-owned Morning Briefing systemd units without changing timer enablement."
