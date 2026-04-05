from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
for origin in ["http://localhost:5175", "http://127.0.0.1:5175", "http://localhost:5173"]:
    r = client.options(
        "/trains/latest",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    print(origin, r.status_code, r.headers.get("access-control-allow-origin"))
