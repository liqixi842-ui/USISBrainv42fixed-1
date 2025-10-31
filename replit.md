# Overview

USIS Brain is a minimal decision-making API service designed to process tasks and return structured analytical results in multiple languages (Chinese and Spanish). The service acts as a "brain" that receives task requests and provides market analysis conclusions with metadata including cost tracking, latency metrics, and categorization tags. Currently implemented as a proof-of-concept with simulated responses, the architecture is designed to eventually integrate multiple AI models for real decision-making capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Framework
- **Technology**: Node.js with Express.js (v5.1.0)
- **Module System**: CommonJS (using `require()` instead of ES modules)
- **Rationale**: CommonJS ensures maximum compatibility with Replit's runtime environment and traditional Node.js tooling

## API Design
- **Pattern**: RESTful JSON API
- **Endpoints**:
  - `GET /health` - Service health monitoring with timestamp
  - `POST /brain/decide` - Main decision-making endpoint
- **Response Structure**: Standardized format with versioning (`USIS.v1`), multilingual output, metadata tracking (cost, latency), and semantic tagging
- **Rationale**: Clean separation between health monitoring and business logic; structured responses enable easy integration with frontend systems and analytics

## Server Configuration
- **Port Binding**: Dynamic port allocation via `process.env.PORT || 3000`
- **Host**: Binds to `0.0.0.0` for external accessibility
- **Rationale**: Replit requires dynamic port binding from environment variables; `0.0.0.0` binding allows external HTTP access through Replit's proxy system

## Current Implementation Phase
- **Status**: Prototype/mockup phase
- **Decision Logic**: Returns hardcoded simulated responses
- **Design Decision**: Start with simple mock responses to validate API contract and integration patterns before adding AI model complexity
- **Future Direction**: Architecture designed to accommodate multi-model AI integration without breaking existing API contract

## Internationalization
- **Approach**: Built-in multilingual responses (Chinese `zh` and Spanish `es`)
- **Rationale**: Core requirement for international market analysis; embedded in response structure rather than separate i18n layer for simplicity

## Observability
- **Logging**: Console-based request logging with emoji markers for visual parsing
- **Metrics**: Response includes `latency_ms` and `cost.usd` fields for performance and cost tracking
- **Rationale**: Simple observability suitable for development phase; metrics structure supports future integration with monitoring systems

# External Dependencies

## Runtime Dependencies
- **express**: ^5.1.0 - Web application framework providing routing, middleware, and HTTP utilities

## Planned Integrations (Not Yet Implemented)
The architecture anticipates future integration with:
- AI/ML model APIs for actual decision-making logic
- Potential database for request/response logging and analytics
- External market data sources for real-time analysis

## Deployment Environment
- **Platform**: Replit
- **Constraints**: Must use dynamic port allocation and CommonJS module system
- **Network**: Relies on Replit's built-in HTTPS proxy for external access