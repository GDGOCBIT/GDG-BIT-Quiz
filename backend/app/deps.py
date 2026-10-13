from fastapi import Header, HTTPException, Request

from .auth import bearer_token, verify_admin_token, verify_participant_token
from .db import Store
from .ws_hub import RoomHub


def get_store(request: Request):
    return request.app.state.store


def get_hub(request: Request):
    return request.app.state.hub


def require_admin(authorization: str | None = Header(default=None)):
    if not verify_admin_token(bearer_token(authorization) or ""):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def current_participant(
    request: Request,
    authorization: str | None = Header(default=None),
):
    token = bearer_token(authorization)
    if not token:
        token = request.query_params.get("token", "")
    claims = verify_participant_token(token or "")
    if not claims:
        raise HTTPException(status_code=401, detail="Not joined")
    store: Store = request.app.state.store
    me = await store.get_participant(claims["pid"])
    if not me or me["quiz_id"] != claims["qid"]:
        raise HTTPException(status_code=401, detail="Not joined")
    return me
