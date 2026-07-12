import { NextRequest, NextResponse } from "next/server";
import { getDevice } from "@/lib/registry";
import type { ApiDeviceResponse, ApiErrorResponse } from "@/types";

/**
 * GET /api/device/:id
 * Returns metadata for a connected device.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiDeviceResponse | ApiErrorResponse>> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Device ID is required", code: "MISSING_ID" },
      { status: 400 }
    );
  }
  const record = getDevice(id);

  if (!record) {
    return NextResponse.json(
      { error: "Device not found or not connected", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const now = Date.now();

  return NextResponse.json({
    deviceId: record.info.deviceId,
    connectedAt: record.info.connectedAt,
    lastSeen: record.info.lastSeen,
    uptime: now - record.info.connectedAt,
    hasSensorData: record.latestSensor !== null,
  });
}
