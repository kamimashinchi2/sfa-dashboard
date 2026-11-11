"""Execute real entry points. Parser bugs must fail here, not on the server."""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
PY = sys.executable


def load_configure():
    path = ROOT / "tools" / "configure.py"
    spec = importlib.util.spec_from_file_location("sfa_configure", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run(args, cwd=None):
    return subprocess.run(
        args,
        cwd=cwd or ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
    )


def test_configure_parser_matches_install_sh_calls():
    mod = load_configure()
    parser = mod.build_parser()
    shapes = {
        ("discover",): None,
        ("discover", ""): "",
        ("discover", "/srv/sfa-dashboard"): "/srv/sfa-dashboard",
        ("get", "app"): "app",
        ("get", "user"): "user",
        ("get", "path"): "path",
        ("configure", "92-5-230-55.sslip.io"): "92-5-230-55.sslip.io",
        ("pm2", "stop-legacy"): "stop-legacy",
        ("pm2", "restart"): "restart",
    }
    for argv, value in shapes.items():
        ns = parser.parse_args(list(argv))
        assert ns.action == argv[0]
        assert ns.value == value
        if ns.action == "discover":
            assert (ns.value or None) == (value or None)


def test_configure_help_and_invocations_do_not_crash_in_argparse():
    script = ROOT / "tools" / "configure.py"
    help_run = run([PY, str(script), "--help"])
    assert help_run.returncode == 0
    assert "discover" in help_run.stdout and "configure" in help_run.stdout
    # Same argv shapes install.sh uses. No /etc/sfa state here, so the helper
    # fails after parsing; it must not raise "invalid nargs".
    calls = [
        ["discover", ""],
        ["discover"],
        ["get", "app"],
        ["get", "user"],
        ["get", "path"],
        ["configure", "92-5-230-55.sslip.io"],
        ["pm2", "stop-legacy"],
        ["pm2", "restart"],
    ]
    for args in calls:
        result = run([PY, str(script), *args])
        assert result.returncode == 1, result.stderr
        assert "invalid nargs" not in result.stderr
        assert "Traceback" not in result.stderr
        assert f"Install helper failed ({args[0]})" in result.stderr


def test_install_sh_helper_lines_are_the_shapes_we_execute():
    text = (ROOT / "install.sh").read_text()
    for snippet in (
        'discover "$APP_DIR"',
        "get app",
        "get user",
        "get path",
        'configure "$DOMAIN"',
        "pm2 stop-legacy",
        "pm2 restart",
    ):
        assert snippet in text


def test_sfa_cli_help_for_every_command():
    commands = [
        [],
        ["migrate"],
        ["status"],
        ["backup-now"],
        ["show-echo-key"],
        ["invite"],
        ["make-admin"],
        ["reset-password"],
        ["override"],
        ["import-legacy"],
        ["adopt-legacy"],
    ]
    top = run([PY, "-m", "sfa_api.cli", "--help"])
    assert top.returncode == 0
    assert "invite" in top.stdout and "adopt-legacy" in top.stdout
    missing = run([PY, "-m", "sfa_api.cli"])
    assert missing.returncode == 2
    for cmd in commands[1:]:
        result = run([PY, "-m", "sfa_api.cli", *cmd, "--help"])
        assert result.returncode == 0, (cmd, result.stderr)
        assert "Traceback" not in result.stderr


def test_echo_client_help_and_missing_key_is_a_clean_error():
    script = ROOT / "echo_client.py"
    top = run([PY, str(script), "--help"])
    assert top.returncode == 0
    for cmd in (["queue"], ["report"], ["fetch"], ["claim"], ["submit"]):
        result = run([PY, str(script), *cmd, "--help"])
        assert result.returncode == 0, (cmd, result.stderr)
    bare = run([PY, str(script)])
    assert bare.returncode == 2
    queued = run([PY, str(script), "queue"])
    assert queued.returncode == 1
    assert "Echo client failed:" in queued.stderr
    assert "Traceback" not in queued.stderr


def test_generate_contract_runs_without_rewriting_the_contract():
    path = ROOT / "api-contract.md"
    before = path.read_text()
    result = run([PY, str(ROOT / "tools" / "generate_contract.py")])
    assert result.returncode == 0, result.stderr
    assert "Traceback" not in result.stderr
    assert path.read_text() == before


def test_bot_and_wsgi_missing_config_are_clean_startup_errors():
    bot = run([PY, "-m", "sfa_api.bot"])
    assert bot.returncode == 1
    assert "SFA_BOT_STARTUP_FAILED" in bot.stderr
    assert "Traceback" not in bot.stderr
    wsgi = run([PY, "-c", "import sfa_api.wsgi"])
    assert wsgi.returncode != 0
    assert "SFA_API_STARTUP_FAILED" in wsgi.stderr
    imported = run([PY, "-c", "from sfa_api.app import create_app; print('import-ok')"])
    assert imported.returncode == 0
    assert "import-ok" in imported.stdout


def test_install_preflight_old_node_is_not_silent(tmp_path):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    node = bindir / "node"
    node.write_text("#!/bin/sh\nif [ \"$1\" = \"-p\" ]; then echo 18.19.1; exit 0; fi\nexit 1\n")
    node.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = f"{bindir}{os.pathsep}{env.get('PATH', '')}"
    env["SFA_INSTALL_TEST_PREFLIGHT"] = "1"
    env["SFA_TEST_PM2_USER"] = "pm2owner"
    env["SFA_TEST_PM2_PATH"] = str(bindir)
    result = subprocess.run(
        ["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io", "--no-rebuild-next"],
        capture_output=True,
        text=True,
        env=env,
    )
    text = result.stdout + result.stderr
    assert result.returncode != 0
    assert text.strip()
    assert "18.19.1" in text
    assert "22.6" in text
    assert "pm2owner" in text
    assert str(bindir) in text
    assert "nvm install 22" in text


def test_install_preflight_missing_node_and_new_enough_node(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    env = os.environ.copy()
    env["PATH"] = str(empty)
    env["SFA_INSTALL_TEST_PREFLIGHT"] = "1"
    env["SFA_TEST_PM2_USER"] = "pm2owner"
    env["SFA_TEST_PM2_PATH"] = str(empty)
    missing = subprocess.run(
        ["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert missing.returncode != 0
    assert "not found" in (missing.stdout + missing.stderr).lower()
    bindir = tmp_path / "bin"
    bindir.mkdir()
    node = bindir / "node"
    node.write_text("#!/bin/sh\nif [ \"$1\" = \"-p\" ]; then echo 22.14.0; exit 0; fi\nexit 0\n")
    node.chmod(0o755)
    env["PATH"] = str(bindir)
    env["SFA_TEST_PM2_PATH"] = str(bindir)
    ok = subprocess.run(
        ["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io", "--verbose"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert ok.returncode == 0, ok.stderr
    combined = ok.stdout + ok.stderr
    assert "Node 22.14.0" in combined
    # --verbose must not leak xtrace onto the terminal during this early exit,
    # and must not print set -x lines for the preflight itself.
    assert "\n+" not in combined and not combined.startswith("+")


def test_opt_sfa_permissions_are_traversable(tmp_path):
    root = tmp_path / "opt-sfa"
    wrapper = tmp_path / "sfa"
    env = os.environ.copy()
    env["SFA_INSTALL_TEST_PERMS"] = "1"
    env["SFA_TEST_OPT"] = str(root)
    env["SFA_TEST_WRAPPER"] = str(wrapper)
    result = subprocess.run(
        ["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    modes = {}
    for line in result.stdout.splitlines():
        mode, path = line.split(" ", 1)
        modes[path] = mode
    assert modes[str(root)] == "755"
    assert modes[str(root / ".venv")] == "755"
    assert modes[str(root / ".venv" / "bin")] == "755"
    assert modes[str(root / ".venv" / "bin" / "gunicorn")] == "755"
    assert modes[str(root / "plain.py")] == "644"
    assert modes[str(wrapper)] == "755"
    secret = tmp_path / "secret"
    secret.write_text("x")
    secret.chmod(0o600)
    assert oct(secret.stat().st_mode & 0o777) == "0o600"


def test_pm2_env_file_is_private_and_reachable(tmp_path):
    mod = load_configure()
    state = {"user": "app", "uid": os.getuid(), "gid": os.getgid(), "home": str(tmp_path), "path": "/usr/bin", "app": str(tmp_path), "pm2": "/usr/bin/pm2"}
    path = mod.write_pm2_env_file(state, {"SFA_BRIDGE_URL": "http://127.0.0.1:8081", "SFA_SITE_ORIGIN": "https://example.test", "SFA_BRIDGE_SECRET": "s" * 40, "SFA_ALLOW_INSECURE_PILOT": "0", "SFA_ALLOW_CONTENT_BYPASS": "0"})
    assert (path.stat().st_mode & 0o777) == 0o600
    assert (path.parent.stat().st_mode & 0o777) == 0o700


def test_echo_key_is_created_once_and_kept(tmp_path):
    mod = load_configure()
    first = mod.ensure_echo_key(tmp_path, chown_root=False)
    path = tmp_path / "echo-api-key"
    assert path.is_file() and path.read_text().strip() == first
    assert path.stat().st_mode & 0o777 == 0o600
    path.write_text(first + "\n")
    second = mod.ensure_echo_key(tmp_path, chown_root=False)
    assert second == first
    assert not (tmp_path / "echo-api-key.new").exists()


def test_pm2_env_does_not_leak_root_environment(tmp_path):
    mod = load_configure()
    state = {"user": "app", "uid": 1000, "gid": 1000, "home": str(tmp_path), "path": "/usr/bin:/bin", "app": "/srv/app", "pm2": "/usr/bin/pm2"}
    secret = "s" * 48
    proc = mod.pm2_process_env(state, {"SFA_BRIDGE_SECRET": secret, "SFA_SITE_ORIGIN": "https://92-5-230-55.sslip.io", "AWS_SECRET_ACCESS_KEY": "should-not-copy"})
    assert "AWS_SECRET_ACCESS_KEY" not in proc
    assert set(proc) == {"HOME", "USER", "LOGNAME", "PATH", "PM2_HOME", "SFA_BRIDGE_URL", "SFA_SITE_ORIGIN", "SFA_BRIDGE_SECRET", "SFA_ALLOW_INSECURE_PILOT", "SFA_ALLOW_CONTENT_BYPASS"}
    argv = mod.runuser_argv(state, tmp_path / "pm2.env", ["restart", "sfa-dashboard", "--update-env"])
    joined = " ".join(argv)
    assert "--preserve-environment" not in joined
    assert secret not in joined
    assert "AWS_SECRET_ACCESS_KEY" not in joined
    assert state["app"] in argv
    stale = tmp_path / "old" / "pm2"
    fresh = tmp_path / "usr" / "bin" / "pm2"
    fresh.parent.mkdir(parents=True)
    fresh.write_text("#!/bin/sh\n")
    bins = mod.pm2_candidates(tmp_path, str(fresh), "")
    chosen = mod.choose_pm2(bins, {str(fresh): "22.14.0", str(stale): "18.19.1"})
    assert chosen == fresh


def test_proxy_autodetect(tmp_path):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    systemctl = bindir / "systemctl"
    ss = bindir / "ss"
    def write(path, body):
        path.write_text(body)
        path.chmod(0o755)
    def invoke(active, holds):
        code = "0" if active else "3"
        write(systemctl, "#!/bin/sh\nif [ \"$1\" = is-active ]; then\n  for a in \"$@\"; do [ \"$a\" = nginx ] && exit %s; done\nfi\nexit 3\n" % code)
        if holds:
            write(ss, "#!/bin/sh\necho '0.0.0.0:443 users:((\"nginx\",pid=1,fd=6))'\n")
        else:
            write(ss, "#!/bin/sh\nexit 0\n")
        env = os.environ.copy()
        env["PATH"] = str(bindir) + os.pathsep + "/usr/bin:/bin"
        env["SFA_INSTALL_TEST_PROXY"] = "1"
        return subprocess.run(["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io", "--proxy", "auto"], capture_output=True, text=True, env=env)
    nginx = invoke(True, False)
    assert nginx.returncode == 0 and nginx.stdout.strip() == "nginx"
    held = invoke(False, True)
    assert held.returncode == 0 and held.stdout.strip() == "nginx", held.stderr
    caddy = invoke(False, False)
    assert caddy.returncode == 0 and caddy.stdout.strip() == "caddy"


def test_nginx_site_passes_nginx_t(tmp_path):
    nginx = shutil.which("nginx")
    if not nginx:
        import pytest
        pytest.skip("nginx is not installed")
    cert = tmp_path / "cert"
    cert.mkdir()
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-keyout", str(cert / "privkey.pem"), "-out", str(cert / "fullchain.pem"), "-days", "1", "-nodes", "-subj", "/CN=92-5-230-55.sslip.io"], check=True, capture_output=True)
    env = os.environ.copy()
    env["SFA_INSTALL_RENDER_NGINX"] = "1"
    env["SFA_TEST_CERT_DIR"] = str(cert)
    rendered = subprocess.run(["/bin/bash", str(ROOT / "install.sh"), "--domain", "92-5-230-55.sslip.io"], capture_output=True, text=True, env=env)
    assert rendered.returncode == 0, rendered.stderr
    site = rendered.stdout
    assert "location ^~ /api/v1/" in site and "return 404" in site
    assert "proxy_pass http://127.0.0.1:8081" in site
    assert "proxy_set_header X-SFA-Client-IP $remote_addr" in site
    assert "client_max_body_size 250m" in site
    assert "listen 443 ssl http2;" in site
    site = (
        site.replace("listen 80;", "listen 127.0.0.1:8080;")
        .replace("listen [::]:80;", "listen [::1]:8080;")
        .replace("listen 443 ssl http2;", "listen 127.0.0.1:8443 ssl;")
        .replace("listen [::]:443 ssl http2;", "listen [::1]:8443 ssl;")
    )
    conf = tmp_path / "nginx.conf"
    available = tmp_path / "sites"
    available.mkdir()
    (available / "sfa-academy.conf").write_text(site)
    for name in ("body", "proxy", "fastcgi", "uwsgi", "scgi"):
        (tmp_path / name).mkdir()
    conf.write_text(
        "worker_processes 1;\nerror_log %s/error.log;\npid %s/nginx.pid;\nevents { worker_connections 16; }\n"
            "http {\n  access_log %s/access.log;\n  client_body_temp_path %s/body;\n  proxy_temp_path %s/proxy;\n  fastcgi_temp_path %s/fastcgi;\n"
        "  uwsgi_temp_path %s/uwsgi;\n  scgi_temp_path %s/scgi;\n  include %s/*.conf;\n}\n"
            % (tmp_path, tmp_path, tmp_path, tmp_path, tmp_path, tmp_path, tmp_path, tmp_path, available)
    )
    checked = subprocess.run([nginx, "-t", "-c", str(conf)], capture_output=True, text=True)
    assert checked.returncode == 0, checked.stderr


def test_sfa_missing_config_is_a_clear_message():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    for key in ("DATABASE_URL", "SFA_BRIDGE_SECRET", "ECHO_API_KEY_HASH", "SFA_SITE_ORIGIN", "SFA_ENV"):
        env.pop(key, None)
    result = subprocess.run([PY, "-m", "sfa_api.cli", "status"], cwd=ROOT, capture_output=True, text=True, env=env)
    assert result.returncode != 0
    assert "run install.sh to finish setup (missing /etc/sfa/sfa.env)" in result.stderr
    assert "Traceback" not in result.stderr
    assert "KeyError" not in result.stderr


def test_sfa_help_does_not_read_server_config():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    for key in ("DATABASE_URL", "SFA_BRIDGE_SECRET", "ECHO_API_KEY_HASH", "SFA_SITE_ORIGIN", "SFA_ENV"):
        env.pop(key, None)
    result = subprocess.run([PY, "-m", "sfa_api.cli", "--help"], cwd=ROOT, capture_output=True, text=True, env=env)
    assert result.returncode == 0
    assert "migrate" in result.stdout
    main = (ROOT / "sfa_api" / "cli.py").read_text().split("def main()", 1)[1]
    assert main.index("parse_args()") < main.index("load_config()")


def test_answer_key_extractor_usage_and_repo_smoke():
    script = ROOT / "tools" / "extract_answer_key.mjs"
    missing = subprocess.run(["node", str(script)], capture_output=True, text=True)
    assert missing.returncode == 2
    assert "usage:" in missing.stderr
    repo = ROOT.parents[1]
    extracted = subprocess.run(
        ["node", str(script), str(repo), "c2b8f22"],
        capture_output=True,
        text=True,
    )
    assert extracted.returncode == 0, extracted.stderr
    payload = json.loads(extracted.stdout)
    assert payload["format"] == "sfa-answer-key"
    assert payload["commit"] == "c2b8f22"
    assert set(payload["quizzes"]) == {"M1", "M2", "M3", "M4", "M5", "A6", "A7", "A8"}
