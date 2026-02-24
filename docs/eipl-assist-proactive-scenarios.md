# EIPL Assist Proactive Scenario Scripts

## Scenario 1: Nozzle Failure at Gantry

### Input Snapshot
- Trucks in Yard: 4
- Trips Scheduled: 1
- Bay Status:
  - Bay 2 nozzle pressure unstable
  - Bay 4 healthy
- Safety_Incidents:
  - INC-511 | Gantry 2 | Nozzle leak observed
- Compliance_Checklists:
  - Bay 2 decanting checklist pending closure
- Equipment_Status:
  - Gantry 2 nozzle assembly: Fault

### Expected Reasoning
1. DATA CORRELATION:
- Trucks in Yard > 0 with reduced movement; identify blocker sequence.
- Safety_Incidents confirms active nozzle incident.
- Compliance_Checklists confirms pending closure.
- Equipment_Status confirms nozzle fault.
2. ENTITY SPECIFICITY:
- If user asks for "2 trucks", return truck-wise gate-in and compliance state.
3. PREDICTIVE ALERTING:
- Trucks at Bay 2 waiting >60 min trigger bottleneck alert.

### Expected Output
- [STATUS]: Gantry 2 decanting is restricted due to nozzle leak; 3 trucks are queued without allotment.
- [INSIGHT]: Incident INC-511 and pending Bay 2 checklist are directly suppressing trips despite trucks in yard.
- [PROACTIVE ACTION]: `Open_Incident_Report(ID=511)` and `Shift_Queue_To_Bay(Bay=4)`.

### UI Contract Example
```json
{
  "kind": "ops_availability",
  "intent": "availability_allotment",
  "role": "internal_ops",
  "headline": "Nozzle Failure Bottleneck",
  "summary": "Gantry 2 leak is blocking allotment flow.",
  "status": { "label": "Equipment Fault", "severity": "danger", "icon": "siren" },
  "metrics": [
    { "label": "Trucks in Yard", "value": "4" },
    { "label": "Trips Scheduled", "value": "1", "severity": "warning" },
    { "label": "Blocked at Gantry 2", "value": "3", "severity": "danger" }
  ],
  "blockers": {
    "title": "Primary Blockers",
    "items": [
      { "text": "INC-511 nozzle leak at Gantry 2", "severity": "danger" },
      { "text": "Bay 2 decanting checklist pending", "severity": "warning" }
    ]
  },
  "actions": [
    {
      "id": "open-inc-511",
      "label": "Open Incident INC-511",
      "href": "/hse/incidents/511",
      "tooltip": "Inspect leak root cause and containment actions",
      "icon": "file-warning",
      "visibility": ["internal_ops"]
    },
    {
      "id": "shift-to-bay-4",
      "label": "Shift Queue to Bay 4",
      "href": "/controller/console?reassign=bay-4",
      "tooltip": "Reduce dwell time while Bay 2 is repaired",
      "icon": "shuffle",
      "visibility": ["internal_ops"]
    }
  ]
}
```

## Scenario 2: PESO Document Expired

### Input Snapshot
- Trucks in Yard: 3
- Trips Scheduled: 0
- Truck Units:
  - TRK-3008 | Gate_In_Time: 10:14 | PESO_Status: Expired
  - TRK-3161 | Gate_In_Time: 10:28 | PESO_Status: Valid
  - TRK-3374 | Gate_In_Time: 10:35 | PESO_Status: Expired
- Safety_Incidents: none open
- Compliance_Checklists:
  - 2 trucks blocked by PESO expiry
- Equipment_Status:
  - All bays healthy

### Expected Reasoning
1. DATA CORRELATION:
- Trucks in Yard > 0 and Trips Scheduled = 0 indicates compliance blocker.
- No open incidents, no equipment fault, so compliance is primary root cause.
2. ENTITY SPECIFICITY:
- Mention exact truck IDs with PESO status.
3. PREDICTIVE ALERTING:
- Any expired-document truck waiting >60 min triggers compliance bottleneck alert.

### Expected Output
- [STATUS]: Allotment is paused because 2 trucks have expired PESO documentation.
- [INSIGHT]: Movement is zero despite healthy gantry and no incidents, confirming a pure compliance bottleneck.
- [PROACTIVE ACTION]: `Open_Compliance_Record(TRK-3008)` and `Request_Document_Reupload()`.

### UI Contract Example
```json
{
  "kind": "ops_availability",
  "intent": "availability_allotment",
  "role": "internal_ops",
  "headline": "Compliance Hold: PESO Expiry",
  "summary": "2 trucks blocked due to expired PESO compliance documents.",
  "status": { "label": "Compliance Block", "severity": "warning", "icon": "shield-alert" },
  "metrics": [
    { "label": "Trucks in Yard", "value": "3" },
    { "label": "Trips Scheduled", "value": "0", "severity": "danger" },
    { "label": "Expired PESO", "value": "2", "severity": "warning" }
  ],
  "blockers": {
    "title": "Compliance Blockers",
    "items": [
      { "text": "TRK-3008 PESO document expired", "severity": "warning" },
      { "text": "TRK-3374 PESO document expired", "severity": "warning" }
    ]
  },
  "actions": [
    {
      "id": "open-trk-3008-compliance",
      "label": "Open TRK-3008 Compliance",
      "href": "/security/gate?truck=TRK-3008",
      "tooltip": "Inspect and update PESO certificate details",
      "icon": "file-search",
      "visibility": ["internal_ops"]
    },
    {
      "id": "notify-doc-upload",
      "label": "Request Document Reupload",
      "href": "/communications?template=peso-expiry",
      "tooltip": "Notify transporter for immediate corrected upload",
      "icon": "send",
      "visibility": ["internal_ops"]
    }
  ]
}
```

## Scenario 3: Horton Spheres Low Stock

### Input Snapshot
- LPG Inventory:
  - Horton Sphere A: 18%
  - Horton Sphere B: 15%
- Trucks in Yard: 5
- Trips Scheduled: 4
- Safety_Incidents:
  - None open
- Compliance_Checklists:
  - All clear
- Equipment_Status:
  - Gantry healthy

### Expected Reasoning
1. DATA CORRELATION:
- Throughput currently active, but inventory is near operational risk threshold.
- Safety/compliance/equipment are not blockers.
2. ENTITY SPECIFICITY:
- Mention exact Horton Sphere levels.
3. PREDICTIVE ALERTING:
- Predict stockout risk and suggest pre-emptive scheduling change.

### Expected Output
- [STATUS]: Throughput is active but inventory is critically low in Horton Spheres.
- [INSIGHT]: 5 trucks in yard with 4 scheduled trips may overdraw buffer stock within the next cycle.
- [PROACTIVE ACTION]: `Trigger_Replenishment_Plan()` and `Prioritize_High_Density_Decanting()`.

### UI Contract Example
```json
{
  "kind": "ops_availability",
  "intent": "availability_allotment",
  "role": "internal_ops",
  "headline": "Low LPG Inventory Risk",
  "summary": "Horton Spheres are below healthy operational reserve.",
  "status": { "label": "Inventory Warning", "severity": "warning", "icon": "gauge" },
  "metrics": [
    { "label": "Horton Sphere A", "value": "18%", "severity": "warning" },
    { "label": "Horton Sphere B", "value": "15%", "severity": "danger" },
    { "label": "Trips Scheduled", "value": "4" }
  ],
  "blockers": {
    "title": "Projected Constraints",
    "items": [
      { "text": "Stock may breach reserve threshold if full decanting continues", "severity": "warning" }
    ]
  },
  "actions": [
    {
      "id": "trigger-replenishment",
      "label": "Trigger Replenishment Plan",
      "href": "/notifications?type=inventory-replenishment",
      "tooltip": "Alert supply planning for urgent refill cycle",
      "icon": "bell-ring",
      "visibility": ["internal_ops"]
    },
    {
      "id": "optimize-decanting",
      "label": "Open Gantry Scheduling",
      "href": "/schedule",
      "tooltip": "Prioritize decanting sequence to protect reserve",
      "icon": "calendar-clock",
      "visibility": ["internal_ops"]
    }
  ]
}
```
