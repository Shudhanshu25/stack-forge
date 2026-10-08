"""A minimal client for the Stack Forge REST API (used by the performance evaluation and the demo).

The base URL is the API as the browser sees it: http://localhost:4000/api/v1 in development, or
https://<site>/api/v1 behind the production proxy.

New accounts must confirm their email before starting simulations. In development the API
writes emails to an outbox folder (EMAIL_PROVIDER=outbox, backend/.outbox by default), and the
client confirms new accounts from there; set STACKFORGE_OUTBOX if the folder is elsewhere.
"""

import os
import re
import secrets
import time
from pathlib import Path

import httpx

DEFAULT_OUTBOX = Path(__file__).resolve().parents[1] / "backend" / ".outbox"
VERIFY_LINK = re.compile(r"/verify-email\?token=([A-Za-z0-9_-]+)")


class ApiError(RuntimeError):
    def __init__(self, status: int, body: dict | str) -> None:
        error = body.get("error", {}) if isinstance(body, dict) else {}
        self.status = status
        self.code = error.get("code", "HTTP_ERROR")
        super().__init__(f"{status} {self.code}: {error.get('message', body)}")


class StackForgeApi:
    def __init__(self, base_url: str, *, verify: bool = True, timeout: float = 60.0) -> None:
        self.http = httpx.Client(base_url=base_url.rstrip("/"), verify=verify, timeout=timeout)
        self.token: str | None = None

    def close(self) -> None:
        self.http.close()

    def request(self, method: str, path: str, body: dict | None = None) -> dict:
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        response = self.http.request(method, path, json=body, headers=headers)
        if response.status_code >= 400:
            try:
                raise ApiError(response.status_code, response.json())
            except ValueError:
                raise ApiError(response.status_code, response.text) from None
        return response.json() if response.content else {}

    def sign_in(self, email: str, password: str, name: str) -> dict:
        """Logs in, registering the account first if it does not exist yet."""
        try:
            auth = self.request("POST", "/auth/login", {"email": email, "password": password})
        except ApiError as exc:
            if exc.status != 401:
                raise
            auth = self.request(
                "POST", "/auth/register", {"email": email, "password": password, "name": name}
            )
        self.token = auth["accessToken"]
        user = auth["user"]
        if not user.get("emailVerified", True):
            user = self.verify_from_outbox(email)
        return user

    def verify_from_outbox(self, email: str, wait_s: float = 10) -> dict:
        """Confirms the account with the newest verification link in the development outbox."""
        outbox = Path(os.environ.get("STACKFORGE_OUTBOX", DEFAULT_OUTBOX))
        deadline = time.monotonic() + wait_s
        while time.monotonic() < deadline:
            mails = sorted(outbox.glob(f"*-{email}.html")) if outbox.is_dir() else []
            for mail in reversed(mails):
                match = VERIFY_LINK.search(mail.read_text(encoding="utf-8"))
                if match:
                    return self.request("POST", "/auth/verify-email", {"token": match.group(1)})
            time.sleep(0.2)
        raise RuntimeError(
            f"{email} must confirm its email before starting simulations, and no verification "
            f"email was found in {outbox}. Run the API with EMAIL_PROVIDER=outbox (the development "
            "default) or set STACKFORGE_OUTBOX."
        )

    def throwaway_user(self, prefix: str) -> dict:
        """A fresh account with a random password that is never printed or stored."""
        email = f"{prefix}-{secrets.token_hex(4)}@example.com"
        return self.sign_in(email, secrets.token_urlsafe(18) + "Aa1!", "Evaluation")

    def play_turn(self, simulation_id: str, decisions: list[dict], wait_s: float = 180) -> dict:
        """Submits a turn and waits for its job; returns the finished job."""
        job = self.request("POST", f"/simulations/{simulation_id}/turns", {"decisions": decisions})
        job_id = job["jobId"]
        deadline = time.monotonic() + wait_s
        while time.monotonic() < deadline:
            job = self.request("GET", f"/jobs/{job_id}")
            if job["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
                return job
            time.sleep(0.2)
        raise TimeoutError(f"turn job did not finish within {wait_s}s")
