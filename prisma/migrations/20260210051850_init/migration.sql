-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'TERMINAL_ADMIN', 'CLIENT', 'TRANSPORTER', 'SECURITY', 'SURVEYOR', 'HSE_OFFICER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('LPG', 'POL', 'CHEMICAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CLIENT_APPROVED', 'OPS_SCHEDULED', 'TRUCK_DETAILS_PENDING', 'QR_ISSUED', 'ARRIVED_GATE', 'IN_TERMINAL', 'LOADED', 'EXITED', 'CLOSED', 'REJECTED', 'CANCELLED', 'STOP_WORK');

-- CreateEnum
CREATE TYPE "TruckTripStatus" AS ENUM ('PENDING', 'QR_ISSUED', 'ARRIVED', 'IN_TERMINAL', 'LOADED', 'EXITED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GateEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "transporterId" TEXT,
    "terminalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "isHazardous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityAvailable" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KL',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gantry" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Gantry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bay" (
    "id" TEXT NOT NULL,
    "gantryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,

    CONSTRAINT "Bay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBayMap" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bayId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductBayMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacityTrucks" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityRequested" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "timeSlotId" TEXT,
    "transporterId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "isBulk" BOOLEAN NOT NULL DEFAULT false,
    "additionalRequests" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingBayAllocation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bayId" TEXT NOT NULL,
    "allocatedByUserId" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingBayAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruckTrip" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "qrToken" TEXT,
    "status" "TruckTripStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateEvent" (
    "id" TEXT NOT NULL,
    "truckTripId" TEXT NOT NULL,
    "type" "GateEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securityUserId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "photoTruckUrl" TEXT,
    "photoDriverUrl" TEXT,
    "weighmentTare" DOUBLE PRECISION,
    "weighmentGross" DOUBLE PRECISION,
    "netQuantity" DOUBLE PRECISION,

    CONSTRAINT "GateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyChecklist" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdByHseId" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "checklistJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StopWorkOrder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "issuedByHseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StopWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "bookingId" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "InventoryLot_clientId_idx" ON "InventoryLot"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_clientId_productId_key" ON "InventoryLot"("clientId", "productId");

-- CreateIndex
CREATE INDEX "Gantry_terminalId_idx" ON "Gantry"("terminalId");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_uniqueCode_key" ON "Bay"("uniqueCode");

-- CreateIndex
CREATE INDEX "Bay_gantryId_idx" ON "Bay"("gantryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBayMap_productId_bayId_key" ON "ProductBayMap"("productId", "bayId");

-- CreateIndex
CREATE INDEX "TimeSlot_terminalId_date_idx" ON "TimeSlot"("terminalId", "date");

-- CreateIndex
CREATE INDEX "TimeSlot_date_idx" ON "TimeSlot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNo_key" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_date_idx" ON "Booking"("date");

-- CreateIndex
CREATE INDEX "Booking_bookingNo_idx" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "Booking_terminalId_idx" ON "Booking"("terminalId");

-- CreateIndex
CREATE INDEX "BookingBayAllocation_bookingId_idx" ON "BookingBayAllocation"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "TruckTrip_qrToken_key" ON "TruckTrip"("qrToken");

-- CreateIndex
CREATE INDEX "TruckTrip_bookingId_idx" ON "TruckTrip"("bookingId");

-- CreateIndex
CREATE INDEX "TruckTrip_qrToken_idx" ON "TruckTrip"("qrToken");

-- CreateIndex
CREATE INDEX "GateEvent_truckTripId_idx" ON "GateEvent"("truckTripId");

-- CreateIndex
CREATE INDEX "GateEvent_timestamp_idx" ON "GateEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SafetyChecklist_bookingId_idx" ON "SafetyChecklist"("bookingId");

-- CreateIndex
CREATE INDEX "StopWorkOrder_bookingId_idx" ON "StopWorkOrder"("bookingId");

-- CreateIndex
CREATE INDEX "StopWorkOrder_active_idx" ON "StopWorkOrder"("active");

-- CreateIndex
CREATE INDEX "Incident_terminalId_idx" ON "Incident"("terminalId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gantry" ADD CONSTRAINT "Gantry_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bay" ADD CONSTRAINT "Bay_gantryId_fkey" FOREIGN KEY ("gantryId") REFERENCES "Gantry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBayMap" ADD CONSTRAINT "ProductBayMap_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBayMap" ADD CONSTRAINT "ProductBayMap_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBayAllocation" ADD CONSTRAINT "BookingBayAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBayAllocation" ADD CONSTRAINT "BookingBayAllocation_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBayAllocation" ADD CONSTRAINT "BookingBayAllocation_allocatedByUserId_fkey" FOREIGN KEY ("allocatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckTrip" ADD CONSTRAINT "TruckTrip_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEvent" ADD CONSTRAINT "GateEvent_truckTripId_fkey" FOREIGN KEY ("truckTripId") REFERENCES "TruckTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEvent" ADD CONSTRAINT "GateEvent_securityUserId_fkey" FOREIGN KEY ("securityUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyChecklist" ADD CONSTRAINT "SafetyChecklist_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyChecklist" ADD CONSTRAINT "SafetyChecklist_createdByHseId_fkey" FOREIGN KEY ("createdByHseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopWorkOrder" ADD CONSTRAINT "StopWorkOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopWorkOrder" ADD CONSTRAINT "StopWorkOrder_issuedByHseId_fkey" FOREIGN KEY ("issuedByHseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
