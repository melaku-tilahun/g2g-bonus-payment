const axios = require("axios");

// Configuration - Use the same credentials that worked for you
const config = {
  mock_url: "http://core.mor.gov.et",
  clientId: "a8d87762-d96d-4dd0-95d1-01753dba5181",
  clientSecret: "0cc1a9ba-0f7d-44e1-bad2-0d136572794b",
  apiKey: "471555f9-6726-4786-9e53-f29f220819c3",
  sellerTin: "0000034558",
};

async function testWithholdingReceipt() {
  console.log("--- Testing MOR EIMS Withholding Receipt ---");

  try {
    // Step 1: Login to get token
    console.log("1. Authenticating...");
    const authResponse = await axios.post(`${config.mock_url}/auth/login`, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      apikey: config.apiKey,
      tin: config.sellerTin,
    });

    const token = authResponse.data.data.accessToken;
    console.log("✅ Auth Success!");

    // Step 2: Test Withholding Receipt
    console.log("2. Registering Withholding Receipt...");
    const receiptData = {
      ReceiptNumber: "REC" + Date.now(), // Unique receipt number
      Reason: "Withholding tax for driver bonus payout",
      ReceiptCounter: "12345",
      ManualReceiptNumber: "98765",
      SourceSystemType: "ERP",
      SourceSystemNumber: "1KIDAA0H1F",
      InvoiceDetail: {
        InvoiceIRN:
          "4c484b18fb0770c9dc3290a4dd15999f8a682a7d79e5610d1d89bd79007c0d7d",
        Currency: "ETB",
        ExchangeRate: null,
      },
      WithholdDetail: {
        Type: "TWHT", // Total Withholding Tax
        Rate: null,
        PreTaxAmount: 10000,
        WithholdingAmount: 300, // 3% of 10,000
      },
    };

    const receiptResponse = await axios.post(
      `${config.mock_url}/v1/receipt/withholding`,
      receiptData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Receipt Success!");
    console.log("Status:", receiptResponse.status);
    console.log(
      "Response Body:",
      JSON.stringify(receiptResponse.data, null, 2)
    );
  } catch (error) {
    console.error("❌ Error during receipt test");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.log("Error Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
  }
}

testWithholdingReceipt();
