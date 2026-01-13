# Role-Based Access Control (RBAC) Documentation

This document outlines the permission levels and access rights for each user role within the Driver Bonus System.

## Role Hierarchy
1. **Admin**: Superuser with full system access.
2. **Director**: High-level strategic access, financial controls, and audit visibility.
3. **Manager**: Operational oversight, driver management, and reporting.
4. **Auditor**: Compliance monitoring, reporting, and read-only access to specific records.
5. **Staff**: Basic operational access (Driver verification input).

---

## Detailed Permissions Matrix

### 1. Driver Management
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Driver List** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Driver Details** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Verify Driver (Standard)** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Admin Override (No TIN)** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Block/Unblock Driver** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Generate Statements** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Add Debt** | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2. Financial & Payments
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Pending Payments** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Export Payment List** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Reconcile Payments** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **70% Partial Payout** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Batch Management (View)**| ✅ | ✅ | ✅ | ❌ | ❌ |
| **Mark Batch Paid** | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3. Reporting & Compliance
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Advanced Search** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Compliance Reports** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tax Reports** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Analytics Dashboard** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Debt Analytics** | ✅ | ✅ | ✅ | ❌ | ❌ |

### 4. System Administration
| Feature | Admin | Director | Manager | Auditor | Staff |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **User Management** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audit Trail / Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **System Health** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **File Uploads** | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Specific Implementation Details

### Director Access Updates
*   **Audit Trail**: Full access to User Activity, Security Events, and Heatmaps.
*   **Verification**: Can use "Admin Override" to verify drivers without TIN validation.
*   **Payments**: Can authorize "Partial Payouts" (70%) for unverified drivers.
*   **Batches**: Can view batches AND mark them as "Paid".

### Manager Access Updates
*   **Search**: Full access to "Advanced Search" including user filtering.
*   **Verification**: Can use "Admin Override" to verify drivers without TIN.
*   **Batches**: Can view batches but **CANNOT** mark them as "Paid" (Read-only).
*   **Blocking**: Can block and unblock drivers;

### Auditor Access Updates
*   **Compliance**: Restored access to "Regulatory & Compliance" page for tax reporting.
*   **Statements**: Can generate PDF statements for any driver from the Driver Detail page.
*   **Search**: Can use "Advanced Search" to find drivers.
*   **Restrictions**: Strictly blocked from "Uploads", "Exporting Payments" (Excel), and "Reconciling".
