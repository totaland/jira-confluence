---
project: CYMATE
type: Story
summary: Create cybermate-api Repository in Bitbucket
assignee: M060883
priority: High
epic: CYMATE-75
labels:
  - repository-setup
  - backend
  - infrastructure
acceptance: |
  - Given Bitbucket workspace access, when creating a new repository, then the repository **cybermate-api** is created successfully.
  - Given the repository is created, when viewing it in Bitbucket, then the default branch is **main** and the repository is accessible.
---

# Create cybermate-api Repository in Bitbucket

## Scope
- Create a new Bitbucket repository named **cybermate-api**.
- Set **main** as the default branch.

## Assertions
- Repository **cybermate-api** exists in Bitbucket.
- Default branch is **main**.

## Traceability
- Epic: CYMATE-75
- Component: Repository Infrastructure
