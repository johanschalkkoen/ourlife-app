# OurLife Dashboard

Welcome to the **OurLife Dashboard**, a full-stack, single-page web application designed for personal and collaborative life management. It's a comprehensive tool for managing finances and schedules, making it ideal for individuals, couples, or families to stay organized and aligned.

---

## 🚀 Key Features

* **Financial Tracking**: Log income and expenses with ease. The application provides a detailed table view, a monthly budget calculator, and options to filter, search, and bulk-import transactions.
* **Integrated Calendar**: A shared, interactive calendar that automatically displays financial entries and allows users to add custom personal events. Events are color-coded based on user preference to easily distinguish entries.
* **User Management & Profiles**: Supports multiple users with secure authentication. Users can customize their profiles with a picture, contact details, and a personal event color.
* **Collaborative Data Sharing**: An admin user can grant themselves view-only access to the financial and calendar data of other users, making it perfect for household management.
* **Secure Communication**: The backend is configured to run exclusively over **HTTPS**, ensuring that all data transmitted between the client and server is encrypted. Passwords are securely hashed using `bcrypt`.

---

## 🚀 Change Logs
* **Rename all financial-related terms to "transactions" and update descriptions to relate to financial**
* **Rename Budget to Budget Calculator as it was intended originally**
* **Period Tracker to be added**
* **Re-instate add calendar from transactions and visa-vera this was somehow removed**
* **Add Google and Facebook authentication**
* **Add Administator secion - still not working**
* **Import Iphone of goole calendar entries to Our Life Calendar**
  
## 🛠️ Technology Stack

The application is built with a modern, full-stack architecture.

### Backend

* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: SQLite (for application data)
* **Authentication**: JSON file (`users.json`) with `bcrypt` for password hashing
* **Web Server**: HTTPS module with Let's Encrypt SSL certificates

### Frontend

* **Library**: React (via CDN)
* **HTTP Client**: Axios
* **Styling**: Tailwind CSS
* **Calendar**: FullCalendar.js

---

## ⚙️ How It Works

### Backend (`server.js`)

The server is the application's core, handling all business logic, data storage, and authentication.

* It serves the static `index.html` file and its assets from the `/public` folder.
* It exposes a RESTful API for all CRUD (Create, Read, Update, Delete) operations related to finances, calendar events, and user profiles.
* It manages user sessions and protects routes using authentication middleware.
* The `user_access` table in the SQLite database controls the data-sharing permissions between users.

### Frontend (`index.html`)

The frontend is a dynamic and responsive single-page application (SPA) that provides the entire user experience.

* It uses **React** to create a component-based UI, rendering different "pages" like Finances, Calendar, and Profile Settings without needing to reload the browser.
* **Axios** is used to make asynchronous API calls to the backend to fetch and manipulate data.
* State management is handled within React components using `useState` and `useEffect` hooks.
* The UI is fully responsive, adapting to different screen sizes from mobile to desktop, thanks to **Tailwind CSS** and custom media queries.

---

## 📋 Setup and Installation (Placeholder)

To set up and run this project locally, you will need Node.js and npm installed.

1.  **Clone the repository:**
    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install backend dependencies:**
    ```sh
    npm install
    ```
3.  **Configure Users:**
    * Create a `users.json` file in the root directory.
    * Add user objects with a `username`, `passwordHash` (use a bcrypt generator), and `isAdmin` boolean flag.
4.  **Configure SSL (Optional for Local Dev):**
    * The server is configured to look for SSL certificates in `/etc/letsencrypt/`. For local development, you may need to modify the `startServer` function to use a simpler `http` server.
5.  **Start the server:**
    ```sh
    node server.js
    ```
6.  **Access the application:**
    * Open your browser and navigate to `https://localhost:8443` (or the configured port).

---

## 🚀 Deployment with PM2 & Nginx

For production, it is recommended to use a process manager like **PM2** to keep the application services running and a reverse proxy like **Nginx** to handle incoming traffic securely and efficiently.

### 1. Run Application Services with PM2

These commands run the backend API and a static file server for the frontend as separate, managed processes.

* **Serve Frontend (Static Files):**
    This command starts a simple `http-server` to serve the static frontend files. It assumes `http-server` is installed globally (`npm install -g http-server`).
    ```sh
    pm2 start $(which http-server) --name ourlife-app-web -- -p 8080 -d /root/ourlife-app --watch --watch-delay 1000
    ```

* **Run Backend (API Server):**
    This command starts the Node.js backend server using PM2. It will watch for file changes and restart automatically.
    ```sh
    pm2 start --name ourlife-app-api-server /root/ourlife-app/server.js --watch --watch-delay 1000
    ```

### 2. Configure Nginx as a Reverse Proxy

Nginx sits in front of the application services. It listens for public web traffic on ports 80 and 443, handles SSL encryption, and forwards requests to the appropriate PM2 process.

* **Configuration file: `/etc/nginx/sites-enabled/ourlife.work.gd`**
    ```nginx
    server {
        listen 80;
        server_name ourlife.work.gd www.ourlife.work.gd;
        #return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name ourlife.work.gd www.ourlife.work.gd;

        ssl_certificate /etc/letsencrypt/live/ourlife.work.gd/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/ourlife.work.gd/privkey.pem;

        location / {
            proxy_pass [http://159.223.3.108:8080](http://159.223.3.108:8080);
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```
* **Architecture Note**: In this setup, Nginx forwards all root traffic (`/`) to the static frontend server running on port `8080`. For the frontend to communicate with the backend API (running on port `8443`), you must either use the full API URL (`https://ourlife.work.gd:8443/api/...`) in the frontend code or add another `location /api/ { ... }` block in Nginx to proxy API requests to the backend service.

---

## 📜 License

This project is unlicensed and is for demonstration purposes only.
