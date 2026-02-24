"""
Multi-step compliance approval engine for LPG truck gate passes.

Regulatory focus:
- PESO license validity
- OISD-144 aligned safety checks (spark arrestor, earthing relay calibration)
- Motor vehicles fitness validity
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):
    pass


class TruckComplianceRecord(Base):
    __tablename__ = "truck_compliance"

    truck_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    transporter_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    peso_license_validity: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    spark_arrestor_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    earthing_relay_calibration: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    rc_fitness_certificate: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class GatePassAuditLog(Base):
    __tablename__ = "gate_pass_audit_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    truck_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    approved_by_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    compliance_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    gate_pass_issued: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


def _to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def process_gate_pass(db_session: Session, truck_id: str, user_id: str) -> Dict[str, Any]:
    today = date.today()
    record = db_session.execute(
        select(TruckComplianceRecord).where(TruckComplianceRecord.truck_id == truck_id)
    ).scalar_one_or_none()

    if record is None:
        return {
            "status": "BLOCKED",
            "truck_id": truck_id,
            "transporter_name": "Unknown",
            "compliance_gap_summary": "Truck compliance record not found.",
            "precheck": {
                "peso_license_validity": {"valid": False, "detail": "Missing"},
                "spark_arrestor_status": {"valid": False, "detail": "Missing"},
                "earthing_relay_calibration": {"valid": False, "detail": "Missing"},
                "rc_fitness_certificate": {"valid": False, "detail": "Missing"},
            },
        }

    checks = {
        "peso_license_validity": {
            "valid": bool(record.peso_license_validity and record.peso_license_validity >= today),
            "detail": f"Valid till {record.peso_license_validity}" if record.peso_license_validity else "Missing",
        },
        "spark_arrestor_status": {
            "valid": str(record.spark_arrestor_status or "").strip().upper() in {"OK", "PASS", "VALID"},
            "detail": record.spark_arrestor_status or "Missing",
        },
        "earthing_relay_calibration": {
            "valid": bool(record.earthing_relay_calibration and record.earthing_relay_calibration >= today),
            "detail": (
                f"Calibrated till {record.earthing_relay_calibration}"
                if record.earthing_relay_calibration
                else "Missing"
            ),
        },
        "rc_fitness_certificate": {
            "valid": bool(record.rc_fitness_certificate and record.rc_fitness_certificate >= today),
            "detail": (
                f"Valid till {record.rc_fitness_certificate}" if record.rc_fitness_certificate else "Missing"
            ),
        },
    }

    failed = [name for name, value in checks.items() if not bool(value["valid"])]

    if failed:
        gap_lines = []
        if "peso_license_validity" in failed:
            gap_lines.append(f"PESO License expired on {record.peso_license_validity}.")
        if "spark_arrestor_status" in failed:
            gap_lines.append("Spark Arrestor status is not compliant.")
        if "earthing_relay_calibration" in failed:
            gap_lines.append(f"Earthing relay calibration expired on {record.earthing_relay_calibration}.")
        if "rc_fitness_certificate" in failed:
            gap_lines.append(f"RC Fitness expired on {record.rc_fitness_certificate}.")

        return {
            "status": "BLOCKED",
            "truck_id": truck_id,
            "transporter_name": record.transporter_name or "Unknown",
            "compliance_gap_summary": " ".join(gap_lines),
            "precheck": checks,
        }

    return {
        "status": "ACTION_REQUIRED",
        "truck_id": truck_id,
        "transporter_name": record.transporter_name or "Unknown",
        "compliance_gap_summary": "",
        "precheck": checks,
        "checklist": [
            {"id": "earthing_bond", "label": "Physical Earthing Bond Connected"},
            {"id": "iefcv_tested", "label": "IEFCV (Internal Excess Flow Check Valve) Tested"},
            {"id": "no_leaks", "label": "No Leaks Detected at Manifold"},
        ],
        "gatekeeper_action": {
            "label": "Issue Gate Pass",
            "action_url": f"/api/gate-pass/{truck_id}/approve",
        },
        "requested_by_user_id": user_id,
    }


def approve_gate_pass(
    db_session: Session,
    *,
    truck_id: str,
    approved_by_user_id: str,
    compliance_snapshot: Dict[str, Any],
    gate_pass_issued: bool = True,
) -> GatePassAuditLog:
    stamp = datetime.now(timezone.utc)
    log = GatePassAuditLog(
        id=f"gpa-{truck_id}-{int(stamp.timestamp())}",
        truck_id=truck_id,
        approved_by_user_id=approved_by_user_id,
        timestamp=stamp,
        compliance_snapshot=compliance_snapshot,
        gate_pass_issued=gate_pass_issued,
    )
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    return log
