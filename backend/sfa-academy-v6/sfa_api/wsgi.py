from .app import create_app
try:
    app=create_app()
except Exception:
    raise RuntimeError('SFA_API_STARTUP_FAILED: check database/configuration') from None
