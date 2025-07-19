# OurLife Website

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/username/ourlife-app)](https://github.com/username/ourlife-app/issues)

## Overview

OurLife is a platform for workplace reviews and career resources, built with a user-friendly, responsive interface. This repository contains front-end (HTML, CSS, JavaScript) and back-end (Node.js, Express) code for the website, starting with the homepage.

## Homepage Wireframe

The homepage uses a single-column layout, optimized for desktop and mobile.

### Header (Sticky)

- Logo: Top-left, clickable (150x50px, "OurLife").
- Navigation: Top-right links: `Home`, `Reviews`, `Resources`, `About`, `Submit Review`. Hamburger menu on mobile.
- CTA: "Share Your Review" button (blue).
- Search Icon: Magnifying glass for search.

### Hero Section

- Background: Workplace image with overlay.
- Headline: "Discover Transparent Workplace Reviews" (H1, 32px, Roboto).
- Subheadline: "Share and read reviews for career decisions" (18px).
- CTAs:
  - "Browse Reviews" (links to reviews).
  - "Submit a Review" (links to form).
- Stats: "10,000+ Reviews", "500+ Companies".

### Featured Reviews Section

- Title: "Top Workplace Reviews" (H2, 24px).
- Content: 3–4 review cards (1 on mobile, 3 on desktop).
  - Card: Company name, 1–5 stars, 100-char excerpt, "Read More".
- CTA: "View All Reviews".

### Resources Section

- Title: "Career Resources & Tools" (H2, 24px).
- Content: 3 cards (e.g., "Salary Calculator", "Career Quiz", "Interview Tips").
  - Card: Icon, title, description, "Explore" link.
- CTA: "See All Resources".

### Call-to-Action Banner

- Background: Light gray.
- Text: "Join our community to shape workplaces!" (18px).
- CTA: "Get Started" (sign-up/submission).
- Icon: Handshake.

### Footer

- Links: `About Us`, `Contact`, `Privacy Policy`, `Terms`.
- Social: LinkedIn, X.
- Newsletter: Email input, "Subscribe" button.
- Copyright: "© 2025 OurLife."

### Design Specs

- Colors: Navy blue, white, light gray, teal.
- Typography: Open Sans (body), Montserrat (headings).
- Accessibility: WCAG 2.1 AA, alt text, keyboard navigation.
- Responsive: Mobile (stacked), tablet (2-column), desktop (3-column).
- Performance: Images <200KB, lazy loading, minified CSS/JS.

## Getting Started

### Prerequisites

- OS: Ubuntu 24.10.
- Node.js: v18.x or later (v20.16.0 recommended).
- pm2: Process manager.
- Nginx: Reverse proxy and SSL.
- Git: For cloning.
- Certbot: For Let’s Encrypt SSL.

### Installation

1. **Clone Repository**

   ```bash
   git clone https://github.com/username/ourlife-app.git
   cd ourlife-app

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

## 🚀 Deployment with PM2

For production, it is recommended to use a process manager like **PM2** to keep the application running. The following commands demonstrate a possible deployment strategy where the backend API and frontend are run as separate processes.

1.  **Serve Frontend (Static Files):**
    This command starts a simple `http-server` to serve the static frontend files. It assumes `http-server` is installed globally (`npm install -g http-server`).
    ```sh
    pm2 start $(which http-server) --name ourlife-app-web -- -p 8080 -d /root/ourlife-app --watch --watch-delay 1000
    ```

2.  **Run Backend (API Server):**
    This command starts the Node.js backend server using PM2. It will watch for file changes and restart automatically.
    ```sh
    pm2 start --name ourlife-app-api-server /root/ourlife-app/server.js --watch --watch-delay 1000
    ```

***Note***: *This deployment configuration runs the frontend on port `8080` and the backend on the ports defined in `server.js` (e.g., `8443`). You must ensure your frontend API calls in `index.html` point to the correct backend address and port.*

---

## 📜 License

This project is unlicensed and is for demonstration purposes only.
