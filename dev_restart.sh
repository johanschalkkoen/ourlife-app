#!/bin/bash

# Check if current directory is /root/ourlife.run.place
if [ "$(pwd)" = "/root/ourlife.run.place" ]; then
    echo "Working in correct directory"
    
    # Update git repository
    git pull || { echo "Git pull failed"; exit 1; }
    
    # Stop existing PM2 processes if they exist
    pm2 delete ourlife-run-place-app-web 2>/dev/null || true
    pm2 delete ourlife-run-place-app-api-server 2>/dev/null || true
    
    # Reload nginx
    systemctl restart nginx || { echo "Nginx reload failed"; exit 1; }
    
    # Clean npm cache
    npm cache clean --force || { echo "NPM cache clean failed"; exit 1; }
    
    # Small delay to ensure processes are stopped
    sleep 2
    
    # Start PM2 processes
    pm2 start "$(which http-server)" --name ourlife-run-place-app-web -- -p 8081 -d . || { echo "Failed to start web server"; exit 1; }
    pm2 start --name ourlife-run-place-app-api-server server.js || { echo "Failed to start API server"; exit 1; }
else
    echo "Error: Script must be run from /root/ourlife.run.place"
    exit 1
fi

exit 0
