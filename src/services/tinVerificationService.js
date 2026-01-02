const axios = require("axios");
const https = require("https");

/**
 * TIN Verification Service
 * Integrates with Ethiopian Ministry of Revenue API to verify business licenses
 */
class TINVerificationService {
  constructor() {
    this.baseURL = "https://app.etrade.gov.et";
    this.timeout = 30000; // 30 seconds

    // Create HTTPS agent with SSL verification disabled
    // Note: This is required for the Ministry of Revenue API
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
  }

  /**
   * Lookup business information by TIN
   * @param {string} tin - Tax Identification Number
   * @returns {Promise<Object>} Business information
   */
  async lookupTIN(tin) {
    if (!tin || typeof tin !== "string") {
      throw new Error("Invalid TIN provided");
    }

    // Clean TIN (remove spaces, special characters)
    const cleanTIN = tin.trim().replace(/[^0-9]/g, "");

    if (cleanTIN.length === 0) {
      throw new Error("TIN cannot be empty");
    }

    const url = `${this.baseURL}/api/Registration/GetRegistrationInfoByTin/${cleanTIN}/en`;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "application/json, text/plain, */*",
      Referer: `${this.baseURL}/business-license-checker?tin=${cleanTIN}`,
      Origin: this.baseURL,
    };

    try {
      console.log(`[TIN Service] Fetching data for TIN: ${cleanTIN}...`);

      const response = await axios.get(url, {
        headers,
        timeout: this.timeout,
        httpsAgent: this.httpsAgent,
      });

      const data = response.data;

      if (!data || !data.Businesses || data.Businesses.length === 0) {
        throw new Error("No business found for this TIN");
      }

      // Extract manager information from associates
      const associates = data.AssociateShortInfos || [];
      const associate = associates.length > 0 ? associates[0] : null;
      const managerName = associate
        ? associate.ManagerNameEng || associate.ManagerName || "N/A"
        : "N/A";
      const managerPhoto = associate ? associate.Photo : null;

      // Get the first business (most relevant)
      const business = data.Businesses[0];

      // Format the result
      const result = {
        tin: data.Tin,
        regNo: data.RegNo,
        regDate: data.RegDate,
        businessName: data.BusinessName,
        businessNameAmh: data.BusinessNameAmh,
        managerName: managerName,
        managerPhoto: managerPhoto,
        tradeName: business.TradesName || business.TradeNameAmh || "N/A",
        licenceNumber: business.LicenceNumber || "N/A",
        paidUpCapital: data.PaidUpCapital,
        // Extract activities/subgroups
        activities: (business.SubGroups || [])
          .filter((sg) => sg !== null)
          .map((sg) => sg.Description || sg),
      };

      console.log(
        `[TIN Service] Successfully fetched data for TIN: ${cleanTIN}`
      );
      return result;
    } catch (error) {
      console.error(
        `[TIN Service] Error fetching TIN ${cleanTIN}:`,
        error.message
      );

      if (error.response) {
        // API returned an error response
        if (error.response.status === 404) {
          throw new Error("Business not found for this TIN");
        } else if (error.response.status === 500) {
          throw new Error("Ministry of Revenue API is currently unavailable");
        } else {
          throw new Error(`API Error: ${error.response.status}`);
        }
      } else if (error.code === "ECONNABORTED") {
        throw new Error(
          "Request timeout - Ministry of Revenue API is not responding"
        );
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        throw new Error("Cannot connect to Ministry of Revenue API");
      } else {
        throw new Error(error.message || "Failed to verify TIN");
      }
    }
  }

  /**
   * Validate TIN format (basic validation)
   * @param {string} tin - Tax Identification Number
   * @returns {boolean} True if format is valid
   */
  validateTINFormat(tin) {
    if (!tin || typeof tin !== "string") {
      return false;
    }

    const cleanTIN = tin.trim().replace(/[^0-9]/g, "");

    // Ethiopian TIN is typically 10 digits
    return cleanTIN.length >= 8 && cleanTIN.length <= 12;
  }
}

module.exports = new TINVerificationService();
