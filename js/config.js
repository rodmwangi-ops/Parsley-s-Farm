// ============================================================
// PARSLEY'S FARM — Configuration (Supabase)
// ============================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://xezqlemnvimgdbcnofyx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlenFsZW1udmltZ2RiY25vZnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTAwMTgsImV4cCI6MjA4ODg4NjAxOH0.nFKPtnpEPGWOVTFg0wXbANOOSsZPd1FV1T-ShSgnd-w',

  // Supabase table name mapping (JS store name → Supabase table)
  TABLES: {
    beds: 'beds',
    sales: 'sales',
    harvests: 'harvests',
    expenses: 'expenses',
    activities: 'activities',
    creditPayments: 'credit_payments',
    crops: 'crops'
  },

  // Allowed users (Google emails)
  ALLOWED_USERS: [
    'rodmwangi@gmail.com',
    'lonahwanjama13@gmail.com',
    'levywanke@gmail.com',
    'abeljoel507@gmail.com',
    'kisuzaj@gmail.com'
  ],

  // Admin users (can see Matumizi/Expenses)
  ADMIN_USERS: [
    'rodmwangi@gmail.com'
  ],

  // Farm hands for quick selection
  FARM_HANDS: ['Rod', 'Joel', 'Joshua'],

  // Matumizi PIN
  EXPENSES_PIN: '5689',

  // App version
  VERSION: '5.0.0'
};
