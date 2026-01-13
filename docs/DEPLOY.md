# Deployment Guide for G2G Bonus Payment System

## Prerequisites

- **Node.js**: Version 14 or higher.
- **MySQL**: Version 8.0 or higher.
- **Git**: To clone the repository.

## Installation Steps

### 1. Clone the Repository

On your server, run:

```bash
git clone https://github.com/melaku-tilahun/g2g-bonus-payment.git
cd g2g-bonus-payment
```

### 2. Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and update it with your actual credentials:

```bash
cp .env.example .env
```

Edit the `.env` file:

```bash
nano .env
```

**Required settings:**

- `PORT`: 3000 (or your preferred port)
- `DB_HOST`: Your database host (e.g., localhost)
- `DB_USER`: Your MySQL username
- `DB_PASSWORD`: Your MySQL password
- `DB_NAME`: g2g_bonus_payment
- `JWT_SECRET`: A long random string for security

### 4. Setup Database

Login to MySQL and create the database:

```sql
CREATE DATABASE g2g_bonus_payment;
```

Then import the schema:

```bash
mysql -u your_username -p g2g_bonus_payment < src/config/schema.sql
```

### 5. Start the Application

To start the server:

```bash
npm start
```

The app should now be running at `http://your-server-ip:3000`.

### 6. Production Mode (Optional using PM2)

For a production server, it is recommended to use PM2 to keep the app running in the background:

```bash
npm install -g pm2
pm2 start server.js --name "g2g-payment"
pm2 save
pm2 startup
```

## Troubleshooting

- **Database Connection Error**: Double check your `.env` credentials.
- **Permission Denied**: Ensure the user has write permissions to the `Imports/` folder.
