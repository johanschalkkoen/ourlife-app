#!/bin/bash

# Ensure script runs from the correct directory
if [ "$(pwd)" != "/root/ourlife.work.gd" ]; then
    echo "Error: Script must be run from /root/ourlife.work.gd"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null)
if [[ ! $NODE_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Node.js not installed or invalid version"
    exit 1
fi

# Check PM2 installation
if ! command -v pm2 >/dev/null 2>&1; then
    echo "Error: PM2 not installed"
    exit 1
fi

# Log file for debugging
LOG_FILE="/root/ourlife.work.gd/restart.log"
echo "Restart script started at $(date)" >> "$LOG_FILE"

# Update git repository
echo "Pulling latest changes from git..." >> "$LOG_FILE"
git pull >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Git pull failed" | tee -a "$LOG_FILE"
    exit 1
fi

# Apply database schema updates
echo "Applying database schema updates..." >> "$LOG_FILE"
node fix-schema.js >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Database schema update failed" | tee -a "$LOG_FILE"
    exit 1
fi

# Stop existing PM2 processes
echo "Stopping existing PM2 processes..." >> "$LOG_FILE"
pm2 delete ourlife-work-gd-app-web >> "$LOG_FILE" 2>&1 || true
pm2 delete ourlife-work-gd-app-api-server >> "$LOG_FILE" 2>&1 || true

# Reload Nginx
echo "Reloading Nginx..." >> "$LOG_FILE"
systemctl restart nginx >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Nginx reload failed" | tee -a "$LOG_FILE"
    exit 1
fi

# Clean npm cache
echo "Cleaning npm cache..." >> "$LOG_FILE"
npm cache clean --force >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: npm cache clean failed" | tee -a "$LOG_FILE"
    exit 1
fi

# Small delay to ensure processes are stopped
sleep 2

# Start PM2 processes
echo "Starting web server..." >> "$LOG_FILE"
pm2 start "$(which http-server)" --name ourlife-work-gd-app-web -- -p 8080 -d . >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to start web server" | tee -a "$LOG_FILE"
    exit 1
fi

echo "Starting API server..." >> "$LOG_FILE"
pm2 start prd-server.js --name ourlife-work-gd-app-api-server >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to start API server" | tee -a "$LOG_FILE"
    exit 1
fi

# Save PM2 process list
echo "Saving PM2 process list..." >> "$LOG_FILE"
pm2 save >> "$LOG_FILE" 2>&1

echo "Restart completed successfully at $(date)" >> "$LOG_FILE"
exit 0
