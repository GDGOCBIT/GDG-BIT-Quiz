import time
import uuid

import jwt

from .config import get_settings


def _secret():
    return get_settings().auth_secret


def mint_participant_token(pid: str, qid: str, expires_s: int = 24 * 3600):
    now = int(time.time())
    return jwt.encode(
        {
            "pid": pid,
            "qid": qid,
            "iat": now,
            "exp": now + expires_s,
            "jti": uuid.uuid4().hex,
        },
        _secret(),
        algorithm="HS256",
    )


def verify_participant_token(token: str):
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if not payload.get("pid") or not payload.get("qid"):
        return None
    return {"pid": payload["pid"], "qid": payload["qid"]}


def mint_admin_token(expires_s: int = 12 * 3600):
    now = int(time.time())
    return jwt.encode(
        {"role": "admin", "iat": now, "exp": now + expires_s, "jti": uuid.uuid4().hex},
        _secret(),
        algorithm="HS256",
    )


def verify_admin_token(token: str):
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    return payload.get("role") == "admin"


def bearer_token(auth_header: str | None):
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None
