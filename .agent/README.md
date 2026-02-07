# AI Configuration for JiraMigrator

This directory contains configuration and rules for AI assistants working with this project.

## Files

### `rules.md`

Main file with rules and guidelines for AI (Antigravity). Contains:

- Project information and tech stack
- Coding conventions (TypeScript, Svelte, Tailwind)
- Project architecture
- Design patterns and best practices
- Common problems and solutions

### `/.cursorrules` (in project root)

Configuration file for Cursor IDE. Contains similar information as `rules.md`, but in a format optimized for Cursor.

## Purpose

These files ensure that AI assistants (Antigravity, Cursor) have full project context and can:

- Generate code following project conventions
- Suggest solutions aligned with architecture
- Help with debugging considering project specifics
- Maintain consistency in style and patterns

## Updates

When the project evolves, remember to update these files:

- New technologies or libraries
- Changed coding conventions
- New design patterns
- Common problems and their solutions

## Usage

### Antigravity (Google Deepmind)

Automatically reads the `rules.md` file from this directory.

### Cursor IDE

Automatically reads the `.cursorrules` file from project root.

Both editors will use these rules to assist with code development.
