# Patient Management System Frontend

<img width="367" alt="patient-management" src="https://github.com/user-attachments/assets/4b092d4f-14be-4a14-a247-14217c5ecc39" />

A modern React-based interface for healthcare management systems, featuring patient tracking, appointment scheduling, and medical reporting capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![React Version](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Vite Version](https://img.shields.io/badge/Vite-5.0.0-646CFF?logo=vite)

## 📦 Technology Stack

### Core Framework
- **React** 18.2 - Component-based architecture
- **Vite** 5.0 - Next-generation frontend tooling

### Styling & UI
- **Tailwind CSS** 3.3 - Utility-first CSS framework
- **React Icons** - Unified icon ecosystem

### Data Handling
- **Axios** 1.3 - Promise-based HTTP client
- **Zod** 3.21 - Type-safe schema validation
- **React Hook Form** 7.43 - Performant form management

## ✨ Key Features

### Patient Management
- Real-time patient lookup via mobile number
- Comprehensive profile management system
- Intelligent appointment scheduling with reminders
- Multi-step registration with validation

### Clinical Operations
- Dynamic medical consultation interface
- Vital signs tracking with visual indicators
- Prescription management system
- Medical history timeline

### Reporting & Analytics
- PDF report generation with templates
- Print-optimized consultation summaries
- Responsive data visualization
- Audit-ready record keeping

## 🛠️ Installation & Setup

```bash
# Clone repository
git clone https://github.com/Muneeb381a/paitient-prescription-frontend.git

# Navigate to project directory
cd patient_management_frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🏢 Per-clinic subdomain branding (optional)

The login page can greet a visitor by their clinic's name when it's opened
from that clinic's own subdomain (e.g. `greenvalley.yourapp.com`) instead of
the generic "Clinic Management" screen. It's inert by default — nothing
changes until you've done all of the below, and it never affects who can log
in as what; the account's `clinic_id` (set at login) is still the only real
tenant boundary. Turning it on:

1. **Own a real domain.** Wildcard subdomains don't work on Vercel's shared
   `*.vercel.app` domain — you need your own (e.g. `yourapp.com`).
2. **Add the domain in Vercel.** Project → Settings → Domains → add both
   `yourapp.com` and `*.yourapp.com` (the wildcard). Vercel shows you the DNS
   records to add at your registrar (typically an `A`/`ALIAS` record for the
   apex and a `CNAME` for `*`).
3. **Wait for DNS to propagate**, then confirm the wildcard domain shows
   "Valid Configuration" in Vercel.
4. **Set `VITE_APP_ROOT_DOMAIN=yourapp.com`** in the frontend's Vercel
   project env vars (see `.env.example`) and redeploy — this is a build-time
   var, so it only takes effect on the next build.
5. Give each clinic's `slug` (set when the platform admin creates the
   clinic — see `POST /api/platform/clinics` in the backend) a subdomain of
   its own: `<slug>.yourapp.com`.

That's it — no backend redeploy needed; `GET /api/public/clinics/by-slug/:slug`
already exists and is inert-safe to call from anywhere.
