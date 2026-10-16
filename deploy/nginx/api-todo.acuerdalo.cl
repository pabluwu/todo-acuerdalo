server {
    listen 80;
    listen [::]:80;
    server_name api-todo.acuerdalo.cl;

    access_log /var/log/nginx/api-todo.acuerdalo.cl.access.log;
    error_log  /var/log/nginx/api-todo.acuerdalo.cl.error.log;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
