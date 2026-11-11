#!/usr/bin/env bash
set -euo pipefail
umask 077
export PYTHONPATH=/opt/sfa
# Root is required to include recovery keys; archives are never uploaded by this script.
[[ $EUID -eq 0 ]] || { echo 'Run sudo sfa backup-now'; exit 1; }
mkdir -p /var/backups/sfa
exec 9>/run/lock/sfa-backup.lock
flock -n 9 || exit 0
stamp=$(date +%Y%m%d-%H%M%S)
tmp=$(mktemp -d /var/backups/sfa/.working-XXXXXX)
trap 'rm -rf "$tmp"' EXIT
# Freeze writers (API + bot + CLI) using same PostgreSQL advisory lock for a consistent DB/files snapshot.
/opt/sfa/.venv/bin/python - "$tmp" <<'PY'
import os,subprocess,sys
from pathlib import Path
from sfa_api.config import Config
from sfa_api.db import DB
folder=Path(sys.argv[1]); cfg=Config.env()
with DB(cfg.database_url).tx():
    with (folder/'database.dump').open('wb') as f:
        subprocess.run(['runuser','-u','postgres','--','pg_dump','--format=custom','sfa'],stdout=f,check=True)
    subprocess.run(['tar','-czf',str(folder/'uploads.tar.gz'),'-C','/var/lib/sfa','uploads'],check=True)
    subprocess.run(['tar','-czf',str(folder/'config.tar.gz'),'-C','/etc','sfa'],check=True)
PY
tar -czf "/var/backups/sfa/sfa-$stamp.tar.gz" -C "$tmp" .
# GNU find restricted to our own backup names; do not touch other backups.
python3 - <<'PY'
from pathlib import Path
import time
for p in Path('/var/backups/sfa').glob('sfa-*.tar.gz'):
    if p.stat().st_mtime<time.time()-14*86400: p.unlink()
PY
echo "Backup complete: /var/backups/sfa/sfa-$stamp.tar.gz (root-only; contains credentials)"
