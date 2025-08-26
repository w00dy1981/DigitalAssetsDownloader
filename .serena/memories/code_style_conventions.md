# Code Style & Conventions - Digital Assets Downloader

## TypeScript Configuration
- **Strict Mode**: `"strict": true` enforced
- **Target**: ES2020 with DOM libraries
- **Module System**: CommonJS with node resolution
- **JSX**: `react-jsx` (no need for React imports)
- **Zero TypeScript errors** required for production

## ESLint Configuration
- **Extends**: eslint:recommended, @typescript-eslint/recommended, plugin:react/recommended, plugin:react-hooks/recommended, prettier
- **Key Rules**:
  - `prettier/prettier: error` - Formatting enforced
  - `@typescript-eslint/no-unused-vars: error` - No unused variables
  - `@typescript-eslint/no-explicit-any: warn` - Avoid `any` type
  - `react/prop-types: off` - TypeScript handles prop validation
  - `react/react-in-jsx-scope: off` - React 18 auto-import

## Prettier Configuration (.prettierrc.json)
Standard Prettier formatting applied to all TypeScript, React, JSON, CSS, and Markdown files.

## Naming Conventions
- **Components**: PascalCase (e.g., `FileSelectionTab.tsx`)
- **Services**: PascalCase with Service suffix (e.g., `LoggingService.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useElectronIPC.ts`)
- **Types**: PascalCase interfaces and types in `shared/types.ts`
- **Files**: PascalCase for components, camelCase for utilities

## Import Patterns
```typescript
// Service imports
import { logger } from '@/services/LoggingService';
import { validationService } from '@/services/ValidationService';

// Component imports  
import { NumberInput, Select } from '@/renderer/components/ui';

// Type imports
import { SpreadsheetData } from '@/shared/types';
```

## Component Structure
- **Functional Components**: React 18 with hooks only
- **TypeScript**: All components fully typed with interfaces
- **Props**: Interface-defined with descriptive names
- **Hooks**: Custom hooks for reusable logic
- **Error Boundaries**: Implemented for production stability

## Testing Patterns
- **Jest + ts-jest**: TypeScript testing environment
- **@testing-library/react**: Component testing
- **Coverage Threshold**: 50% minimum enforced
- **Test Files**: `.test.ts` or `.spec.ts` suffixes
- **Mock Strategy**: Service mocking with Jest mocks

## File Organization
- **Index Files**: Export barrel pattern (`index.ts`) for clean imports
- **Service Layer**: Singleton pattern with `getInstance()`  
- **Component Files**: One component per file with matching name
- **Type Definitions**: Centralized in `shared/types.ts`

## Development Principles (KISS/DRY)
- **KISS**: Simple, readable solutions over complex ones
- **DRY**: Extract shared logic, follow Rule of 3 (extract after 3rd duplicate)
- **SOLID**: Single responsibility, dependency injection via services
- **YAGNI**: Build for current requirements, avoid speculation