"""HTTPS probe rules for install.sh. Health must be exactly 200 with no redirect.
The site root may redirect, for example / to /academy, but the final response
must be 2xx on the same host over https.
"""
import sys
from urllib.parse import urlparse


def health_ok(code):
    return code == "200"


def home_ok(code, final_url, host):
    if not isinstance(code, str) or len(code) != 3 or not code.isdigit() or not code.startswith("2"):
        return False
    if not isinstance(final_url, str) or not isinstance(host, str):
        return False
    expected = host.strip().rstrip(".").lower()
    if not expected or any(c in expected for c in "/?#@"):
        return False
    parsed = urlparse(final_url.strip())
    hostname = (parsed.hostname or "").rstrip(".").lower()
    return parsed.scheme == "https" and hostname == expected


def main(argv):
    if len(argv) == 2 and argv[0] == "health":
        return 0 if health_ok(argv[1]) else 1
    if len(argv) == 4 and argv[0] == "home":
        return 0 if home_ok(argv[1], argv[2], argv[3]) else 1
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
