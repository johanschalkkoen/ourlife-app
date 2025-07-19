OurLife Website
Project Overview
OurLife is a platform designed to empower professionals with transparent workplace reviews and career resources. This repository contains the front-end and back-end code for the website, starting with the homepage. The goal is to create a user-friendly, responsive, and accessible site that encourages community engagement and informed career decisions.
Homepage Wireframe
The homepage is structured to prioritize usability, engagement, and trust. Below is the wireframe layout for a modern, single-column design optimized for desktop and mobile.
Header (Sticky)

Logo: Top-left, clickable (150x50px, e.g., "OurLife").
Navigation: Top-right, horizontal links: "Home", "Reviews", "Resources", "About", "Submit Review". Hamburger menu on mobile.
Primary CTA: "Share Your Review" button (contrasting color, e.g., blue).
Search Icon: Magnifying glass for quick access to search functionality.

Hero Section

Background: Subtle workplace image with text overlay.
Headline: "Discover Transparent Workplace Reviews" (H1, 32px, sans-serif, e.g., Roboto).
Subheadline: "Read and share honest reviews to make informed career decisions" (18px).
CTAs:
Primary: "Browse Reviews" (links to reviews page).
Secondary: "Submit a Review" (links to submission form).


Stats Bar: Trust signals (e.g., "10,000+ Reviews", "500+ Companies").

Featured Reviews Section

Title: "Top Workplace Reviews" (H2, 24px).
Content: Carousel/grid of 3–4 review cards (1 on mobile, 3 on desktop).
Card: Company name, star rating (1–5), 100-char excerpt, "Read More" link.


CTA: "View All Reviews" button.

Resources Section

Title: "Career Resources & Tools" (H2, 24px).
Content: Grid of 3 cards (e.g., "Salary Calculator", "Career Quiz", "Interview Tips").
Card: Icon/image, title, short description, "Explore" link.


CTA: "See All Resources" button.

Call-to-Action Banner

Background: Contrasting color (e.g., light gray).
Text: "Join our community to shape better workplaces!" (18px).
CTA: "Get Started" button (links to sign-up/submission).
Visual: Small icon (e.g., handshake).

Footer

Links: Columns for "About Us", "Contact", "Privacy Policy", "Terms".
Social Icons: LinkedIn, X, etc.
Newsletter: Email input with "Subscribe" button.
Copyright: "© 2025 OurLife. All rights reserved."

Design Specifications

Colors: Navy blue, white, light gray, teal accent.
Typography: Open Sans (body), Montserrat (headings).
Accessibility: WCAG 2.1 AA, alt text, keyboard navigation.
Responsive: Media queries for mobile (stacked), tablet (2-column), desktop (3-column).
Performance: Image optimization (<200KB), lazy loading, minified CSS/JS.

Getting Started
Prerequisites

OS: Ubuntu 24.10 (or compatible Linux distribution).
Node.js: Version 18.x or later (for http-server and server.js).
pm2: Process manager for Node.js applications.
Nginx: Web server for reverse proxy and SSL.
Git: For cloning the repository.
Certbot: For Let’s Encrypt SSL certificates.

Installation
1. Clone the Repository
git clone https://github.com/username/ourlife-app.git
cd ourlife-app

2. Install Node.js and npm
On Ubuntu 24.10, install Node.js and npm:
sudo apt update
sudo apt install -y nodejs npm

3. Install pm2
Install pm2 globally to manage the web and API servers:
sudo npm install -g pm2

4. Install http-server
Install http-server for serving the front-end:
sudo npm install -g http-server

5. Install Project Dependencies
If the project has a package.json for the API server, install its dependencies:
npm install

6. Install and Configure Nginx
Install Nginx to act as a reverse proxy and handle SSL:
sudo apt install -y nginx

Create an Nginx configuration file for ourlife.work.gd:
sudo nano /etc/nginx/sites-available/ourlife.work.gd

Add the following configuration:
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
        proxy_pass http://159.223.3.108:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

Enable the configuration by linking it:
sudo ln -s /etc/nginx/sites-available/ourlife.work.gd /etc/nginx/sites-enabled/

Test the Nginx configuration:
sudo nginx -t

Restart Nginx to apply changes:
sudo systemctl restart nginx

7. Install Certbot for SSL
Install Certbot to obtain Let’s Encrypt SSL certificates:
sudo apt install -y certbot python3-certbot-nginx

Obtain and install SSL certificates for ourlife.work.gd and www.ourlife.work.gd:
sudo certbot --nginx -d ourlife.work.gd -d www.ourlife.work.gd

Follow the prompts to configure SSL. This will update the Nginx configuration to enable HTTPS and store certificates in /etc/letsencrypt/live/ourlife.work.gd/.
8. Run the Application
Use the provided startup.sh script to start both the web server (port 8080) and API server:
chmod +x startup.sh
./startup.sh

This runs:

http-server on port 8080, serving the front-end from /root/ourlife-app with live reloading (--watch --watch-delay 1000).
The Node.js API server (server.js) with live reloading.

9. Access the Site
Open a browser and navigate to https://ourlife.work.gd (SSL-enabled) or http://159.223.3.108:8080 (direct, non-SSL).
Notes

Ensure port 80 and 443 are open in your firewall for Nginx:sudo ufw allow 80
sudo ufw allow 443


The Nginx configuration proxies requests to http://159.223.3.108:8080. Update proxy_pass if using a different IP or port.
The commented return 301 in the port 80 block suggests HTTP-to-HTTPS redirection is disabled. Uncomment it to enforce HTTPS after testing.
Renew Let’s Encrypt certificates automatically by setting up a cron job:sudo crontab -e

Add: 0 0 * * * certbot renew --quiet

Implementation

Tech Stack: HTML, CSS (Tailwind CSS), JavaScript (front-end); Node.js (back-end, server.js); Nginx (reverse proxy, SSL).
Tools: Figma/Canva for mockups, Google Fonts, Unsplash for images.
SEO: Meta tags, schema markup for reviews.

Next Steps

Add backend logic for review submissions and search in server.js.
Implement analytics (e.g., Google Analytics).
Test accessibility with WAVE or Lighthouse.

Contributing
See CONTRIBUTING.md for guidelines.

Built with transparency and community in mind.
