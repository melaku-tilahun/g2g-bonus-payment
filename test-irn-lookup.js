const axios = require("axios");

const config = {
  mock_url: "http://core.mor.gov.et",
  clientId: "a8d87762-d96d-4dd0-95d1-01753dba5181",
  clientSecret: "0cc1a9ba-0f7d-44e1-bad2-0d136572794b",
  apiKey: "471555f9-6726-4786-9e53-f29f220819c3",
  sellerTin: "0000034558",
  testIrn: "0050388604",
};

async function lookupIRN() {
  console.log("--- Looking up IRN to extract exact data ---");

  try {
    // Step 1: Login
    console.log("\n1. 🔑 Authenticating...");
    const authResponse = await axios.post(`${config.mock_url}/auth/login`, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      apikey: config.apiKey,
      tin: config.sellerTin,
    });
    const token = authResponse.data.data.accessToken;
    console.log("✅ Auth Success!");

    // Step 2: Verify IRN
    console.log(`\n2. 🔍 Looking up IRN: ${config.testIrn}...`);
    const verifyResponse = await axios.post(
      `${config.mock_url}/v1/verify`,
      {
        irn: config.testIrn,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("\n✅ IRN Found!");
    console.log("\n📋 Full Response:");
    console.log(JSON.stringify(verifyResponse.data, null, 2));
  } catch (error) {
    console.error("\n❌ Lookup failed");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
  }
}

lookupIRN();
