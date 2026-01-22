Create a GitHub issue based on: $ARGUMENTS

Follow these steps:

1. **Parse the request**
   - Analyze the provided description to determine issue type (bug, feature, enhancement, docs, etc.)
   - Extract key information: title, description, context, reproduction steps (if bug)

2. **Gather context**
   - If the issue references specific code, search the codebase to understand the current implementation
   - Identify relevant files, functions, or components that should be mentioned
   - Check for related existing issues using `gh issue list --search "<keywords>"`

3. **Determine issue labels**
   - Use `gh label list` to see available labels
   - Select appropriate labels based on issue type:
     - `bug` - Something isn't working correctly
     - `enhancement` - Improvement to existing functionality
     - `feature` - New functionality request
     - `documentation` - Documentation improvements
     - `good first issue` - Suitable for new contributors
     - `help wanted` - Extra attention needed

4. **Create the issue with proper formatting**
   Use `gh issue create` with a well-structured body:

   For **bugs**:
   ```
   ## Description
   [Clear description of the bug]

   ## Steps to Reproduce
   1. [Step 1]
   2. [Step 2]
   3. [Step 3]

   ## Expected Behavior
   [What should happen]

   ## Actual Behavior
   [What actually happens]

   ## Environment
   - OS: [e.g., macOS, Linux]
   - Version: [relevant version info]

   ## Additional Context
   [Screenshots, logs, relevant code references]
   ```

   For **features/enhancements**:
   ```
   ## Summary
   [Brief description of the proposed change]

   ## Motivation
   [Why is this change needed? What problem does it solve?]

   ## Proposed Solution
   [How should this be implemented?]

   ## Alternatives Considered
   [Other approaches that were considered]

   ## Additional Context
   [Any other relevant information]
   ```

5. **Create the issue**
   ```bash
   gh issue create \
     --title "<descriptive title>" \
     --body "<formatted body>" \
     --label "<appropriate labels>"
   ```

6. **Confirm creation**
   - Display the created issue URL
   - Show issue number for reference

**Example usage:**
- `/create-github-issue Add dark mode support to the dashboard`
- `/create-github-issue Bug: Events not being grouped correctly when fingerprint is null`
- `/create-github-issue Improve error messages in the ingestion endpoint`

**Notes:**
- Keep titles concise but descriptive (under 72 characters)
- Use imperative mood for feature titles ("Add...", "Fix...", "Update...")
- Include code references using `file:line` format when relevant
- Link to related issues or PRs if applicable
