## Google Sheets integration setup

This project can send cart data directly to a Google Sheet from `booking.html` using Google Apps Script.

### 1) Create a Google Sheet

- Create a new sheet (for example: `Bookings`).
- Open **Extensions -> Apps Script**.

### 2) Paste Apps Script code

Replace code in Apps Script editor with:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bookings");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Bookings");
      sheet.appendRow([
        "createdAt",
        "dateFrom",
        "dateTo",
        "shifts",
        "customerName",
        "customerContact",
        "comment",
        "itemName",
        "qty",
        "pricePerShift",
        "lineTotal",
        "orderTotal",
      ]);
    }

    var payload = JSON.parse(e.postData.contents || "{}");
    var items = payload.items || [];
    var orderTotal = payload.total || 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      sheet.appendRow([
        payload.createdAt || "",
        payload.dateFrom || "",
        payload.dateTo || "",
        payload.shifts || "",
        payload.customerName || "",
        payload.customerContact || "",
        payload.comment || "",
        item.name || "",
        item.qty || 0,
        item.pricePerShift || 0,
        item.total || 0,
        orderTotal,
      ]);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, rows: items.length })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 3) Deploy Web App

- Click **Deploy -> New deployment**.
- Type: **Web app**.
- Execute as: **Me**.
- Who has access: **Anyone** (or Anyone with link).
- Copy the deployed Web App URL.

### 4) Update `booking.html`

In `<body ...>` update:

- `data-sheet-webapp-url` -> your Apps Script Web App URL
- `data-sheet-open-url` -> your Google Sheet URL

Example:

```html
<body
  class="booking-body"
  data-sheet-webapp-url="https://script.google.com/macros/s/XXXXXXXX/exec"
  data-sheet-open-url="https://docs.google.com/spreadsheets/d/YYYYYYYY/edit"
>
```

### 5) Test

- Add items in cart.
- Click `Открыть в XL`.
- Data should be appended as rows to `Bookings`.
- Browser opens your online sheet.
