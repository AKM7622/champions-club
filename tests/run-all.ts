import { spawnSync } from "child_process";
import path from "path";

const testFiles = [
  "tests/auth-system.test.ts",
  "tests/middleware-rbac.test.ts",
  "tests/login-page.test.ts",
  "tests/auth-endpoints.test.ts",
  "tests/plan-management-and-renewals.test.ts",
  "tests/public-membership-purchase.test.ts",
  "tests/email-validator.test.ts",
  "tests/whitebox-lib.test.ts",
  "tests/whitebox-middleware.test.ts",
  "tests/whitebox-auth-routes.test.ts",
  "tests/whitebox-plans.test.ts",
  "tests/whitebox-members-and-crm.test.ts",
  "tests/whitebox-operations.test.ts",
  "tests/bar-closing-earnings.test.ts",
  "tests/roles-crud-and-restrictions.test.ts",
];

console.log(`\n========================================================`);
console.log(`  CHAMPIONS CLUB - WHITE-BOX TEST RUNNER (ALL SUITES)`);
console.log(`  Executing ${testFiles.length} test suites with full coverage...`);
console.log(`========================================================\n`);

let totalPassedSuites = 0;
let totalFailedSuites = 0;
const startOverall = Date.now();

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  console.log(`\n[Suite ${i + 1}/${testFiles.length}] Running ${file}...`);
  const startSuite = Date.now();

  const isWindows = process.platform === "win32";
  const tsxCmd = isWindows ? "npx.cmd" : "npx";
  const result = spawnSync(tsxCmd, ["tsx", "-r", "./tests/setup-env.js", file], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const durationSec = ((Date.now() - startSuite) / 1000).toFixed(2);

  if (result.status === 0) {
    console.log(`[Suite ${i + 1}/${testFiles.length}] ✓ ${file} PASSED (${durationSec}s)`);
    totalPassedSuites++;
  } else {
    console.error(`[Suite ${i + 1}/${testFiles.length}] ✗ ${file} FAILED with status ${result.status} (${durationSec}s)`);
    totalFailedSuites++;
    process.exit(result.status || 1);
  }
}

const totalDuration = ((Date.now() - startOverall) / 1000).toFixed(2);
console.log(`\n========================================================`);
console.log(`  TEST RUN COMPLETE: ${totalPassedSuites} Passed, ${totalFailedSuites} Failed (${totalDuration}s)`);
console.log(`========================================================\n`);
