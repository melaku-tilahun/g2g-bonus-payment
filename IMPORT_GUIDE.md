# Excel Import System Guide

## Expected Excel File Structure
The system expects an `.xlsx` file with a single sheet. The first row should contain the headers. The system uses "fuzzy matching" so headers are case-insensitive and can slight variations, but sticking to the standard names is best.

### Required Columns
These columns **must** be present in the Excel file.

| Header Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **ID** | Text | The unique driver ID. | `DRV001` |
| **Full Name** | Text | The driver's full name. | `John Doe` |
| **Date** | Date/Text | The week date for the payment. All rows must have the same date. | `2023-01-01` |
| **Net Payout** | Number | The base payout amount. | `5000.00` |
| **Work terms** | Text | Character value describing terms. | `Premium` |
| **Status** | Text | Character value describing status. | `Active` |
| **Balance** | Number | Driver's balance. | `150.00` |
| **Payout** | Number | Actual payout amount. | `4850.00` |
| **Bank fee** | Number | Fee associated with the transfer. | `15.00` |

### Optional Columns
| Header Name | Type | Description |
| :--- | :--- | :--- |
| **Phone Number** | Text | Driver's phone number (used for new driver creation). |

---

## Processing Logic & Calculations

When the file is uploaded, the system performs the following calculations automatically based on the **Net Payout** provided in the file. These values are **calculated by the system**, so you do not need to include them in the Excel file.

### 1. Gross Payout
- **Formula**: `Net Payout / 0.97`
- **Description**: Gross amount assuming Net Payout is 97% of the total.
- **Example**: If Net Payout is `1000`, Gross Payout will be `1030.93`.

### 2. Withholding Tax
- **Condition**: Only applies if **Gross Payout > 3000**.
- **Formula**: 
    - If Gross > 3000: `Gross Payout - Net Payout`
    - If Gross <= 3000: `0`
- **Example A (High Payout)**:
    - Net: `5000`
    - Gross: `5154.64`
    - **Withholding**: `154.64`
- **Example B (Low Payout)**:
    - Net: `1000`
    - Gross: `1030.93`
    - **Withholding**: `0`

---

## Validation Rules
The import will be **rejected** if:
1.  **Multiple Sheets**: The file has more than one sheet.
2.  **Missing Columns**: Any of the required columns are missing.
3.  **Invalid Numbers**: `Net Payout`, `Balance`, `Payout`, or `Bank fee` contain non-numeric values.
4.  **Inconsistent Dates**: Different rows have different dates.
5.  **Duplicate Import**: A successful import for the same `Date` already exists in the system (to prevent double payment).
