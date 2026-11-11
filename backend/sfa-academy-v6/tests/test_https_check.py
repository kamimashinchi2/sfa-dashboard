import subprocess
import sys
from pathlib import Path

from tools.https_check import health_ok, home_ok

ROOT = Path(__file__).parents[1]
HOST = "92-5-230-55.sslip.io"


def test_health_requires_exact_200():
    assert health_ok("200")
    assert not health_ok("307")
    assert not health_ok("201")
    assert not health_ok("000")


def test_home_accepts_final_page_after_same_host_https_redirect():
    assert home_ok("200", f"https://{HOST}/", HOST)
    assert home_ok("200", f"https://{HOST}/academy", HOST)
    assert home_ok("204", f"https://{HOST}/academy", HOST)
    assert home_ok("200", f"https://{HOST.upper()}/academy", HOST)


def test_home_rejects_redirect_status_other_host_and_plain_http():
    assert not home_ok("307", f"https://{HOST}/academy", HOST)
    assert not home_ok("301", f"https://{HOST}/", HOST)
    assert not home_ok("200", f"http://{HOST}/academy", HOST)
    assert not home_ok("200", "https://evil.example/academy", HOST)
    assert not home_ok("200", f"https://{HOST}.evil.example/", HOST)
    # Credentials in the URL must not change which host we accept.
    assert home_ok("200", f"https://user:secret@{HOST}/academy", HOST)
    assert not home_ok("200", "https://127.0.0.1/", HOST)
    assert not home_ok("", f"https://{HOST}/", HOST)


def test_installer_cli_matches_the_shell_probe():
    script = ROOT / "tools" / "https_check.py"
    ok = subprocess.run([sys.executable, str(script), "home", "200", f"https://{HOST}/academy", HOST], capture_output=True)
    bad = subprocess.run([sys.executable, str(script), "home", "307", f"https://{HOST}/", HOST], capture_output=True)
    health = subprocess.run([sys.executable, str(script), "health", "200"], capture_output=True)
    redirected = subprocess.run([sys.executable, str(script), "health", "307"], capture_output=True)
    assert ok.returncode == 0
    assert bad.returncode == 1
    assert health.returncode == 0
    assert redirected.returncode == 1
