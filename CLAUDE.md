# Claude AI Development Guidelines

## Core Refactoring Principles

### 🎯 KISS (Keep It Simple, Stupid)
- Prefer simple, readable solutions over complex ones
- Avoid over-engineering
- If a solution requires extensive explanation, it's probably too complex

### ♻️ DRY (Don't Repeat Yourself)
- Extract shared logic into reusable components/functions
- Centralize configuration and constants
- **Apply the Rule of 3**: Only extract to a shared component when you have 3+ instances of duplication

### 🏗️ SOLID Principles
- **S**ingle Responsibility: Each module/class should have one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived classes must be substitutable for base classes
- **I**nterface Segregation: Many specific interfaces are better than one general interface
- **D**ependency Inversion: Depend on abstractions, not concretions

### ⏳ YAGNI (You Aren't Gonna Need It)
- Don't add functionality until it's actually needed
- Avoid speculative generalization
- Build for current requirements, not hypothetical future needs

### 📏 Rule of 3
- **First instance**: Write the code inline
- **Second instance**: Note the duplication but don't refactor yet
- **Third instance**: Now refactor into a shared component/function
- This prevents premature abstraction and ensures the pattern is truly reusable

## Practical Application

When refactoring:
1. Identify patterns that appear 3+ times (Rule of 3)
2. Keep components focused on a single responsibility (SOLID - S)
3. Don't create abstractions "just in case" (YAGNI)
4. Prefer composition over inheritance (KISS)
5. Extract common logic into hooks/utilities (DRY)

## Testing Requirements

Before any refactoring:
1. Run existing tests: `npm test`
2. Check linting: `npm run lint`
3. Verify build: `npm run build`
4. Test the application manually for critical paths

## Code Quality Standards

- TypeScript strict mode enabled
- ESLint and Prettier configured
- Minimum 50% test coverage for new code
- All functions should have clear, single purposes
- Components should be under 200 lines
- Methods should be under 50 lines

## Current Refactoring Status

- **Phase 1**: ✅ Custom Hooks (Complete)
- **Phase 2**: ✅ UI Components (Complete)
- **Phase 3**: 🔄 Business Logic Services (In Progress)
- **Phase 4**: 📋 Component Decomposition (Planned)
- **Phase 5**: 📋 Method Simplification (Planned)

## Key Metrics to Track

- Lines of code reduction
- Component complexity (cyclomatic complexity)
- Test coverage percentage
- Build time
- Bundle size