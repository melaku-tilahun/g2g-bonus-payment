const axios = require("axios");

const config = {
  mock_url: "http://core.mor.gov.et",
  clientId: "a8d87762-d96d-4dd0-95d1-01753dba5181",
  clientSecret: "0cc1a9ba-0f7d-44e1-bad2-0d136572794b",
  apiKey: "471555f9-6726-4786-9e53-f29f220819c3",
  sellerTin: "0000034558", // This is for LOGIN auth
};

async function runFullFlow() {
  console.log(
    "--- MOR EIMS Full Transaction Flow (Identity Match Attempt) ---"
  );

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

    // Step 2: Register Invoice
    console.log("\n2. 📄 Registering Invoice...");

    // Identity from token: 6666666666 / POS / B0360154BA
    const sellerIdentity = {
      tin: "6666666666",
      systemNumber: "B0360154BA",
      systemType: "POS",
    };

    const invoiceData = {
      BuyerDetails: {
        Tin: "0999930000",
        LegalName: "ABC Trading",
        Phone: "0912345678",
        IdType: "KID",
        City: "0",
        Region: "13",
        Wereda: "574",
      },
      DocumentDetails: {
        DocumentNumber: "44", // Expected by mock sequence
        Date: "2026-01-16T00:00:00",
        Type: "INV",
      },
      ItemList: [
        {
          LineNumber: 1,
          ProductDescription: "Driver Bonus Service",
          NatureOfSupplies: "service",
          ItemCode: "1111",
          Quantity: 1,
          Unit: "PCS",
          UnitPrice: 10000,
          PreTaxValue: 10000,
          TaxCode: "VAT15",
          TaxAmount: 1500,
          TotalLineAmount: 11500,
          Discount: 0,
          ExciseTaxValue: 0,
        },
      ],
      PaymentDetails: { Mode: "CASH", PaymentTerm: "IMMIDIATE" },
      ReferenceDetails: {
        PreviousIrn: "",
        RelatedDocument: null,
      },
      SellerDetails: {
        Tin: sellerIdentity.tin,
        LegalName: "ABC Trading PLC",
        Email: "accounting@company.com",
        Phone: "0911223344",
        Region: "13",
        VatNumber: "3215840010",
        Wereda: "574",
      },
      SourceSystem: {
        InvoiceCounter: 44, // Expected by mock sequence
        SystemNumber: sellerIdentity.systemNumber,
        SystemType: sellerIdentity.systemType,
      },
      TransactionType: "B2B",
      ValueDetails: {
        TotalValue: 11500,
        TaxValue: 1500,
        InvoiceCurrency: "ETB",
      },
      Version: "1",
    };

    const regRes = await axios.post(
      `${config.mock_url}/v1/register`,
      invoiceData,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const irn = regRes.data.body.irn;
    console.log("✅✅ Invoice Registered!");
    console.log("IRN:", irn);

    // Step 3: Register Withholding Receipt
    console.log("\n3. 💰 Registering Withholding Receipt...");
    const receiptData = {
      ReceiptNumber: "REC" + Date.now(),
      Reason: "Tax withholding for registered invoice",
      ReceiptCounter: "1",
      SourceSystemType: sellerIdentity.systemType,
      SourceSystemNumber: sellerIdentity.systemNumber,
      InvoiceDetail: {
        InvoiceIRN: irn,
        Currency: "ETB",
      },
      WithholdDetail: {
        Type: "TWHT",
        PreTaxAmount: 10000,
        WithholdingAmount: 300,
      },
    };

    const receiptRes = await axios.post(
      `${config.mock_url}/v1/receipt/withholding`,
      receiptData,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log("✅✅ Receipt Registered!");
    console.log("RRN:", receiptRes.data.body.rrn);
  } catch (error) {
    console.error("\n❌ Flow stopped with error");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.log("Details:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

runFullFlow();
