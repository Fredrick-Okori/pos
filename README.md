# Krug POS System

A Point of Sale system for managing daily sales reports built with Next.js and Supabase.

## Features

### Employee Dashboard
- Enter daily sales reports
- Record payment methods (Airtel Money, MTN Mobile Money, Visa Card)
- Track complementaries and discounts
- Add multiple expenses per day
- Record unpaid bills with customer information
- View calculation summaries in real-time
- Access historical reports

### Admin Dashboard
- View all employee reports
- Filter by employee and date range
- See summary statistics and totals
- Edit any report with tracking
- Add comments to reports
- Track payment method breakdown
- Monitor unpaid bills and expenses

## Getting Started

### Prerequisites
- Node.js 18+ installed
- A Supabase account

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd krug.com
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project at https://supabase.com
   - Go to Project Settings → API to get your URL and anon key

3. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database:**
   - Go to your Supabase Dashboard → SQL Editor
   - Copy the SQL from `SUPABASE_SETUP.md` and run it

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open the app:**
   Visit http://localhost:3000

### Creating Users

1. **Create an employee account:**
   - Go to /register and sign up
   - By default, new users are employees

2. **Create a superadmin:**
   - Sign up a new user through /register
   - In Supabase SQL Editor, run:
     ```sql
     UPDATE public.profiles SET role = 'superadmin' WHERE email = 'admin@example.com';
     ```

## Project Structure

```
src/
├── app/
│   ├── admin/
│   │   └── dashboard/     # Admin dashboard page
│   ├── employee/
│   │   └── dashboard/     # Employee dashboard page
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page (redirects)
├── components/
│   ├── Navbar.tsx         # Navigation component
│   └── ProtectedRoute.tsx # Auth protection wrapper
├── contexts/
│   └── AuthContext.tsx    # Authentication context
├── lib/
│   └── supabase.ts        # Supabase client
└── types/
    └── index.ts           # TypeScript types
```

## Database Schema

- **profiles** - User profiles with roles (employee/superadmin)
- **daily_reports** - Daily sales reports with payment breakdown
- **expenses** - Expenses linked to daily reports
- **unpaid_bills** - Unpaid customer bills linked to daily reports

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Date Handling:** date-fns
- **Notifications:** react-hot-toast
# pos
