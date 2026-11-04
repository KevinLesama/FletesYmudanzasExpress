import pytest

from app.core.config import Settings
from app.services import supabase_admin


class FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    @property
    def is_error(self) -> bool:
        return self.status_code >= 400

    def json(self) -> dict:
        return self._payload


def configured_settings() -> Settings:
    # `_env_file=None`: las pruebas no dependen del .env del desarrollador.
    return Settings(
        _env_file=None,
        supabase_url="https://project.supabase.co",
        supabase_anon_key="public-key",
        supabase_service_role_key="server-only-key",
    )


def test_invite_user_uses_service_role_and_returns_auth_id(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_post(url: str, **kwargs: object) -> FakeResponse:
        captured.update(url=url, **kwargs)
        return FakeResponse({"id": "auth-user-id"})

    monkeypatch.setattr(supabase_admin.httpx, "post", fake_post)

    settings = configured_settings()
    user_id = supabase_admin.invite_user("chofer@example.com", settings)

    assert user_id == "auth-user-id"
    assert captured["url"] == "https://project.supabase.co/auth/v1/invite"
    assert captured["json"] == {
        "email": "chofer@example.com",
        "redirect_to": settings.auth_invite_redirect_url,
    }
    assert captured["headers"] == {
        "apikey": "server-only-key",
        "Authorization": "Bearer server-only-key",
        "Content-Type": "application/json",
    }


def test_invite_user_requires_backend_service_role_key() -> None:
    settings = Settings(
        _env_file=None,
        supabase_url="https://project.supabase.co",
        supabase_anon_key="public-key",
    )

    with pytest.raises(supabase_admin.SupabaseAdminError, match="no está configurada"):
        supabase_admin.invite_user("chofer@example.com", settings)
