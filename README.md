# Champions Club 🎾🏏

A modern sports club management and omnichannel operations platform designed for tennis and cricket facilities. Built with Next.js, TypeScript, Tailwind CSS, and Prisma ORM.

---

## ✨ Features

- **Front Desk & Membership CRM:** Manage multi-tier memberships (Gold, Silver, Junior), automated tier-based discounts, member directory, and lead conversion pipeline.
- **Court Booking Engine:** Real-time scheduling for tennis and cricket courts, slot reservation, social play coordination, and walk-in vs. member dynamic pricing.
- **Pro Gear Shop POS:** In-store and online merchandise ordering, real-time inventory management, stock threshold alerts, and seamless member checkout.
- **Bar, Lounge & Kitchen Display (KDS):** Table management, running tabs, kitchen order queues with real-time status transitions (`Preparing` → `Ready` → `Served`).
- **Financial Analytics & Transactions:** Unified ledger aggregating court bookings, pro shop sales, and bar tabs with breakdown by payment method and category.
- **Staff & HR Management:** Shift scheduling, roster tracking, and leave requests.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) & [Prisma ORM 6](https://www.prisma.io/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Containerization:** Docker & Docker Compose

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18.17+ or v20+)
- [Docker](https://www.docker.com/) & Docker Compose
- `npm` or your preferred package manager

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd champions-club
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:password123@localhost:5433/champions_club?schema=public"
```

### 3. Start Database Service

Start the local PostgreSQL container via Docker Compose:

```bash
docker compose up -d
```

### 4. Database Setup & Seeding

Apply the Prisma schema migrations and populate initial seed data:

```bash
npx prisma db push
npm run prisma:seed # or: npx tsx prisma/seed.ts
```

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server |
| `npm run build` | Compiles production build |
| `npm run start` | Launches production server |
| `npm run lint` | Runs ESLint analysis |
| `npx prisma studio` | Opens Prisma Studio to inspect database records |
| `npx prisma db push` | Synchronizes database schema with `schema.prisma` |

---

## 📁 Project Structure

```text
champions-club/
├── prisma/
│   ├── schema.prisma       # Database schema & relations
│   └── seed.ts             # Initial seed data script
├── public/                 # Static assets & icons
├── src/
│   ├── app/                # Next.js App Router (pages & API routes)
│   │   ├── api/            # REST API endpoints (members, courts, bar, etc.)
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Dashboard & live operations view
│   ├── components/         # Modular UI & scene components
│   └── lib/                # Utility helpers & Prisma client singleton
├── docker-compose.yml      # Local PostgreSQL container configuration
└── package.json            # Project manifest & dependencies
```

---

## 📄 License

This project is private and proprietary.
