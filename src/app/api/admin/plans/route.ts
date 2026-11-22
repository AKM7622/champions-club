import { NextRequest, NextResponse } from "next/server";
import { getPlans, updatePlan, verifyOwnerAccess } from "@/lib/plan-service";

export async function GET(req: NextRequest) {
  const auth = await verifyOwnerAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  return getPlans(req);
}

export async function PUT(req: NextRequest) {
  return updatePlan(req);
}

export async function PATCH(req: NextRequest) {
  return updatePlan(req);
}

export async function POST(req: NextRequest) {
  return updatePlan(req);
}
