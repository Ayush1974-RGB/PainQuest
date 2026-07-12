import { NextRequest, NextResponse } from "next/server";
import { getDevice } from "@/lib/registry";
import type { ApiSensorResponse, ApiErrorResponse } from "@/types";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiSensorResponse | ApiErrorResponse>> {
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

  if (!record.latestSensor) {
    return NextResponse.json(
      {
        error: "No sensor data received yet",
        code: "NO_DATA",
      },
      { status: 204 }
    );
  }

  const { deviceId, timestamp, clientTimestamp, ...sensorFields } =
    record.latestSensor;

  return NextResponse.json({
    deviceId,
    timestamp,
    age: Date.now() - timestamp,
    sensor: sensorFields,
  });
}



