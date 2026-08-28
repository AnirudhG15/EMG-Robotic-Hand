# Claude Code Configuration for EMG Robotic Hand

## Installed Skills

This project is configured to use the following global Claude Code skills:

### 1. **frontend-design**
- **Source**: Anthropic's Claude Code repository
- **Purpose**: Create design canvases and UI mockups
- **Usage**: `/frontend-design` command

### 2. **UI/UX Pro Max Skills**
- **Source**: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **Installation**: Global installation at `~/.claude/skills/`
- **Available Skills**:
  - `/design` - General UI/UX design
  - `/banner-design` - Banner and graphic design
  - `/brand` - Brand identity design
  - `/design-system` - Design system and token architecture
  - `/slides` - Presentation design
  - `/ui-styling` - UI styling with shadcn/ui and Tailwind

## Usage

All skills are installed globally and available across all projects.

To use any skill in Claude Code:
- Type `/` in the chat to see all available skills
- Type `/skill-name` followed by your request
- These skills provide professional-grade design capabilities

## Project Setup

Skills are configured in `.claude/settings.json` and symlinked globally for easy access:
- `~/.claude/skills/frontend-design` (Anthropic)
- `~/.claude/skills/design/` (and other UI/UX Pro Max skills)

All skills are ready to use for UI/UX design work on this project.
