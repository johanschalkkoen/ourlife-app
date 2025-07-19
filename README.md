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
