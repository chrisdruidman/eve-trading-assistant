# Git Workflow for Task Completion

## Automatic Commits

When executing tasks from specs, always commit changes after completing each task or subtask using the following workflow:

### Commit Process

1. **After Task Completion**: Once a task is marked as complete, immediately stage and commit all changes
2. **Commit Message Format**: Use descriptive commit messages that include:
   - The task number/identifier
   - Brief description of what was implemented
   - Reference to the spec if applicable

### Commit Message Templates

```bash
# For main tasks
git commit -m "feat: [task-id] - [brief description]

Implements task [task-number] from [spec-name] spec
- [key change 1]
- [key change 2]"

# For subtasks
git commit -m "feat: [subtask-id] - [brief description]

Implements subtask [subtask-number] from [spec-name] spec
- [key change 1]"

# For bug fixes during tasks
git commit -m "fix: [task-id] - [brief description]

Fixes issue found while implementing task [task-number]"
```

### Git Commands to Use

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "[commit message following template above]"

# Optional: Push to remote if working on a feature branch
git push origin [branch-name]
```

### When to Commit

- **After each completed subtask** - Keep commits granular and focused
- **After each completed main task** - Ensure major milestones are captured
- **Before moving to the next task** - Maintain clean separation between tasks
- **After fixing any bugs discovered during implementation** - Keep fixes separate from feature work

### Branch Strategy

- Work on feature branches when implementing specs: `feature/[spec-name]`
- Use descriptive branch names that match the spec being implemented
- Consider creating separate branches for major tasks if they're complex

### Pull Request Workflow

1. **Start New Spec Work**:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/[spec-name]
   ```

2. **During Implementation**: Commit after each task/subtask completion

3. **Spec Completion**:

   ```bash
   # Final push of all commits
   git push origin feature/[spec-name]

   # Create PR (using GitHub CLI if available)
   gh pr create --title "feat: [spec-name] implementation" --body "Implements [spec-name] spec with all tasks completed"
   ```

4. **PR Description Template**:

   ```markdown
   ## Spec Implementation: [Spec Name]

   ### Completed Tasks

   - [ ] Task 1: [description]
   - [ ] Task 2: [description]
   - [ ] Task 3: [description]

   ### Changes Made

   - [Brief summary of key changes]

   ### Testing

   - [ ] Unit tests passing
   - [ ] Integration tests passing
   - [ ] Manual testing completed

   ### Deployment Notes

   - [Any special deployment considerations]
   ```

### When to Create PRs

- **After completing all tasks** in a spec
- **For major milestones** if the spec is very large
- **Before deploying** to staging/production environments

### Example Workflow

```bash
# Start working on a spec
git checkout -b feature/eve-trading-assistant

# Complete subtask 1.1
git add .
git commit -m "feat: 1.1 - Set up project structure and core interfaces

Implements subtask 1.1 from eve-trading-assistant spec
- Created directory structure for models, services, repositories
- Defined core interfaces for system boundaries"

# Complete subtask 1.2
git add .
git commit -m "feat: 1.2 - Implement data models and validation

Implements subtask 1.2 from eve-trading-assistant spec
- Created TypeScript interfaces for data models
- Implemented validation functions"

# Continue for each task/subtask...
```

This ensures a clean git history that tracks progress through spec implementation and makes it easy to review what was accomplished in each task.
