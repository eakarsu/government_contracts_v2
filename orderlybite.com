server {
    listen 443 ssl http2;
    server_name nonprofit.orderlybite.com;
    ssl_certificate /etc/letsencrypt/live/orderlybite.com-0001/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/orderlybite.com-0001/privkey.pem; # managed by Certbot

    
    location / {
        proxy_pass http://localhost:5004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

}

server {
    listen 443 ssl http2;
    server_name contracts.orderlybite.com;
    ssl_certificate /etc/letsencrypt/live/orderlybite.com-0003/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/orderlybite.com-0003/privkey.pem; # managed by Certbot


    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }


}

server {
    listen 443 ssl http2;
    server_name insurance.orderlybite.com;
    ssl_certificate /etc/letsencrypt/live/orderlybite.com-0002/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/orderlybite.com-0002/privkey.pem; # managed by Certbot


    location / {
        proxy_pass http://localhost:5005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }


}

server {
    if ($host = www.orderlybite.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    if ($host = orderlybite.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name orderlybite.com www.orderlybite.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;




}

server {
    listen 443 ssl http2;
    server_name orderlybite.com www.orderlybite.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/orderlybite.com-0003/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/orderlybite.com-0003/privkey.pem; # managed by Certbot
    
    # Root directory where your built React app is located
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # API proxy to your Docker container
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    location /sms {
    proxy_pass http://localhost:5003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    }

    location /voice {
    proxy_pass http://localhost:5003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    }

    location /token {
        proxy_pass http://localhost:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }


    access_log /var/log/nginx/orderlybite.com.access.log;
    error_log /var/log/nginx/orderlybite.com.error.log;






}



