# Deploy Atlas to 7chen.online

This repo is ready to deploy as one Docker Compose stack:

- `app`: Go API, SQLite persistence, and the built React/Vite frontend
- `caddy`: public reverse proxy with automatic HTTPS for `7chen.online`

## 1. Point DNS to your server

In your domain DNS panel, create:

```text
Type  Name  Value
A     @     <your-server-public-ip>
A     www   <your-server-public-ip>
```

If your DNS provider supports CNAME flattening, `www` may also be:

```text
CNAME www  7chen.online
```

Wait for DNS propagation before starting Caddy, otherwise Let's Encrypt may fail.

## 2. Prepare the server

On an Ubuntu server:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

Open firewall ports if needed:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## 3. Upload or clone the project

Option A: clone from GitHub:

```bash
git clone <your-repo-url> atlas
cd atlas
```

Option B: copy the local folder with `rsync`:

```bash
rsync -av --exclude .git --exclude node_modules --exclude frontend/dist ./ user@<your-server-public-ip>:~/atlas
ssh user@<your-server-public-ip>
cd ~/atlas
```

## 4. Configure production secret

Create `.env` on the server:

```bash
openssl rand -hex 32
```

Copy the generated value:

```bash
cat > .env <<'EOF'
JWT_SECRET=<paste-generated-secret-here>
EOF
```

## 5. Start the site

```bash
docker compose up -d --build
```

Caddy will request and renew HTTPS certificates automatically.

## 6. Verify

```bash
docker compose ps
curl -I https://7chen.online
curl https://7chen.online/api/health
```

Open:

```text
https://7chen.online
```

Demo login:

```text
test1@gmail.com
cp2106
```

## Updating later

```bash
git pull
docker compose up -d --build
```

## Useful logs

```bash
docker compose logs -f app
docker compose logs -f caddy
```
