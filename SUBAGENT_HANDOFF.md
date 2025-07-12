# 🤖 Sub-Agent Handoff Instructions

## Project Context
You are working on the **Digital Assets Downloader** - an Electron desktop app for bulk downloading and processing digital assets. The main codebase analysis identified critical bugs that need parallel fixing.

## Your Mission
Fix one specific GitHub issue from the created issue list. Each issue is designed to be worked on independently without file conflicts.

## Repository Information
- **Location:** `/Volumes/External Drive 8TB/VS Code Projects/DigitalAssetsDownloader`
- **Current Version:** v1.0.5
- **Platform:** macOS (Darwin 24.5.0)
- **Tech Stack:** Electron + React + TypeScript + Webpack

## Available Issues (Pick One)

### 🔴 **High Priority - Critical Bugs:**

**Issue #1: Memory Leaks - Event Listeners Not Cleaned Up**
- **Files:** `App.tsx`, `ProcessTab.tsx`, `SettingsTab.tsx`
- **Task:** Fix React event listener cleanup
- **Conflict Risk:** ❌ None - Pure React component work

**Issue #2: Update Check Hangs in Development Mode**  
- **Files:** `SettingsTab.tsx`, potentially `main.ts`
- **Task:** Add timeout mechanism for update checks
- **Conflict Risk:** ❌ None - Isolated to settings component

**Issue #3: Race Conditions in Download Management**
- **Files:** `downloadService.ts`, `ProcessTab.tsx`
- **Task:** Implement proper async operation locking
- **Conflict Risk:** ⚠️ Medium - Core download logic

**Issue #4: Path Traversal Security Vulnerability**
- **Files:** `downloadService.ts`, `excelService.ts`, `FileSelectionTab.tsx`
- **Task:** Add path sanitization and security validation
- **Conflict Risk:** ❌ None - New utility functions approach

**Issue #5: Windows Case-Sensitive File Search Bug**
- **Files:** `downloadService.ts`, `excelService.ts`
- **Task:** Fix case-insensitive file matching
- **Conflict Risk:** ⚠️ Low - Isolated utility functions

## Important Instructions

### 1. **Issue Selection**
Choose ONE issue to work on. Tell me: *"I'm working on Issue #X: [Title]"*

### 2. **File Conflict Prevention**
- Check which files you'll be modifying
- If another agent is working on the same files, pick a different issue
- Coordinate through this chat if needed

### 3. **Development Process**
```bash
# 1. Check current state
git status
git pull

# 2. Create feature branch
git checkout -b fix/issue-[number]-[brief-description]

# 3. Read the full issue details from GitHub
gh issue view [number]

# 4. Implement the fix following the acceptance criteria

# 5. Test thoroughly (build, run, test scenarios)
npm run build
npm run dev  # Test in development
# Also test built version if relevant

# 6. Commit with descriptive message
git add .
git commit -m "fix: [brief description] - resolves issue #[number]"
```

### 4. **Quality Standards**
- ✅ Follow existing code patterns and conventions
- ✅ Add proper TypeScript types
- ✅ Include error handling
- ✅ Test all edge cases mentioned in issue
- ✅ Ensure no breaking changes
- ✅ Update documentation if needed

### 5. **Testing Requirements**
Each issue has specific testing requirements. You MUST:
- Test the specific scenarios mentioned in the issue
- Verify the fix works in both development and production builds
- Test on the relevant platform (Windows-specific issues need Windows testing simulation)
- Ensure no regressions in existing functionality

### 6. **Completion Checklist**
Before finishing, verify:
- [ ] All acceptance criteria from the issue are met
- [ ] Code builds without errors (`npm run build`)
- [ ] App runs and basic functionality works (`npm run dev`)
- [ ] No new console errors or warnings
- [ ] Proper error handling added
- [ ] TypeScript types are correct
- [ ] Git commit message follows convention

### 7. **Communication**
- Update me when you start working on an issue
- Report any blockers or questions immediately  
- Share your progress and findings
- Ask for clarification if issue requirements are unclear

## Repository Structure
```
src/
├── main/           # Electron main process
│   ├── main.ts     # Main application logic
│   └── preload.ts  # IPC bridge
├── renderer/       # React frontend
│   ├── App.tsx     # Main app component
│   └── components/ # React components
├── services/       # Business logic
│   ├── downloadService.ts
│   └── excelService.ts
└── shared/         # Shared types
    └── types.ts
```

## Current Known Issues Context
The app currently has working update checking (v1.0.5 includes fixes), file processing, and download functionality. The issues you're fixing are reliability and edge-case problems identified through code analysis.

## Ready to Start?
1. Pick your issue number
2. Create your branch  
3. Read the full issue details
4. Start implementing
5. Keep me updated on progress

**Which issue would you like to tackle?**