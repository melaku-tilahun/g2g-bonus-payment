const axios = require("axios");

// Configuration - Replace with your actual credentials
const config = {
  mock_url: "http://core.mor.gov.et",
  clientId: "a8d87762-d96d-4dd0-95d1-01753dba5181", // Example ID
  clientSecret: "0cc1a9ba-0f7d-44e1-bad2-0d136572794b", // Example Secret
  apiKey: "471555f9-6726-4786-9e53-f29f220819c3", // Example Key
  sellerTin: "0000034558", // Example TIN
};

async function testLogin() {
  console.log("--- Testing MOR EIMS Login ---");
  console.log(`URL: ${config.mock_url}/auth/login`);

  try {
    const response = await axios.post(
      `${config.mock_url}/auth/login`,
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        apikey: config.apiKey,
        tin: config.sellerTin,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Success!");
    console.log("Status:", response.status);
    console.log("Response Body:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error during login test");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
  }
}

testLogin();
