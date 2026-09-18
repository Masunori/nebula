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
    if (data.lines_count !== 2) throw new Error(`Expected 2 lines, got ${data.lines_count}`);
    if (data.stations_count !== 20) throw new Error(`Expected 20 stations, got ${data.stations_count}`);
    if (data.activities_count !== 54) throw new Error(`Expected 54 activities, got ${data.activities_count}`);
    if (!data.is_dag_valid) throw new Error("Expected DAG to be valid");
  });

  // 2. Network Topology & Static Capacity
  await test("GET /api/database/topology", async () => {
    const res = await fetch(`${BASE_URL}/api/database/topology`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.lines.length !== 2) throw new Error(`Expected 2 lines, got ${data.lines.length}`);
    if (data.sectors.length !== 18) throw new Error(`Expected 18 sectors, got ${data.sectors.length}`);
    if (data.location_supply.length !== 76) throw new Error(`Expected 76 supply items, got ${data.location_supply.length}`);
  });

  // 3. Activities Query & Filtering
  await test("GET /api/database/activities (All)", async () => {
    const res = await fetch(`${BASE_URL}/api/database/activities`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.count !== 54) throw new Error(`Expected 54 activities, got ${data.count}`);
  });

  await test("GET /api/database/activities?line=ALP&priority=1", async () => {
    const res = await fetch(`${BASE_URL}/api/database/activities?line=ALP&priority=1`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    for (const a of data.activities) {
      if (a.line_code !== "ALP" || a.priority !== 1) throw new Error(`Filter violated: ${JSON.stringify(a)}`);
    }
  });

  // 4. Predecessor DAG & Cycle Detection
  await test("GET /api/database/dag", async () => {
    const res = await fetch(`${BASE_URL}/api/database/dag`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.has_cycles !== false) throw new Error("Baseline DAG should not have cycles");
    if (data.nodes.length !== 54) throw new Error(`Expected 54 nodes, got ${data.nodes.length}`);
  });

  // 5. System Parameters & Safety Buffer Rules
  await test("GET /api/database/parameters", async () => {
    const res = await fetch(`${BASE_URL}/api/database/parameters`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.buffer_rules.length !== 3) throw new Error(`Expected 3 buffer rules, got ${data.buffer_rules.length}`);
    const liveRule = data.buffer_rules.find((r) => r.nature_of_works === "Live");
    if (!liveRule || liveRule.buffer_sectors !== 2 || !liveRule.requires_opposite_bound) {
      throw new Error(`Invalid live buffer rule: ${JSON.stringify(liveRule)}`);
    }
  });

  // 6. Staged Transactional Commit
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

    // Verify change is reflected in memory database
    const actRes = await fetch(`${BASE_URL}/api/database/activities?search=A001`);
    const actData = await actRes.json();
    const updated = actData.activities.find((a) => a.activity_id === "A001");
    if (!updated || updated.total_accesses !== 9) {
      throw new Error(`Expected A001 volume to be 9, got ${updated ? updated.total_accesses : 'none'}`);
    }
  });

  // 7. Flush Database
  await test("POST /api/database/flush", async () => {
    const res = await fetch(`${BASE_URL}/api/database/flush`, { method: "POST" });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Flush returned success: false");

    // Verify activities are emptied
    const checkRes = await fetch(`${BASE_URL}/api/database/activities`);
    const checkData = await checkRes.json();
    if (checkData.count !== 0) throw new Error(`Expected 0 activities after flush, got ${checkData.count}`);
  });

  // 8. Front-End Page Rendering
  await test("GET /database (HTML UI Rendering)", async () => {
    const res = await fetch(`${BASE_URL}/database`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes("NEBULAX")) throw new Error("NEBULAX title missing from HTML");
    if (!html.includes("Topology &amp; Static Supply") && !html.includes("Topology & Static Supply")) {
      throw new Error("Tab navigation missing from HTML");
    }
  });

  console.log("==================================================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

runTests();
