"""Execute real entry points. Parser bugs must fail here, not on the server."""
import importlib.util
import json
import os
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


def test_sfa_help_does_not_read_server_config():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    for key in ("DATABASE_URL", "SFA_BRIDGE_SECRET", "ECHO_API_KEY_HASH", "SFA_SITE_ORIGIN", "SFA_ENV"):
        env.pop(key, None)
    result = subprocess.run([PY, "-m", "sfa_api.cli", "--help"], cwd=ROOT, capture_output=True, text=True, env=env)
    assert result.returncode == 0
    assert "migrate" in result.stdout
    source = (ROOT / "sfa_api" / "cli.py").read_text()
    assert source.index("parse_args()") < source.index("Config.env()")


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
