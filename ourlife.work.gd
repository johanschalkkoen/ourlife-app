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
