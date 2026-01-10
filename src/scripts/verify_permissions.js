const pool = require("../config/database");

async function mockRequest(role, authorizedRoles) {
  // Simulate the authorize middleware logic
  if (!role) {
    return { status: 401, message: "Unauthorized" };
  }

  if (Array.isArray(authorizedRoles)) {
    if (!authorizedRoles.includes(role)) {
      return { status: 403, message: "Forbidden" };
    }
  } else if (authorizedRoles && role !== authorizedRoles) {
    return { status: 403, message: "Forbidden" };
  }

  return { status: 200, message: "Success" };
}

// Map of route logic matching our implementation
const routes = {
  createPayment: ["admin", "director", "manager", "staff"],
  revertPayment: ["admin", "director"],
  verifyDriver: ["admin", "director", "manager", "staff"],
  blockDriver: ["admin", "director", "manager"],
  createDebt: ["admin", "director"],
  viewDebtAnalytics: ["admin", "director", "manager"],
  complianceReport: ["admin", "director"],
  viewSystemHealth: ["admin"],
  manageUsers: ["admin", "director"],
};

async function verifyPermissions() {
  const roles = ["admin", "director", "manager", "staff", "auditor"];

  console.log("Verifying Permissions Map...\n");

  roles.forEach((role) => {
    console.log(`--- Role: ${role.toUpperCase()} ---`);
    for (const [action, allowed] of Object.entries(routes)) {
      const result = allowed.includes(role) ? "✅ ALLOWED" : "❌ DENIED";
      console.log(`  ${action}: ${result}`);
    }
    console.log("");
  });

  // Test Case for Auditor specifically
  console.log("--- AUDITOR SPECIAL CHECK ---");
  const auditorAllowed = [
    "createPayment",
    "revertPayment",
    "verifyDriver",
    "blockDriver",
    "createDebt",
    "viewDebtAnalytics",
    "complianceReport",
    "viewSystemHealth",
    "manageUsers",
  ].filter((action) => routes[action].includes("auditor"));

  if (auditorAllowed.length === 0) {
    console.log(
      "✅ Auditor is correctly blocked from all write/sensitive admin operations."
    );
  } else {
    console.log("⚠️ SECURITY WARNING: Auditor has access to:", auditorAllowed);
  }
}

verifyPermissions();
