# Box Cricket - Admin & User Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [User Registration & Login](#user-registration--login)
3. [Becoming an Admin](#becoming-an-admin)
4. [Admin Dashboard Features](#admin-dashboard-features)
5. [CRUD Operations](#crud-operations)
6. [Database Structure](#database-structure)

---

## Overview

Box Cricket is a ground booking application that allows users to:
- Browse available cricket grounds
- Book grounds for specific time slots
- Manage their bookings

Admins can:
- View all users, bookings, and grounds
- Manage booking status and payment status
- Add, edit, and delete grounds

---

## User Registration & Login

### Sign Up (New Users)
1. Navigate to `/auth` or click "Login / Sign Up"
2. Click "Don't have an account? Sign up"
3. Fill in:
   - **Full Name**: Your complete name
   - **Phone Number**: 10-15 digit phone number (e.g., 9876543210)
   - **Email**: Valid email address
   - **Password**: Minimum 6 characters
4. Click "Sign Up"

### Login (Existing Users)
1. Navigate to `/auth`
2. Enter your email and password
3. Click "Login"

---

## Becoming an Admin

**Important**: Admin roles are stored in the `user_roles` table for security. You cannot self-assign admin privileges through the UI.

### Method 1: Using Backend Database (Recommended)

1. First, create a regular user account through the signup form
2. Access your backend database:
   - Click "View Backend" in Lovable
   - Navigate to Database → Tables → user_roles
3. Insert a new record:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('YOUR_USER_ID', 'admin');
   ```
4. To find your user_id:
   - Go to Database → Tables → profiles
   - Find your email and copy the `id` field

### Method 2: SQL Query

Run this SQL in the database:

```sql
-- First, find your user ID from the profiles table
SELECT id, full_name FROM profiles WHERE full_name = 'Your Name';

-- Then insert the admin role
INSERT INTO user_roles (user_id, role)
VALUES ('paste-user-id-here', 'admin');
```

### Verify Admin Access

1. Log out and log back in
2. Click on your avatar in the top-right corner
3. You should see "Admin Dashboard" option in the dropdown

---

## Admin Dashboard Features

Access the admin dashboard at `/admin` (only visible to admin users).

### Dashboard Overview
- **Total Users**: Count of registered users
- **Total Bookings**: Count of all bookings
- **Active Grounds**: Count of active booking grounds
- **Total Revenue**: Sum of all booking amounts

### Tabs

#### 1. Bookings Tab
View and manage all bookings:
- **User Email**: Who made the booking
- **Ground**: Which ground was booked
- **Date & Time**: Booking schedule
- **Status**: Active, Completed, Cancelled, Expired
- **Payment Status**: Paid or Unpaid
- **Amount**: Total booking cost

**Actions**:
- Update booking status (dropdown)
- Update payment status (dropdown)
- Delete booking (trash icon)

#### 2. Users Tab
View all registered users:
- **Name**: User's full name
- **Email**: User's email address
- **Phone**: Contact number
- **Joined**: Registration date

#### 3. Grounds Tab
Manage cricket grounds:
- **Name**: Ground name
- **Location**: Address/location
- **Price/Hour**: Hourly rate
- **Status**: Active or Inactive

**Actions**:
- Add new ground (+ button)
- Edit ground (pencil icon)
- Delete ground (trash icon)

---

## CRUD Operations

### Grounds Management

#### Create a Ground
1. Go to Admin → Grounds tab
2. Click "Add Ground" button
3. Fill in:
   - Name (required)
   - Location
   - Description
   - Price per Hour (required)
   - Image URL
   - Active status
4. Click "Add Ground"

#### Update a Ground
1. Find the ground in the list
2. Click the pencil/edit icon
3. Modify the fields
4. Click "Update Ground"

#### Delete a Ground
1. Find the ground in the list
2. Click the trash/delete icon
3. Confirm deletion

### Booking Management

#### Update Booking Status
1. Go to Admin → Bookings tab
2. Find the booking
3. Use the Status dropdown to change to:
   - Active
   - Completed
   - Cancelled
   - Expired

#### Update Payment Status
1. Find the booking
2. Use the Payment dropdown to change to:
   - Paid
   - Unpaid

#### Delete a Booking
1. Find the booking
2. Click the trash icon
3. Confirm deletion

---

## Database Structure

### Tables

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | User ID (linked to auth.users) |
| full_name | text | User's full name |
| phone_number | text | Contact number |
| created_at | timestamp | Registration date |

#### `user_roles`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Record ID |
| user_id | uuid | User ID |
| role | app_role | 'admin' or 'user' |

#### `grounds`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Ground ID |
| name | text | Ground name |
| location | text | Address |
| description | text | Details |
| price_per_hour | numeric | Hourly rate |
| image_url | text | Image link |
| is_active | boolean | Active status |

#### `bookings`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Booking ID |
| user_id | uuid | Who booked |
| ground_id | uuid | Which ground |
| booking_date | date | Date of booking |
| start_time | time | Start time |
| end_time | time | End time |
| hours | integer | Duration |
| total_amount | numeric | Total cost |
| status | booking_status | Booking status |
| payment_status | payment_status | Payment status |

---

## Security Notes

1. **Admin roles are server-verified**: The app checks admin status from the database, not from localStorage or client-side storage.

2. **Row Level Security (RLS)**: All tables have RLS policies that ensure:
   - Users can only see their own bookings
   - Only admins can see all data
   - Grounds are publicly visible (for browsing)

3. **Password Security**: Passwords are hashed by Supabase Auth and never stored in plain text.

---

## Quick Reference

| Action | Route | Access |
|--------|-------|--------|
| Home | `/` | Public |
| About | `/about` | Public |
| Contact | `/contact` | Public |
| Login/Signup | `/auth` | Public |
| Booking | `/booking` | Logged-in users |
| My Bookings | `/my-bookings` | Logged-in users |
| Admin Dashboard | `/admin` | Admins only |

---

## Troubleshooting

### "I can't see the Admin Dashboard"
- Make sure you're logged in
- Verify your user has the 'admin' role in user_roles table
- Log out and log back in after adding the role

### "Forms are not accepting my input"
- Phone: Use 10-15 digits, can include +, spaces, dashes
- Email: Must be a valid email format
- Password: Minimum 6 characters

### "I get a 404 after login"
- This is fixed - you should be redirected to home page automatically
- If issues persist, clear browser cache and try again
