---
project: CYMATE
type: Epic
summary: Prog Epic 7 — PostgreSQL Database
assignee: M065136
priority: High
fields:
  customfield_10003: PostgreSQL Database Infrastructure
labels:
  - postgres
  - schema
  - migration
  - database
  - epic-7
description: |
  Implement PostgreSQL database infrastructure with proper schema organization and migration support. This epic establishes the data persistence layer for all APIs with appropriate schema separation and version control capabilities.
acceptance: |
  - Given the PostgreSQL database infrastructure needs to be established, when the Docker container is created and configured, then it runs successfully and serves database connections on the standard PostgreSQL port.
  - Given API data persistence requirements, when APIs connect to the database, then all data persists correctly under appropriate schemas with proper isolation between different API domains.
  - Given schema evolution requirements, when migration scripts are created for each API, then database schema changes can be applied consistently across environments with rollback capabilities.
  - Given the patch_api and upgrade_api schema requirements, when the fixed_vulnerability tables are created, then they follow the specified schema structure (patch_api.fixed_vulnerability, upgrade_api.fixed_vulnerability).
  - Given operational requirements, when database monitoring and backup processes are configured, then database health metrics are available and data recovery procedures are documented and tested.
---

# Prog Epic 7 — PostgreSQL Database

**Component:** Database  
**Assignee:** Mark - Luke

## Epic Overview
Establish a robust PostgreSQL database infrastructure to provide persistent data storage for all API services. This foundational component ensures proper schema organization, migration support, and reliable data persistence with appropriate separation between different API domains.

## Stories Included

### Story 1: Containerize PostgreSQL Database
**Acceptance Criteria:**
- PostgreSQL container runs successfully and accepts connections
- Database is properly configured with performance optimizations
- Container includes necessary extensions and configurations
- Health checks verify database readiness and connection availability
- Persistent volume mounting ensures data durability across container restarts

### Story 2: Add Migration Scripts for Each API
**Acceptance Criteria:**
- Migration framework is established with version control
- Each API has dedicated migration scripts for schema management
- Migration scripts support both forward and rollback operations
- Database schema versions are tracked and auditable
- Migration execution is idempotent and environment-agnostic

### Story 3: Schema Organization and API-Specific Tables
**Acceptance Criteria:**
- patch_api.fixed_vulnerability table is created with proper structure
- upgrade_api.fixed_vulnerability table is created with proper structure
- Schema separation provides logical isolation between API domains
- Foreign key relationships and constraints are properly defined
- Indexing strategy optimizes query performance for expected access patterns

## Technical Requirements
- **Database Engine:** PostgreSQL 15+ with appropriate extensions
- **Schema Structure:** Separate schemas for each API (patch_api, upgrade_api, etc.)
- **Migration Support:** Flyway or similar migration tool integration
- **Connection Pooling:** pgBouncer or built-in connection management
- **Backup Strategy:** Automated backup and recovery procedures
- **Monitoring:** Database performance metrics and health monitoring

## Success Metrics
- 99.9% database uptime
- Sub-50ms query response times for standard operations
- Zero data loss during migrations
- Successful schema evolution without downtime
- Automated backup verification and recovery testing

## Dependencies
- Docker infrastructure
- API service containers
- Migration tooling (Flyway/Liquibase)
- Monitoring and alerting systems

## Example Schema Structure
```sql
-- patch_api schema
CREATE SCHEMA IF NOT EXISTS patch_api;
CREATE TABLE patch_api.fixed_vulnerability (
    id SERIAL PRIMARY KEY,
    vulnerability_id VARCHAR(255) NOT NULL,
    patch_version VARCHAR(100) NOT NULL,
    fixed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity_level VARCHAR(50),
    description TEXT
);

-- upgrade_api schema  
CREATE SCHEMA IF NOT EXISTS upgrade_api;
CREATE TABLE upgrade_api.fixed_vulnerability (
    id SERIAL PRIMARY KEY,
    vulnerability_id VARCHAR(255) NOT NULL,
    upgrade_version VARCHAR(100) NOT NULL,
    fixed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity_level VARCHAR(50),
    description TEXT
);
```

## Traceability
- Component: Database
- Epic: Prog Epic 7
- Priority: High
- Labels: postgres, schema, migration, database