# BizFlow Jamaica — Version 1

A lightweight first working prototype for Jamaican small businesses to create invoices, quotations and receipts.

## Run it in VS Code

1. Download and unzip `bizflow-jamaica.zip`.
2. Open the `bizflow-jamaica` folder in VS Code.
3. Open `index.html` in your browser. Recommended: install the **Live Server** extension in VS Code, right-click `index.html`, then choose **Open with Live Server**.
4. Open **Business settings** first and enter your business details.
5. Select **Create document**, choose Invoice / Quotation / Receipt, add customer details and line items, then save.
6. Open the saved document and choose **Print / Save PDF**. In the print dialog, select **Save as PDF**.

No Node.js installation or build step is required for this prototype.

## What's included

- Responsive business dashboard.
- Invoices, quotations and receipts.
- Multiple line items with automatic subtotal, tax and total calculations.
- JMD and USD currency display.
- Business profile settings.
- Document search and type filters.
- Customer list derived from saved documents.
- Browser local storage persistence.
- Print-ready document previews and PDF export through the browser.
- A proposed Pro plan screen; no payment collection is enabled.

## Important prototype limitations

- Data is stored in the current browser on the current device only. Clearing browser data can erase it.
- There is no login, cloud sync, team access, server backup, or cross-device access yet.
- The Pro plan and J$1,000/month price are illustrative only. No subscriptions or payments are processed.
- Tax is a user-entered percentage. This app does not determine the correct tax treatment or provide tax advice. Confirm applicable Jamaican tax requirements with a qualified accountant or Tax Administration Jamaica before using it for formal tax records.
- This prototype is not a substitute for a compliant accounting or tax system. Keep independent backups of important business records.

## Suggested next development stage

1. Add authentication and a hosted database (e.g. Supabase).
2. Add per-user data isolation, server-side validation, backups and secure access rules.
3. Add a subscription provider only after confirming a provider that can onboard the business and pay out in Jamaica.
4. Add subscription entitlements and enforce limits on the server.
5. Add tested invoice numbering, payment status, recurring invoices, and export/backup tools.
6. Review privacy, security, consumer, and Jamaican tax obligations before public launch.
