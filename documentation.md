# Spec Driven Development - Documentation

## 📋 Action Items

### Priority: High
- [ ] **Action Item Title**
  - **Description**: Brief description of what needs to be done
  - **Assigned To**: Name/Team
  - **Status**: Not Started | In Progress | Completed | Blocked
  - **Due Date**: YYYY-MM-DD
  - **Notes**: Additional context or considerations

- [ ] **Action Item Title**
  - **Description**: 
  - **Assigned To**: 
  - **Status**: 
  - **Due Date**: 
  - **Notes**: 

---

## 🐛 Known Issues

### Issue: .spec-driven-files Addition to Workspace

**Status**: Design Decision (Not a Bug)  
**Date Documented**: October 15, 2025  

#### Current Implementation
All resource files (Instructions, Prompts, MCP configs, How-To Guides) are physically copied to the workspace under the `.spec-driven-files/` directory.

#### Approaches Evaluated

1. **Internal Extension Resources**
   - Resources stored within extension directory
   - Workspace accesses files internally via API
   - ❌ **Rejected**: GitHub Copilot cannot access extension-internal files

2. **VS Code Virtual File System**
   - Resources added as virtual files to workspace
   - Files exist in memory but not on disk
   - ❌ **Rejected**: GitHub Copilot requires physical files for content analysis

#### Design Decision
**Current approach (physical file copy) maintained** because GitHub Copilot requires files to be physically present in the workspace to utilize their content. Virtual or extension-internal files are ignored by Copilot even when explicitly mentioned in prompts.

#### Future Considerations
- Monitor GitHub Copilot API updates for virtual file system support