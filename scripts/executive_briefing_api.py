"""
Start-of-Day Executive Briefing synthesis engine for EIPL terminal operations.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import Date, DateTime, Float, Integer, String, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):
    pass


class TerminalBay(Base):
    __tablename__ = "terminal_bays"

    bay_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    active_truck_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class LPGInventory(Base):
    __tablename__ = "lpg_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    horton_sphere_level_percent: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class GateQueue(Base):
    __tablename__ = "gate_queue"

    queue_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    truck_id: Mapped[str] = mapped_column(String(64), nullable=False)
    queue_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    peso_expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class SafetyIncident(Base):
    __tablename__ = "safety_incidents"

    incident_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def get_executive_briefing(db_session: Session) -> Dict[str, Any]:
    latest_inventory = db_session.execute(
        select(LPGInventory).order_by(LPGInventory.recorded_at.desc()).limit(1)
    ).scalar_one_or_none()
    lpg_percent = float(latest_inventory.horton_sphere_level_percent) if latest_inventory else 0.0

    open_incidents = int(
        db_session.execute(
            select(func.count()).select_from(SafetyIncident).where(
                func.coalesce(SafetyIncident.status, "OPEN").not_in(["CLOSED", "RESOLVED"])
            )
        ).scalar_one()
    )

    queue_length = int(
        db_session.execute(select(func.count()).select_from(GateQueue)).scalar_one()
    )

    active_trips = int(
        db_session.execute(
            select(func.count()).select_from(TerminalBay).where(
                func.coalesce(TerminalBay.status, "").in_(["ACTIVE", "DISCHARGING", "LOADING", "OCCUPIED"])
            )
        ).scalar_one()
    )

    today = date.today()
    expired_peso = int(
        db_session.execute(
            select(func.count()).select_from(GateQueue).where(
                GateQueue.peso_expiry_date.is_not(None),
                GateQueue.peso_expiry_date < today,
            )
        ).scalar_one()
    )

    if open_incidents > 0 or lpg_percent > 90:
        status = "CRITICAL"
    elif queue_length > 5 and active_trips == 0:
        status = "BOTTLENECKED"
    else:
        status = "STABLE"

    if status == "CRITICAL" and open_incidents > 0:
        top_incident = db_session.execute(
            select(SafetyIncident).where(
                func.coalesce(SafetyIncident.status, "OPEN").not_in(["CLOSED", "RESOLVED"])
            ).order_by(SafetyIncident.created_at.desc()).limit(1)
        ).scalar_one_or_none()
        incident_id = top_incident.incident_id if top_incident else "latest"
        headline = "Gantry stalled due to open incident."
        primary_action = {
            "label": "Resolve Bay Incident",
            "action_url": f"/hse/incidents/{incident_id}",
        }
    elif status == "CRITICAL":
        headline = "Horton Sphere nearing tank-top; decanting escalation required."
        primary_action = {
            "label": "Increase Discharge Rate",
            "action_url": "/terminal/controls/pumps",
        }
    elif status == "BOTTLENECKED":
        headline = "Queue building while gantry throughput is stalled."
        primary_action = {
            "label": "Re-sequence Gantry Queue",
            "action_url": "/controller/console",
        }
    else:
        headline = "Terminal stable; no immediate compliance or flow blockers."
        primary_action = {
            "label": "Open Operations Dashboard",
            "action_url": "/dashboard",
        }

    key_metrics = [
        f"Inventory: {lpg_percent:.0f}% ({'Approaching Tank-Top' if lpg_percent > 85 else 'Operational Band'})",
        f"Queue: {queue_length} Trucks Waiting",
        f"Compliance: {expired_peso} Truck{'s' if expired_peso != 1 else ''} with Expired PESO cert",
    ]

    return {
        "status": status,
        "headline": headline,
        "key_metrics": key_metrics,
        "primary_action": primary_action,
    }


def get_executive_briefing_http(db_session: Session) -> Dict[str, Any]:
    # Thin API wrapper kept separate so this function can be mounted in Flask/FastAPI.
    return get_executive_briefing(db_session)
