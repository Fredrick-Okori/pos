# Krug POS System - Supabase Setup Instructions

## Environment Variables
Create a `.env.local` file with:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Schema Setup
Run this SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users profile table
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily reports table
CREATE TABLE public.daily_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    report_date DATE NOT NULL,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    airtel_money DECIMAL(12, 2) DEFAULT 0,
    mtn_money DECIMAL(12, 2) DEFAULT 0,
    visa_card DECIMAL(12, 2) DEFAULT 0,
    complementaries DECIMAL(12, 2) DEFAULT 0,
    discounts DECIMAL(12, 2) DEFAULT 0,
    cash_at_hand DECIMAL(12, 2) GENERATED ALWAYS AS (
        total_sales - airtel_money - mtn_money - visa_card - complementaries - discounts
    ) STORED,
    admin_comment TEXT,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_by UUID REFERENCES public.profiles(id),
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, report_date)
);

-- Create expenses table
CREATE TABLE public.expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unpaid bills table
CREATE TABLE public.unpaid_bills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
    customer_name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unpaid_bills ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is superadmin (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN user_role = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Profiles policies (use single combined policy to avoid recursion)
CREATE POLICY "Users can view profiles" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR public.is_superadmin()
    );

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Superadmins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_superadmin());

CREATE POLICY "Superadmins can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.is_superadmin());

-- Daily reports policies
CREATE POLICY "Employees can view own reports" ON public.daily_reports
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Employees can insert own reports" ON public.daily_reports
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can update own reports" ON public.daily_reports
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all reports" ON public.daily_reports
    FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can update all reports" ON public.daily_reports
    FOR UPDATE USING (public.is_superadmin());

-- Expenses policies
CREATE POLICY "Users can manage own expenses" ON public.expenses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.daily_reports WHERE id = report_id AND user_id = auth.uid())
    );

CREATE POLICY "Superadmins can view all expenses" ON public.expenses
    FOR SELECT USING (public.is_superadmin());

-- Unpaid bills policies
CREATE POLICY "Users can manage own unpaid bills" ON public.unpaid_bills
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.daily_reports WHERE id = report_id AND user_id = auth.uid())
    );

CREATE POLICY "Superadmins can view all unpaid bills" ON public.unpaid_bills
    FOR SELECT USING (public.is_superadmin());

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_daily_reports_user_id ON public.daily_reports(user_id);
CREATE INDEX idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX idx_expenses_report_id ON public.expenses(report_id);
CREATE INDEX idx_unpaid_bills_report_id ON public.unpaid_bills(report_id);
```

## Creating a Superadmin User
After running the schema, create a superadmin by:
1. Sign up a new user through the app
2. Run this SQL to make them superadmin:
```sql
UPDATE public.profiles SET role = 'superadmin' WHERE email = 'admin@example.com';
```
