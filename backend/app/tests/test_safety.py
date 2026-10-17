"""Safety scoring: deterministic, explainable, and never accusatory."""

from __future__ import annotations

USER = "usr_001"


def test_safety_payload_shape(client):
    body = client.get("/api/safety/alerts", params={"user_id": USER}).json()
    assert body["user_id"] == USER
    assert len(body["rules"]) == 4
    assert {r["code"] for r in body["rules"]} == {"flagged", "large-amount", "burst", "unusual-hour"}
    assert len(body["checklist"]) >= 6
    summary = body["summary"]
    assert summary["total"] == len(body["alerts"])
    assert summary["high"] + summary["medium"] + summary["low"] == summary["total"]
    assert summary["disclaimer"]


def test_flagged_demo_transaction_is_the_top_alert(client):
    body = client.get("/api/safety/alerts", params={"user_id": USER}).json()
    alerts = body["alerts"]
    assert alerts, "the seeded burst cluster must raise at least one alert"
    top = alerts[0]
    assert top["transaction_id"] == "txn_010"
    assert top["severity"] == "high"
    assert top["score"] >= 60
    codes = {t["code"] for t in top["triggers"]}
    assert {"flagged", "burst"} <= codes

    normal = client.get("/api/transactions/txn_001").json()
    assert normal["merchant"] == "Chai Point"
    assert normal["transaction_id"] not in {a["transaction_id"] for a in alerts}


def test_scoring_is_deterministic(client):
    first = client.get("/api/safety/alerts").json()["alerts"]
    second = client.get("/api/safety/alerts").json()["alerts"]
    assert first == second


def test_every_alert_explains_itself_with_the_transparent_rules(client):
    for alert in client.get("/api/safety/alerts").json()["alerts"]:
        assert alert["headline"] and alert["recommendation"] and alert["simple_description"]
        assert alert["severity_label"]
        assert alert["triggers"], "an alert without a trigger could not be explained"
        for trigger in alert["triggers"]:
            assert trigger["code"] in ("flagged", "large-amount", "burst", "unusual-hour")
            assert trigger["weight"] > 0
            assert trigger["explanation"]


def test_language_never_concludes_fraud(client):
    text = client.get("/api/safety/alerts").text.lower()
    for banned in ("this is fraud", "stolen money", "confirmed fraud:"):
        assert banned not in text
    # "confirmed fraud" may only appear inside the disclaimer that denies it
    assert text.count("confirmed fraud") <= 1
    assert "never a claim that a payment is confirmed fraud" in text
    assert "not a production fraud-detection model" in text
    assert "simulated data" in text
