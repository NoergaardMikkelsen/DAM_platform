# DAM Platform

A Digital Asset Management (DAM) platform built with Next.js, TypeScript, and Supabase.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- **Supabase account** (for database and authentication)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd DAM_platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory with the following **required** variables:

```env
# REQUIRED: Supabase Configuration (minimum to run the app)
NEXT_PUBLIC_SUPABASE_URL=findes i ekstramateriale
NEXT_PUBLIC_SUPABASE_ANON_KEY=findes i ekstramateriale

# REQUIRED: Supabase Service Role Key (needed for storage usage API and user auth updates)
SUPABASE_SERVICE_ROLE_KEY=findes i ekstramateriale
```

**Optional variables** (only needed for specific features):

```env
# OPTIONAL: Database Connection (only needed if you want to run migrations locally)
# DATABASE_URL=findes i ekstramateriale
# OR
# SUPABASE_DB_URL=findes i ekstramateriale
# OR
# POSTGRES_HOST=findes i ekstramateriale
# POSTGRES_USER=findes i ekstramateriale
# POSTGRES_PASSWORD=findes i ekstramateriale
# POSTGRES_DATABASE=findes i ekstramateriale

# OPTIONAL: Adobe Fonts (only needed for landing page fonts)
# ADOBE_FONTS_API_TOKEN=findes i ekstramateriale
```


Start the development server:

```bash
npm run dev
```

The application will be available at following: `http://localhost:3000` or `http://admin.localhost:3000` or `http://nmic.localhost:3000` or `http://bhj.localhost:3000`

**Bemærk:** Login-oplysninger for superadmin og user konti findes i ekstramateriale eller på forside m formalia i rapporten.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run migrate` - Run migrations via Supabase client
- `npm run migrate:execute` - Execute migrations directly to database
- `npm run migrate:record` - Record a migration as executed
- `npm run migrate:new` - Run new migrations