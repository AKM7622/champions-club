import { NextRequest } from "next/server";
import { getPlans, updatePlan } from "@/lib/plan-service";

export async function GET(req: NextRequest) {
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
