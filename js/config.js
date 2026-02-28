// ============================================================
// PARSLEY'S FARM — Configuration
// Fill in these values after completing SETUP.md steps
// ============================================================

const CONFIG = {
  // Google OAuth Client ID (from Google Cloud Console)
  // Step: SETUP.md → Section 2
  GOOGLE_CLIENT_ID: '376556459731-0njjva4bl5uol1vl0s1m9mcogjs1ebs0.apps.googleusercontent.com',

  // Google Sheet ID (from the spreadsheet URL)
  // The part between /d/ and /edit in the URL
  // e.g. https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
  SHEET_ID: '1cr7EAKGgMm3MWepOWisiqoYmMYi5UB0oHH2Dax3q7NQ',

  // Sheets API base URL
  SHEETS_API: 'https://sheets.googleapis.com/v4/spreadsheets',

  // Sheet tab names
  TABS: {
    BEDS: 'Beds',
    SALES: 'Sales',
    HARVESTS: 'Harvests',
    EXPENSES: 'Expenses',
    ACTIVITIES: 'Activities',
    CREDIT_PAYMENTS: 'CreditPayments',
    CROPS: 'Crops'
  },

  // Allowed users (Google emails)
  ALLOWED_USERS: [
    'rodmwangi@gmail.com'
    'lonahwanjama13@gmail.com'
    'levywanke@gmail.com'
    // Add Joel and Joshua's emails when they have Google accounts
  ],

  // Admin users (can see Matumizi/Expenses)
  ADMIN_USERS: [
    'rodmwangi@gmail.com'
  ],

  // Farm hands for quick selection
  FARM_HANDS: ['Rod', 'Joel', 'Joshua'],

  // Matumizi PIN
  EXPENSES_PIN: '5689',

  // Sync interval (ms) — how often to push/pull data
  SYNC_INTERVAL: 60000, // 1 minute

  // App version
  VERSION: '3.1.0'
};
