# Task Completion Checklist - Digital Assets Downloader

## CRITICAL: This is a Production Application
**NEVER TELL USER THE APP IS "PRODUCTION READY"** - Always acknowledge this is development/refactoring work.

## Required Verification After ANY Code Changes

### 1. Build Verification
```bash
npm run build
```
- **Must complete** in ~30 seconds
- **Zero TypeScript errors** required
- Both main and renderer processes must build successfully

### 2. Test Verification  
```bash
npm test
```
- **All 214 tests must pass** (100% success rate required)
- No test failures or timeouts allowed
- Coverage threshold (50%) must be maintained

### 3. Code Quality Verification
```bash
npm run lint
```
- **Zero ESLint errors** required  
- All Prettier formatting rules must pass
- TypeScript strict mode compliance required

### 4. Manual Testing
```bash  
npm run dev
```
- Application must start without errors
- Critical path testing: File Selection → Column Selection → Process tabs
- Verify no console errors or warnings

## Change Implementation Safety Pattern

### Before Making Changes
1. **Plan First**: Explain what you plan to change and why
2. **Single Focus**: Implement one feature/issue at a time  
3. **Minimal Scope**: Use smallest possible change to achieve goal

### During Implementation  
1. **ONE CHANGE AT A TIME**: Never modify multiple files simultaneously
2. **ADDITIVE-ONLY**: Extend interfaces rather than modify existing ones
3. **PRESERVE FUNCTIONALITY**: Zero breaking changes allowed

### After Implementation
1. **Immediate Testing**: Run verification sequence after every file change
2. **Wait for Confirmation**: Never proceed until current changes are confirmed working  
3. **Document Changes**: Update relevant documentation/comments

## GitHub Integration Workflow
- **Issues**: Reference GitHub issues #22, #23, #24 for Phase 6 work
- **Commits**: Descriptive commit messages referencing issue numbers
- **Branch**: Work on appropriate feature branches, merge to `main`
- **Updates**: Update issue status and close when complete

## Production Safety Checklist
- [ ] Zero TypeScript compilation errors
- [ ] All 214 tests pass without failures
- [ ] ESLint passes with zero errors
- [ ] Application starts and functions correctly via `npm run dev`  
- [ ] No console errors or warnings in development
- [ ] Critical workflow (4 tabs) functions as expected
- [ ] No breaking changes to existing functionality

## File Modification Guidelines
- ✅ **Edit existing files** when possible (preferred)
- ⚠️ **Create new files** only when absolutely necessary  
- 🚫 **Never create documentation** files unless explicitly requested
- 🚫 **Never modify package.json** or build configs without explicit need

## Performance Standards
- **Build Time**: Under 30 seconds for full build
- **Test Execution**: All tests complete within reasonable time
- **Component Size**: Target <200 lines per component  
- **Method Size**: Target <50 lines per method
- **Type Safety**: Maintain strict TypeScript compliance