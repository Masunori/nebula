import { NextResponse } from "next/server";

const SERVER_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");
    const scenario = searchParams.get("scenario") || "A";

    if (file === "zip") {
      const res = await fetch(`${SERVER_BASE}/api/solver/download_zip?scenario=${scenario}`);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to download zip package" }, { status: res.status });
      }
      const blob = await res.arrayBuffer();
      return new Response(blob, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename=nebula_submission_scenario_${scenario}.zip`,
        },
      });
    }

    if (!file || !["SCHEDULE_ACCESS.csv", "SCHEDULE_OCCUPANCY.csv", "RESULTS.csv"].includes(file)) {
      return NextResponse.json({ error: "Invalid file requested" }, { status: 400 });
    }

    const res = await fetch(`${SERVER_BASE}/api/solver/download/${file}`);
    if (!res.ok) {
      return NextResponse.json({ error: `File ${file} not found or not generated` }, { status: res.status });
    }

    const text = await res.text();
    return new Response(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${file}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
