server {
    listen 80;
    listen [::]:80;
    server_name todo.acuerdalo.cl;

    access_log /var/log/nginx/todo.acuerdalo.cl.access.log;
    error_log  /var/log/nginx/todo.acuerdalo.cl.error.log;

    client_max_body_size 25m;

    # subida de versiones de publicaciones: videos grandes, sin bufferizar en nginx y directo al
    # backend (4100), sin pasar por el proxy de Next, que corta en 10 MB y guarda el cuerpo en memoria
    location ~ ^/api/publications/[^/]+/versions$ {
        client_max_body_size 500m;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:4101;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
