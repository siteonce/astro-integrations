# House rules

House rules are opinions a person or a repo layers on top of the workflows, such as branch names, phase size, merge style or tool choices. The kit holds only mechanics, which work without any house rule.

- A repo applies its house rules without changing any workflow, PR shape or practice.
- Where a house rule and kit text conflict, the house rule wins in that repo. A repo changes how the kit applies to it through its agent rules, never by editing a managed file.
- House rules go in the House rules section of the agent rules index, copied from [the template](templates/agent-rules-index.md). A long list may move to its own file in the agent rules folder, linked from that section.
- Conventions that skills or CI pieces read, such as branch names, commands and folder paths, go in the settings file instead.
- No house rule is on by default. The kit ships none.
