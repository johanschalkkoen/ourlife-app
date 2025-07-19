OurLife Website

Overview
OurLife is a platform that empowers professionals with transparent workplace reviews and career resources. This repository contains the front-end and back-end code for the website, starting with a modern, responsive homepage. The goal is to foster community engagement and informed career decisions through an accessible, user-friendly interface.
Homepage Wireframe
The homepage prioritizes usability, engagement, and trust with a single-column layout optimized for desktop and mobile.
Header (Sticky)

Logo: Top-left, clickable (150x50px, e.g., "OurLife").
Navigation: Top-right, links: Home, Reviews, Resources, About, Submit Review. Hamburger menu on mobile.
Primary CTA: "Share Your Review" button (e.g., blue).
Search Icon: Magnifying glass for search functionality.

Hero Section

Background: Subtle workplace image with text overlay.
Headline: "Discover Transparent Workplace Reviews" (H1, 32px, Roboto).
Subheadline: "Read and share honest reviews to make informed career decisions" (18px).
CTAs:
Primary: "Browse Reviews" (links to reviews).
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
Card: Icon/image, title, description, "Explore" link.


CTA: "See All Resources" button.

Call-to-Action Banner

Background: Light gray.
Text: "Join our community to shape better workplaces!" (18px).
CTA: "Get Started" button (links to sign-up/submission).
Visual: Icon (e.g., handshake).

Footer

Links: About Us, Contact, Privacy Policy, Terms.
Social Icons: LinkedIn, X.
Newsletter: Email input with "Subscribe" button.
Copyright: "© 2025 OurLife. All rights reserved."

Design Specifications

Colors: Navy blue, white, light gray, teal accent.
Typography: Open Sans (body), Montserrat (headings).
Accessibility: WCAG 2.1 AA, alt text, keyboard navigation.
Responsive: Mobile (stacked), tablet (2-column), desktop (3-column).
Performance: Images <200KB, lazy loading, minified CSS/JS.

Getting Started
Prerequisites

OS: Ubuntu 24.10 (or compatible Linux).
Node.js: v18.x or later (for http-server and server.js).
pm2: Node.js process manager.
Nginx: Reverse proxy and SSL.
Git: For cloning.
Certbot: For Let’s Encrypt SSL.

Installation

Clone the Repository
git clone https://github.com/username/ourlife-app.git
cd ourlife-app


Install Node.js and npm
sudo apt update
sudo apt install -y nodejs npm


Install pm2
sudo npm install -g pm2


Install http-server
sudo npm install -g http-server


Install Project DependenciesIf a package.json exists for the API server:
npm install


Install and Configure NginxInstall Nginx:
sudo apt install -y nginx

Create the Nginx configuration:
sudo nano /etc/nginx/sites-available/ourlife.work.gd

Add:
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

Enable the configuration:
sudo ln -s /etc/nginx/sites-available/ourlife.work.gd /etc/nginx/sites-enabled/

Test and restart Nginx:
sudo nginx -t
sudo systemctl restart nginx


Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

Obtain SSL certificates:
sudo certbot --nginx -d ourlife.work.gd -d www.ourlife.work.gd

Follow prompts to enable HTTPS.

Run the Application
chmod +x startup.sh
./startup.sh

Runs:

http-server on port 8080 (front-end, live reloading).
server.js (Node.js API, live reloading).


Access the SiteVisit https://ourlife.work.gd (SSL) or http://159.223.3.108:8080 (non-SSL).


Notes

Open ports 80 and 443:sudo ufw allow 80
sudo ufw allow 443


Update proxy_pass if using a different IP/port.
Uncomment return 301 in the Nginx port 80 block for HTTPS redirection in production.
Automate certificate renewal:sudo crontab -e

Add: 0 0 * * * certbot renew --quiet

Implementation

Tech Stack: HTML, CSS (Tailwind CSS), JavaScript; Node.js (server.js); Nginx.
Tools: Figma/Canva, Google Fonts, Unsplash.
SEO: Meta tags, schema markup for reviews.

Next Steps

Add backend logic in server.js for reviews and search.
Integrate analytics (e.g., Google Analytics).
Test accessibility with WAVE or Lighthouse.

Contributing
See CONTRIBUTING.md for details.
License
MIT License

Built with transparency and community in mind.
