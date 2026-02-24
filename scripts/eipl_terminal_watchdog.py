"""
EIPL Predictive Watchdog for LPG terminal operations.

Capabilities:
- Fetch live terminal data from SQL tables via SQLAlchemy.
- Build terminal snapshot with wait-time intelligence.
- Predict Horton Sphere bottleneck risk (time to tank-top).
- Deduplicate alerts for 30 minutes to avoid alert fatigue.
- Push high-signal webhook payloads to the Buddy/chatbot API.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy import DateTime, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
LOGGER = logging.getLogger("eipl-predictive-watchdog")


class Base(DeclarativeBase):
    pass


class TerminalOps(Base):
    __tablename__ = "terminal_ops"

    bay_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    current_truck_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    lpg_inventory_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gate_entry_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class SafetyIncident(Base):
    __tablename__ = "safety_incidents"

    incident_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    severity: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    resolved_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


class TruckCompliance(Base):
    __tablename__ = "truck_compliance"

    truck_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    peso_expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    spark_arrestor_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def wait_time_minutes(gate_entry_time: Optional[datetime], now: Optional[datetime] = None) -> Optional[int]:
    if gate_entry_time is None:
        return None
    now = now or now_utc()
    if gate_entry_time.tzinfo is None:
        gate_entry_time = gate_entry_time.replace(tzinfo=timezone.utc)
    delta_seconds = (now - gate_entry_time).total_seconds()
    if delta_seconds < 0:
        return 0
    return int(delta_seconds // 60)


def normalize_lpg_percent(raw_level: Optional[int], sphere_capacity_kl: float) -> float:
    if raw_level is None:
        return 0.0
    if raw_level <= 100:
        return float(raw_level)
    if sphere_capacity_kl <= 0:
        return 0.0
    return min(100.0, (float(raw_level) / sphere_capacity_kl) * 100.0)


def compute_discharge_rate_tph(ops_rows: List[TerminalOps], fallback_rate: float) -> float:
    moving_statuses = {"DISCHARGING", "DECANTING", "LOADING", "ACTIVE"}
    active = sum(1 for row in ops_rows if str(row.status or "").upper() in moving_statuses)
    if active == 0:
        return max(0.0, fallback_rate)
    # Simple operational estimate: 1 active discharge path ~= 6 TPH.
    return max(fallback_rate, float(active) * 6.0)


def get_terminal_snapshot(
    session: Session,
    *,
    horton_sphere_capacity_kl: float,
    fallback_discharge_rate_tph: float,
    inbound_truck_count: int,
) -> Dict[str, Any]:
    now = now_utc()
    compliance_rows = session.execute(select(TruckCompliance)).scalars().all()
    compliance_by_truck = {row.truck_id: row for row in compliance_rows}

    ops_rows = session.execute(select(TerminalOps)).scalars().all()
    bays: List[Dict[str, Any]] = []
    overdue_waits: List[Dict[str, Any]] = []
    lpg_levels: List[int] = []

    for row in ops_rows:
        truck_id = row.current_truck_id
        compliance = compliance_by_truck.get(truck_id) if truck_id else None
        wait_minutes = wait_time_minutes(row.gate_entry_time, now)
        if row.lpg_inventory_level is not None:
            lpg_levels.append(int(row.lpg_inventory_level))

        bay = {
            "bay_id": row.bay_id,
            "status": row.status,
            "current_truck_id": truck_id,
            "lpg_inventory_level": row.lpg_inventory_level,
            "gate_entry_time": to_iso(row.gate_entry_time),
            "wait_time_minutes": wait_minutes,
            "truck_compliance": {
                "truck_id": compliance.truck_id if compliance else truck_id,
                "peso_expiry_date": to_iso(compliance.peso_expiry_date) if compliance else None,
                "spark_arrestor_status": compliance.spark_arrestor_status if compliance else None,
            } if truck_id else None,
        }
        bays.append(bay)

        if truck_id and wait_minutes is not None and wait_minutes > 45:
            overdue_waits.append(
                {
                    "truck_id": truck_id,
                    "bay_id": row.bay_id,
                    "wait_time_minutes": wait_minutes,
                    "gate_entry_time": to_iso(row.gate_entry_time),
                    "status": row.status,
                }
            )

    raw_lpg_level = max(lpg_levels) if lpg_levels else 0
    lpg_level_percent = normalize_lpg_percent(raw_lpg_level, horton_sphere_capacity_kl)
    truck_discharge_rate_tph = compute_discharge_rate_tph(ops_rows, fallback_discharge_rate_tph)

    incident_rows = session.execute(select(SafetyIncident)).scalars().all()
    incidents = [
        {
            "incident_id": row.incident_id,
            "severity": row.severity,
            "description": row.description,
            "resolved_status": row.resolved_status,
        }
        for row in incident_rows
    ]
    open_incidents = [
        i
        for i in incidents
        if str(i.get("resolved_status", "")).strip().lower() not in {"resolved", "closed", "true", "1"}
    ]

    return {
        "generated_at": now.isoformat(),
        "terminal_ops": bays,
        "safety_incidents": incidents,
        "open_safety_incidents": open_incidents,
        "overdue_waits": overdue_waits,
        "inventory": {
            "lpg_level_percent": round(lpg_level_percent, 2),
            "raw_lpg_level": raw_lpg_level,
            "horton_sphere_capacity_kl": horton_sphere_capacity_kl,
            "inbound_truck_count": inbound_truck_count,
            "truck_discharge_rate_tph": round(truck_discharge_rate_tph, 2),
        },
    }


def predict_bottleneck(
    snapshot: Dict[str, Any],
    *,
    discharge_threshold_tph: float,
    avg_inbound_truck_rate_tph: float,
) -> Optional[Dict[str, Any]]:
    inventory = snapshot.get("inventory", {})
    lpg_percent = float(inventory.get("lpg_level_percent") or 0.0)
    discharge_rate = float(inventory.get("truck_discharge_rate_tph") or 0.0)
    inbound_truck_count = int(inventory.get("inbound_truck_count") or 0)

    if lpg_percent <= 85.0 or discharge_rate >= discharge_threshold_tph:
        return None

    inbound_fill_rate_tph = max(0.0, inbound_truck_count * avg_inbound_truck_rate_tph)
    net_rise_tph = inbound_fill_rate_tph - discharge_rate
    if net_rise_tph <= 0:
        return None

    capacity_kl = float(inventory.get("horton_sphere_capacity_kl") or 10000.0)
    current_kl = (lpg_percent / 100.0) * capacity_kl
    remaining_kl = max(0.0, capacity_kl - current_kl)
    if remaining_kl <= 0:
        hours_to_tank_top = 0.0
    else:
        hours_to_tank_top = remaining_kl / net_rise_tph

    if hours_to_tank_top <= 2:
        priority = "Critical"
    elif hours_to_tank_top <= 6:
        priority = "Warning"
    else:
        priority = "Info"

    headline = f"Inventory Alert: {max(hours_to_tank_top, 0.0):.1f}h to Tank Top"
    insight = (
        f"Horton Spheres at {lpg_percent:.1f}% and rising; discharge is {discharge_rate:.1f} TPH "
        f"for {inbound_truck_count} inbound truck(s). Increase decanting throughput to prevent gantry choke."
    )

    return {
        "event_type": "inventory_forecast",
        "alert_id": "inventory-tank-top-forecast",
        "priority": priority,
        "headline": headline,
        "insight": insight,
        "action": {
            "label": "Increase Discharge Rate",
            "url": "/terminal/controls/pumps",
        },
        "data": {
            "lpg_level_percent": round(lpg_percent, 2),
            "truck_discharge_rate_tph": round(discharge_rate, 2),
            "inbound_truck_count": inbound_truck_count,
            "time_to_tank_top_hours": round(hours_to_tank_top, 2),
            "discharge_threshold_tph": discharge_threshold_tph,
        },
    }


@dataclass
class DedupStore:
    ttl_seconds: int
    local: Dict[str, datetime] = field(default_factory=dict)
    redis_client: Any = None
    redis_prefix: str = "eipl:watchdog:alert:"

    def should_send(self, alert_id: str, now: datetime) -> bool:
        self._cleanup_local(now)

        if self.redis_client is not None:
            key = f"{self.redis_prefix}{alert_id}"
            set_ok = self.redis_client.set(name=key, value=now.isoformat(), nx=True, ex=self.ttl_seconds)
            return bool(set_ok)

        existing = self.local.get(alert_id)
        if existing and (now - existing).total_seconds() < self.ttl_seconds:
            return False
        self.local[alert_id] = now
        return True

    def _cleanup_local(self, now: datetime) -> None:
        expired = [
            key for key, ts in self.local.items()
            if (now - ts).total_seconds() >= self.ttl_seconds
        ]
        for key in expired:
            self.local.pop(key, None)


@dataclass
class WatchdogState:
    known_incident_ids: set[str]
    dedup: DedupStore


def create_dedup_store(ttl_seconds: int, redis_url: Optional[str]) -> DedupStore:
    if redis_url and redis is not None:
        try:
            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            LOGGER.info("Alert deduplication is using Redis.")
            return DedupStore(ttl_seconds=ttl_seconds, redis_client=client)
        except Exception:
            LOGGER.exception("Redis unavailable; using in-process deduplication.")
    return DedupStore(ttl_seconds=ttl_seconds)


def send_webhook(endpoint: str, payload: Dict[str, Any], timeout_seconds: int = 8) -> None:
    headers = {"Content-Type": "application/json"}
    response = requests.post(endpoint, data=json.dumps(payload), headers=headers, timeout=timeout_seconds)
    response.raise_for_status()


def build_buddy_payload(
    *,
    event_type: str,
    alert_id: str,
    priority: str,
    headline: str,
    insight: str,
    action: Dict[str, str],
    data: Any,
) -> Dict[str, Any]:
    return {
        "event_type": event_type,
        "alert_id": alert_id,
        "priority": priority,
        "headline": headline,
        "insight": insight,
        "action": action,
        "data": data,
        "triggered_at": now_utc().isoformat(),
    }


def incident_priority(incident: Dict[str, Any]) -> str:
    sev = str(incident.get("severity") or "").upper()
    if sev in {"HIGH", "CRITICAL"}:
        return "Critical"
    if sev in {"MED", "WARNING"}:
        return "Warning"
    return "Info"


def wait_priority(wait_minutes: int) -> str:
    if wait_minutes >= 90:
        return "Critical"
    if wait_minutes >= 60:
        return "Warning"
    return "Info"


def monitor_and_trigger(
    db_url: str,
    chatbot_webhook_url: str,
    poll_seconds: int = 60,
) -> None:
    engine = create_engine(db_url, future=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    redis_url = os.getenv("WATCHDOG_REDIS_URL", "").strip() or None
    dedup_minutes = int(os.getenv("WATCHDOG_ALERT_DEDUP_MINUTES", "30"))
    dedup_store = create_dedup_store(ttl_seconds=dedup_minutes * 60, redis_url=redis_url)

    horton_capacity_kl = float(os.getenv("HORTON_SPHERE_CAPACITY_KL", "10000"))
    fallback_discharge_rate_tph = float(os.getenv("FALLBACK_TRUCK_DISCHARGE_RATE_TPH", "6"))
    discharge_threshold_tph = float(os.getenv("TRUCK_DISCHARGE_RATE_THRESHOLD_TPH", "12"))
    avg_inbound_truck_rate_tph = float(os.getenv("AVG_INBOUND_TRUCK_RATE_TPH", "1.25"))
    inbound_truck_count = int(os.getenv("INBOUND_TRUCK_COUNT", "10"))

    with session_factory() as session:
        baseline_ids = session.execute(select(SafetyIncident.incident_id)).scalars().all()
        state = WatchdogState(known_incident_ids=set(baseline_ids), dedup=dedup_store)

    LOGGER.info(
        "Predictive Watchdog started (poll=%ss, dedup=%sm)",
        poll_seconds,
        dedup_minutes,
    )

    while True:
        try:
            with session_factory() as session:
                snapshot = get_terminal_snapshot(
                    session,
                    horton_sphere_capacity_kl=horton_capacity_kl,
                    fallback_discharge_rate_tph=fallback_discharge_rate_tph,
                    inbound_truck_count=inbound_truck_count,
                )

            now = now_utc()
            incidents = snapshot.get("safety_incidents", [])
            incident_by_id = {str(i["incident_id"]): i for i in incidents if i.get("incident_id")}
            current_ids = set(incident_by_id.keys())
            new_ids = sorted(current_ids - state.known_incident_ids)
            state.known_incident_ids = current_ids

            for incident_id in new_ids:
                incident = incident_by_id[incident_id]
                payload = build_buddy_payload(
                    event_type="new_safety_incident",
                    alert_id=f"incident-{incident_id}",
                    priority=incident_priority(incident),
                    headline=f"Safety Incident Raised: {incident_id}",
                    insight=(incident.get("description") or "New safety incident requires immediate review."),
                    action={"label": "Open Incident", "url": f"/hse/incidents/{incident_id}"},
                    data=incident,
                )
                if state.dedup.should_send(payload["alert_id"], now):
                    send_webhook(chatbot_webhook_url, payload)
                    LOGGER.warning("Alert sent: %s", payload["alert_id"])

            for wait_record in snapshot.get("overdue_waits", []):
                truck_id = str(wait_record.get("truck_id") or "").strip()
                if not truck_id:
                    continue
                wait_minutes = int(wait_record.get("wait_time_minutes") or 0)
                payload = build_buddy_payload(
                    event_type="wait_time_exceeded",
                    alert_id=f"truck-wait-{truck_id}",
                    priority=wait_priority(wait_minutes),
                    headline=f"Queue Delay: Truck {truck_id} waiting {wait_minutes} minutes",
                    insight=(
                        f"Truck {truck_id} crossed the 45-minute wait threshold at Bay {wait_record.get('bay_id')}. "
                        "Re-sequence gantry allocation to prevent dispatch slippage."
                    ),
                    action={"label": "Open Controller Console", "url": "/controller/console"},
                    data=wait_record,
                )
                if state.dedup.should_send(payload["alert_id"], now):
                    send_webhook(chatbot_webhook_url, payload)
                    LOGGER.warning("Alert sent: %s", payload["alert_id"])

            forecast = predict_bottleneck(
                snapshot,
                discharge_threshold_tph=discharge_threshold_tph,
                avg_inbound_truck_rate_tph=avg_inbound_truck_rate_tph,
            )
            if forecast and state.dedup.should_send(forecast["alert_id"], now):
                payload = build_buddy_payload(
                    event_type=forecast["event_type"],
                    alert_id=forecast["alert_id"],
                    priority=forecast["priority"],
                    headline=forecast["headline"],
                    insight=forecast["insight"],
                    action=forecast["action"],
                    data=forecast["data"],
                )
                send_webhook(chatbot_webhook_url, payload)
                LOGGER.warning("Alert sent: %s", payload["alert_id"])

        except Exception:
            LOGGER.exception("Watchdog cycle failed")

        time.sleep(poll_seconds)


if __name__ == "__main__":
    db_url = os.getenv("TERMINAL_DB_URL", "").strip()
    webhook_url = os.getenv("CHATBOT_WEBHOOK_URL", "").strip()
    poll_seconds = int(os.getenv("WATCHDOG_POLL_SECONDS", "60"))

    if not db_url:
        raise SystemExit("Missing TERMINAL_DB_URL environment variable.")
    if not webhook_url:
        raise SystemExit("Missing CHATBOT_WEBHOOK_URL environment variable.")

    LOGGER.info("Booting EIPL Predictive Watchdog...")
    monitor_and_trigger(db_url=db_url, chatbot_webhook_url=webhook_url, poll_seconds=poll_seconds)
