# Contributing to DocuBot

Thank you for your interest in contributing to DocuBot! This document provides guidelines and information for contributors.

## 🚀 Quick Start

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/docubot.git
   cd docubot
   ```

2. **Install Dependencies**
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd ../frontend && npm install
   ```

3. **Environment Configuration**
   ```bash
   # Copy environment templates
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

4. **Database Setup**
   ```bash
   # Follow SUPABASE_SETUP.md for database configuration
   # Initialize ChromaDB
   cd backend && npm run chroma:init
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev

   # Terminal 3: ChromaDB
   chromadb run --host localhost --port 8000
   ```

## 📋 Development Workflow

### 1. Choose an Issue
- Check [GitHub Issues](https://github.com/yourusername/docubot/issues) for open tasks
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to indicate you're working on it

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Make Changes
- Follow the existing code style and patterns
- Write tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 4. Commit Changes
```bash
# Stage your changes
git add .

# Commit with conventional format
git commit -m "feat: add new feature description"
```

### 5. Push and Create Pull Request
```bash
# Push your branch
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
```

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

### Writing Tests
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database interactions
- **E2E Tests**: Test complete user workflows

Example test structure:
```javascript
// backend/test/example.test.js
const request = require('supertest');
const app = require('../index');

describe('API Endpoints', () => {
  test('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

## 📝 Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### React Components
- Use functional components with hooks
- Implement proper TypeScript interfaces
- Follow component naming conventions
- Use custom hooks for shared logic

### Backend Services
- Implement proper error handling
- Use async/await for asynchronous operations
- Follow RESTful API conventions
- Implement comprehensive logging

## 🔧 Architecture Guidelines

### Backend Structure
```
backend/
├── config/          # Configuration files
├── controllers/     # Route handlers
├── middleware/      # Express middleware
├── models/         # Data models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
└── tests/          # Test files
```

### Frontend Structure
```
frontend/
├── components/     # React components
├── pages/          # Next.js pages
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── styles/         # Global styles
└── types/          # TypeScript definitions
```

## 📚 Documentation

### API Documentation
- Update Swagger/OpenAPI specifications
- Document new endpoints with examples
- Include error responses and status codes

### Code Documentation
- Add JSDoc comments for functions
- Document complex algorithms
- Include usage examples

### User Documentation
- Update README.md for new features
- Add screenshots for UI changes
- Update setup instructions

## 🔒 Security Considerations

### Backend Security
- Validate all user inputs
- Implement proper authentication
- Use parameterized queries
- Implement rate limiting

### Frontend Security
- Sanitize user inputs
- Implement proper state management
- Use HTTPS in production
- Implement proper error boundaries

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are documented:
- Database credentials
- API keys
- JWT secrets
- External service URLs

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale services
docker-compose up -d --scale backend=3
```

## 📊 Performance Guidelines

### Backend Performance
- Implement caching for frequent queries
- Optimize database queries
- Use connection pooling
- Implement proper indexing

### Frontend Performance
- Code splitting for large bundles
- Image optimization
- Lazy loading for components
- Minimize re-renders

## 🤝 Communication

### GitHub Issues
- Use issue templates
- Provide clear descriptions
- Include reproduction steps for bugs
- Label issues appropriately

### Pull Requests
- Use PR templates
- Provide clear descriptions
- Reference related issues
- Request reviews from appropriate team members

### Code Reviews
- Review for functionality, style, and performance
- Provide constructive feedback
- Approve when requirements are met
- Request changes when needed

## 🎯 Best Practices

### General
- Write self-documenting code
- Follow DRY (Don't Repeat Yourself) principle
- Implement proper error handling
- Use version control best practices

### Git
- Write clear commit messages
- Use feature branches
- Rebase before merging
- Keep commits atomic

### Testing
- Write tests for new features
- Maintain test coverage above 80%
- Test edge cases and error conditions
- Use descriptive test names

## 📞 Getting Help

- **Documentation**: Check the [docs](./docs/) directory
- **Issues**: Search existing [GitHub Issues](https://github.com/yourusername/docubot/issues)
- **Discussions**: Use [GitHub Discussions](https://github.com/yourusername/docubot/discussions) for questions
- **Discord**: Join our [Discord community](https://discord.gg/docubot)

## 📜 License

By contributing to DocuBot, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DocuBot! Your efforts help make this project better for everyone. 🚀
