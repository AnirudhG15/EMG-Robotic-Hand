# Claude Code notes for EMG Robotic Hand

## Design skills

Two design skills are used with this project. Both are **account-level plugins**,
not files in this repo — installing them is a one-time action per account, and
they then sync into every project and every Claude Code session, including the
ephemeral containers used by Claude Code on the web.

| Skill | Plugin | Marketplace |
| --- | --- | --- |
| `ui-ux-pro-max` | `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |
| `frontend-design` | `frontend-design` | [anthropics/claude-code](https://github.com/anthropics/claude-code) |

To install (run in Claude Code, any session):

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

/plugin marketplace add anthropics/claude-code
/plugin install frontend-design@claude-code-plugins
```

Cloning either repo into `~/.claude/skills/` also works, but only for the
session that did it — on the web the container is discarded when the session
ends, so the skill is gone from the next chat. Use the plugin install above.
