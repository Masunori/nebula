// Automated API and Database Interaction Verification Suite
import http from "http";

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("==================================================================");
  console.log("   NEBULAX CLIENT & DATABASE API INTERACTION TEST SUITE          ");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• Testing: ${name.padEnd(50)} ... `);
      await fn();
      console.log("\x1b[32m[PASS]\x1b[0m");
      passed++;
    } catch (err) {
      console.log("\x1b[31m[FAIL]\x1b[0m");
      console.error("  Error:", err.message);
      failed++;
    }
  }

  // 1. Database Overview
  await test("GET /api/database/overview", async () => {
    const res = await fetch(`${BASE_URL}/api/database/overview`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.lines_count < 1) throw new Error(`Expected at least 1 line, got ${data.lines_count}`);
  });

  // 2. Network Topology & Static Capacity
  await test("GET /api/database/topology", async () => {
    const res = await fetch(`${BASE_URL}/api/database/topology`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.lines || !data.sectors || !data.location_supply) {
      throw new Error("Missing topology keys in payload");
    }
  });

  // 3. Staged Transactional Commit
  await test("POST /api/database/commit (Update Activity Volume)", async () => {
    const payload = {
      changes: [
        {
          id: "test_change_1",
          entity_type: "ACTIVITY",
          action: "UPDATE",
          key: "A001",
          new_value: { total_accesses: 9 },
        },
      ],
    };
    const res = await fetch(`${BASE_URL}/api/database/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Commit returned success: false");
  });

  // 4. Flush Database Completely
  await test("POST /api/database/flush", async () => {
    const res = await fetch(`${BASE_URL}/api/database/flush`, { method: "POST" });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Flush returned success: false");

    // Verify activities and lines are emptied
    const checkRes = await fetch(`${BASE_URL}/api/database/activities`);
    const checkData = await checkRes.json();
    if (checkData.count !== 0) throw new Error(`Expected 0 activities after flush, got ${checkData.count}`);
  });

  // 5. Ingest Custom Records (POST /api/database/ingest)
  await test("POST /api/database/ingest (Custom Activities)", async () => {
    const customRecords = [
      {
        activity_id: "A999",
        contract_number: "C999",
        line_code: "ALP",
        activity_type: "Test Ingestion",
        priority: 1,
        nature_of_works: "Live",
        station_from: "S01",
        station_to: "S02",
        track_bound: "EB",
        total_accesses: 4,
        planned_start_date: "2027-02-01",
        predecessor_activity_id: null,
      },
    ];
    const res = await fetch(`${BASE_URL}/api/database/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "activities", records: customRecords }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Ingest returned success: false");

    // Verify record was inserted
    const actRes = await fetch(`${BASE_URL}/api/database/activities?search=A999`);
    const actData = await actRes.json();
    if (actData.count !== 1) throw new Error(`Expected 1 ingested activity, found ${actData.count}`);
  });

  // 6. Load Preset Dataset (POST /api/database/load)
  await test("POST /api/database/load (DEFAULT Baseline)", async () => {
    const res = await fetch(`${BASE_URL}/api/database/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: "DEFAULT" }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Load returned success: false");

    // Verify baseline restored to 54 activities
    const actRes = await fetch(`${BASE_URL}/api/database/activities`);
    const actData = await actRes.json();
    if (actData.count !== 54) throw new Error(`Expected 54 activities after DEFAULT load, got ${actData.count}`);
  });

  // 7. Predecessor DAG & Cycle Detection
  await test("GET /api/database/dag", async () => {
    const res = await fetch(`${BASE_URL}/api/database/dag`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.has_cycles !== false) throw new Error("Baseline DAG should not have cycles");
    if (data.nodes.length !== 54) throw new Error(`Expected 54 nodes, got ${data.nodes.length}`);
  });

  // 8. Front-End Page Rendering
  await test("GET /database (HTML UI Rendering)", async () => {
    const res = await fetch(`${BASE_URL}/database`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes("NEBULAX")) throw new Error("NEBULAX title missing from HTML");
    if (!html.includes("Network Graph")) throw new Error("Network Graph tab missing from HTML");
  });

  // 9. Standalone Fast Schedule Validation (<150ms)
  await test("POST /api/solver/validate (Standalone Fast Auditor)", async () => {
    const res = await fetch(`${BASE_URL}/api/solver/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "A" }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (typeof data.feasible !== "boolean") throw new Error("Missing feasible boolean in validation response");
    if (!data.soft_scores) throw new Error("Missing soft_scores in validation response");
  });

  // 10. Download Single Submission CSV
  await test("GET /api/solver/download?file=RESULTS.csv", async () => {
    const res = await fetch(`${BASE_URL}/api/solver/download?file=RESULTS.csv`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    if (!text.includes("scenario,contract_number,simulated_completion_date,overrun_days")) {
      throw new Error("RESULTS.csv header mismatch");
    }
  });

  // 11. Download Submission ZIP Package
  await test("GET /api/solver/download?file=zip (Submission ZIP Package)", async () => {
    const res = await fetch(`${BASE_URL}/api/solver/download?file=zip&scenario=A`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) throw new Error(`ZIP package suspiciously small: ${buf.byteLength} bytes`);
  });

  // 12. Master Schedule Page UI Rendering
  await test("GET /schedule (Master Schedule HTML UI Rendering)", async () => {
    const res = await fetch(`${BASE_URL}/schedule`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes("Railway Track Access Planner")) {
      throw new Error("Schedule planner title missing from HTML");
    }
  });

  console.log("==================================================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

runTests();
