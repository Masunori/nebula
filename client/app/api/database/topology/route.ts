import { NextResponse } from "next/server";
import { getNetworkTopology } from "@/lib/db";

export async function GET() {
  try {
    const topology = await getNetworkTopology();
    return NextResponse.json(topology);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
