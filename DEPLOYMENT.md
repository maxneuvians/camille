# Deployment Guide

This guide covers deploying Camille to various hosting platforms.

## Prerequisites

- Built application (`npm run build`)
- OpenAI API key
- Node.js 18+ runtime on the server

## Environment Variables

### Backend
```env
PORT=3001                    # Server port (default: 3001)
NODE_ENV=production          # Set to production
```

### Frontend
At build time, configure:
```env
VITE_API_BASE=https://your-api-domain.com/api
VITE_WS_BASE=wss://your-api-domain.com
```

## Deployment Options

### Option 1: Single Server (Simple)

Deploy both frontend and backend on the same server.

**Steps:**

1. Build the application:
```bash
npm run build
```

2. Install production dependencies only:
```bash
cd backend
npm install --production
```

3. Start the backend:
```bash
cd backend
NODE_ENV=production node dist/index.js
```

4. Serve the frontend with the backend (using Express static):

Add to `backend/src/index.ts`:
```typescript
import path from 'path';

// After other routes
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
```

### Option 2: Separate Deployments (Recommended)

#### Backend Deployment

**Heroku:**
```bash
# In backend directory
heroku create camille-api
heroku config:set NODE_ENV=production
git push heroku main
```

**DigitalOcean/AWS/GCP:**
1. Upload `backend/dist` and `backend/package.json`
2. Run `npm install --production`
3. Start with: `node dist/index.js`
4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/index.js --name camille-backend
pm2 save
pm2 startup
```

**Docker:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY backend/dist ./dist
COPY backend/src/data ./src/data

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

#### Frontend Deployment

**Netlify:**
```bash
cd frontend
netlify deploy --prod --dir=dist
```

Or connect your GitHub repo and configure:
- Build command: `npm run build:frontend`
- Publish directory: `frontend/dist`

**Vercel:**
```bash
cd frontend
vercel --prod
```

**AWS S3 + CloudFront:**
```bash
cd frontend/dist
aws s3 sync . s3://your-bucket-name
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

**Nginx (Self-hosted):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/camille/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /realtime {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### Option 3: Docker Compose

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    volumes:
      - ./backend/src/data:/app/src/data
    restart: unless-stopped

  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
    restart: unless-stopped
```

**Deploy:**
```bash
docker-compose up -d
```

## SSL/TLS Configuration

WebSocket connections require HTTPS in production. Use Let's Encrypt:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

Update nginx config for SSL:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... rest of config
}
```

## Monitoring and Logs

### PM2 Monitoring
```bash
pm2 monit
pm2 logs camille-backend
pm2 status
```

### Application Logs
The backend logs to stdout. Capture with:
```bash
# With PM2
pm2 logs camille-backend --lines 100

# With Docker
docker logs -f container-name

# Manual redirect
node dist/index.js >> /var/log/camille.log 2>&1
```

## Database Migration

Currently uses JSON file storage. For production with multiple instances, consider:

1. **PostgreSQL**: Best for structured data
2. **MongoDB**: Good for flexible document storage  
3. **Redis**: For session and cache data

Migration path:
1. Implement new DataService adapters
2. Add database connection configuration
3. Migrate existing conversation data
4. Update deployment scripts

## Performance Optimization

### Backend
- Enable compression: `app.use(compression())`
- Add caching headers for static assets
- Implement rate limiting
- Use clustering for multi-core systems

### Frontend
- Enable gzip/brotli compression on server
- Add CDN for static assets
- Implement code splitting
- Add service worker for offline support

## Health Checks

The backend includes a health endpoint: `GET /api/health`

Configure load balancer health checks:
- Path: `/api/health`
- Expected status: 200
- Expected response: `{"status":"ok"}`

## Backup and Recovery

### Conversation Data
```bash
# Backup
tar -czf backup-$(date +%Y%m%d).tar.gz backend/src/data/conversations.json

# Restore
tar -xzf backup-YYYYMMDD.tar.gz -C /path/to/restore
```

### Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

## Scaling Considerations

### Horizontal Scaling
- Use sticky sessions for WebSocket connections
- Share conversation data via database
- Consider message queue for async tasks

### Vertical Scaling
- Monitor memory usage (WebSocket connections)
- Adjust Node.js memory limits: `node --max-old-space-size=4096`

## Security Checklist

- [ ] Use HTTPS/WSS in production
- [ ] Set appropriate CORS policies
- [ ] Implement rate limiting
- [ ] Validate and sanitize all inputs
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Implement authentication if needed
- [ ] Add request logging for audit
- [ ] Configure firewall rules
- [ ] Regular security updates

## Troubleshooting Production Issues

### WebSocket Connection Fails
- Verify firewall allows WebSocket traffic
- Check SSL certificate is valid
- Ensure load balancer supports WebSocket
- Verify CORS settings

### High Memory Usage
- Check for WebSocket connection leaks
- Monitor audio buffer accumulation
- Implement connection timeouts

### Slow Response Times
- Add database indexes
- Implement caching
- Use CDN for static assets
- Optimize bundle size

## Cost Optimization

### OpenAI API Costs
- Monitor API usage per conversation
- Set usage limits in OpenAI dashboard
- Implement conversation timeout
- Cache common responses if applicable

### Infrastructure Costs
- Use auto-scaling based on load
- Implement proper caching
- Use spot instances for non-critical workloads
- Monitor and optimize resource usage

## Support

For deployment issues, check:
1. GitHub Issues
2. Documentation
3. Server logs
4. Health check endpoint
