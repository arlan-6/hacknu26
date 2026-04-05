from fastapi.testclient import TestClient


def test_cors_preflight_allows_local_frontend_origin(client: TestClient) -> None:
    origin = "http://localhost:5175"

    response = client.options(
        "/trains/latest",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "GET" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()