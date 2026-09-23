# Night Jatra Ticket System - Admin Panel (Next.js)

An enterprise ticketing, Box Office POS counter, and gate access management system built for Night Jatra cultural drama festivals and theatrical opera events.

---

## 🚀 Getting Started

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run start
```

---

## 🛠️ Tech Stack & Features

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS + Plus Jakarta Sans typography + Custom Scrollbars
- **Charts & Visualization**: Chart.js + `react-chartjs-2`
  - Ticket Sales Overview Multi-Line Chart (dual axis for volume & revenue in ₹K)
  - Ticket Types Doughnut Chart with center counter
  - Booking Channels Doughnut Chart (Online vs Counter)
- **Icons**: Lucide React
- **Animations & FX**: Canvas Confetti for ticket admissions & bookings

---

## 📦 Key Modules

1. **Executive Dashboard**:
   - Top 5 Key KPI Stats Cards with live trend indicators
   - Ticket Sales overview graphs & category distributions
   - Gate Entry summaries with real-time occupancy load bars
   - Recent Bookings list with instant receipt actions
   - Quick Action buttons & Dark Blue summary footer strip

2. **Events Directory**:
   - Production schedules, multi-date management, venues, capacity bars, active/upcoming filters, and "Create New Event" modal.

3. **Ticket Categories & Pricing**:
   - Manage General, Premium, VIP, and VVIP tiers with live quota adjustments, price tags, perks checklists, and dedicated gate entries.

4. **Bookings & Transactions**:
   - Search by booking ID, customer name, or phone.
   - Filter by Online/Counter and status.
   - Export CSV audit spreadsheets.

5. **POS Counter Ticket Sales**:
   - Fast counter booking dialog with customer details, tier selector, quantity spinner, Cash/UPI/Card toggles, and instant receipt generation.

6. **Gate Scanner & Turnstiles**:
   - Live turnstile simulator and camera viewfinder for validating QR codes and bar codes with confetti feedback and gate admission logging.

7. **Thermal Slip & Receipt Printing**:
   - Formatted printable thermal tickets (80mm / 58mm) with high-resolution QR codes, gate instructions, and customer details.

8. **Financial Reports & Counter Reconciliation**:
   - Cash-in-hand vs UPI vs Online split, box office drawer summaries, and audit ledgers.
