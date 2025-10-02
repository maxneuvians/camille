# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Camille, please report it by emailing the maintainer or opening a confidential security advisory on GitHub.

**Please do NOT open a public issue for security vulnerabilities.**

### What to Include

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix timeline: Depends on severity

## Security Best Practices

### API Key Security

**Never commit API keys to the repository!**

The application stores OpenAI API keys in the browser's localStorage. For production:

1. Consider implementing server-side API key management
2. Use environment variables for server-side keys
3. Rotate keys regularly
4. Monitor API usage for anomalies

### Data Privacy

Conversations are stored locally in `backend/src/data/conversations.json`. This includes:
- User speech transcriptions
- Agent responses
- Timestamps

**Important considerations:**
- This data may contain sensitive information
- Implement proper access controls in production
- Consider encryption at rest
- Comply with GDPR/privacy regulations in your jurisdiction

### WebSocket Security

The application proxies WebSocket connections to OpenAI. Ensure:
- Use WSS (secure WebSocket) in production
- Validate conversation IDs
- Implement rate limiting
- Add authentication for production use

### CORS Configuration

The backend allows CORS for development. For production:
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://your-domain.com',
  credentials: true
}));
```

### Input Validation

Always validate and sanitize:
- Theme IDs
- Conversation IDs
- API request parameters
- User-provided data

### Dependency Security

Run security audits regularly:
```bash
npm audit
npm audit fix
```

Consider using:
- Dependabot for automated dependency updates
- Snyk or similar tools for vulnerability scanning

## Known Security Considerations

### 1. Client-Side API Key Storage
- **Risk**: API keys stored in browser localStorage
- **Mitigation**: For production, implement server-side key management
- **Status**: Acceptable for development/demo

### 2. No Authentication
- **Risk**: Anyone with URL access can use the application
- **Mitigation**: Add authentication layer in production
- **Status**: Designed for internal use

### 3. JSON File Storage
- **Risk**: File-based storage not suitable for production scale
- **Mitigation**: Migrate to database with proper access controls
- **Status**: Acceptable for development/demo

### 4. No Rate Limiting
- **Risk**: Potential for abuse/DoS
- **Mitigation**: Implement rate limiting middleware
- **Status**: Should be added before production use

### 5. OpenAI API Exposure
- **Risk**: Direct OpenAI API access through proxy
- **Mitigation**: Add usage limits, logging, and monitoring
- **Status**: Monitor usage closely

## Security Enhancements Roadmap

Priority improvements for production deployment:

1. **High Priority**
   - [ ] Add authentication and authorization
   - [ ] Implement rate limiting
   - [ ] Add request logging and monitoring
   - [ ] Encrypt sensitive data at rest
   - [ ] Move API keys to server-side

2. **Medium Priority**
   - [ ] Add CSRF protection
   - [ ] Implement session management
   - [ ] Add audit logging
   - [ ] Set security headers (helmet.js)
   - [ ] Input validation middleware

3. **Low Priority**
   - [ ] Add penetration testing
   - [ ] Implement CSP headers
   - [ ] Add security scanning to CI/CD
   - [ ] Regular security audits

## Secure Configuration Examples

### Production Backend Configuration

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
  optionsSuccessStatus: 200
}));
```

### Environment Variables

```env
# Never commit these values!
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=https://your-domain.com
SESSION_SECRET=your-session-secret
DATABASE_URL=postgresql://...
```

## Contact

For security concerns, contact:
- Email: [Your security email]
- GitHub Security Advisory: [Enable on your repo]

Thank you for helping keep Camille secure!
