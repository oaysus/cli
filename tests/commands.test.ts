/**
 * Tests for commands.ts
 * Verifies command registry and command utility functions
 */

import {
  COMMANDS,
  getCommand,
  filterCommands,
  parseCommand,
  type Command,
} from '../src/lib/shared/commands.js';

describe('commands module', () => {
  describe('COMMANDS array', () => {
    it('should export a non-empty array of commands', () => {
      expect(Array.isArray(COMMANDS)).toBe(true);
      expect(COMMANDS.length).toBeGreaterThan(0);
    });

    it('should have all commands with required properties', () => {
      for (const cmd of COMMANDS) {
        expect(typeof cmd.name).toBe('string');
        expect(cmd.name.length).toBeGreaterThan(0);
        expect(typeof cmd.description).toBe('string');
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });

    it('should have valid group values for all commands', () => {
      const validGroups = ['theme', 'site', 'global'];
      for (const cmd of COMMANDS) {
        if (cmd.group !== undefined) {
          expect(validGroups).toContain(cmd.group);
        }
      }
    });

    describe('theme commands', () => {
      it('should include theme init command', () => {
        const cmd = COMMANDS.find(c => c.name === 'theme init');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('theme');
        expect(cmd?.description).toBe('Create a new theme pack project');
      });

      it('should include theme create command', () => {
        const cmd = COMMANDS.find(c => c.name === 'theme create');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('theme');
        expect(cmd?.description).toBe('Add a component to your theme pack');
      });

      it('should include theme validate command', () => {
        const cmd = COMMANDS.find(c => c.name === 'theme validate');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('theme');
        expect(cmd?.description).toBe('Validate theme pack structure');
      });

      it('should include theme push command', () => {
        const cmd = COMMANDS.find(c => c.name === 'theme push');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('theme');
        expect(cmd?.description).toBe('Upload theme pack to Oaysus');
      });

      it('should include theme delete command', () => {
        const cmd = COMMANDS.find(c => c.name === 'theme delete');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('theme');
        expect(cmd?.description).toBe('Delete a theme pack from Oaysus');
      });
    });

    describe('site commands', () => {
      it('should include site init command', () => {
        const cmd = COMMANDS.find(c => c.name === 'site init');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('site');
        expect(cmd?.description).toBe('Create a new website project');
      });

      it('should include site validate command', () => {
        const cmd = COMMANDS.find(c => c.name === 'site validate');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('site');
        expect(cmd?.description).toBe('Validate pages against installed components');
      });

      it('should include site publish command', () => {
        const cmd = COMMANDS.find(c => c.name === 'site publish');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('site');
        expect(cmd?.description).toBe('Publish pages to your website');
      });

      it('should include site pull command', () => {
        const cmd = COMMANDS.find(c => c.name === 'site pull');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('site');
        expect(cmd?.description).toBe('Download pages from server to local files');
      });
    });

    describe('global commands', () => {
      it('should include login command', () => {
        const cmd = COMMANDS.find(c => c.name === 'login');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('global');
        expect(cmd?.description).toBe('Authenticate with your Oaysus account');
      });

      it('should include whoami command', () => {
        const cmd = COMMANDS.find(c => c.name === 'whoami');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('global');
        expect(cmd?.description).toBe('Display current user information');
      });

      it('should include switch command', () => {
        const cmd = COMMANDS.find(c => c.name === 'switch');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('global');
        expect(cmd?.description).toBe('Switch between your websites');
      });

      it('should include logout command', () => {
        const cmd = COMMANDS.find(c => c.name === 'logout');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('global');
        expect(cmd?.description).toBe('Clear authentication tokens');
      });

      it('should include exit command', () => {
        const cmd = COMMANDS.find(c => c.name === 'exit');
        expect(cmd).toBeDefined();
        expect(cmd?.group).toBe('global');
        expect(cmd?.description).toBe('Exit the CLI');
      });
    });

    it('should have unique command names', () => {
      const names = COMMANDS.map(c => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('getCommand()', () => {
    it('should return a command when found by exact name', () => {
      const cmd = getCommand('theme init');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('theme init');
      expect(cmd?.group).toBe('theme');
    });

    it('should return undefined when command not found', () => {
      const cmd = getCommand('nonexistent command');
      expect(cmd).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const cmd = getCommand('THEME INIT');
      expect(cmd).toBeUndefined();
    });

    it('should find all theme commands', () => {
      expect(getCommand('theme init')).toBeDefined();
      expect(getCommand('theme create')).toBeDefined();
      expect(getCommand('theme validate')).toBeDefined();
      expect(getCommand('theme push')).toBeDefined();
      expect(getCommand('theme delete')).toBeDefined();
    });

    it('should find all site commands', () => {
      expect(getCommand('site init')).toBeDefined();
      expect(getCommand('site validate')).toBeDefined();
      expect(getCommand('site publish')).toBeDefined();
      expect(getCommand('site pull')).toBeDefined();
    });

    it('should find all global commands', () => {
      expect(getCommand('login')).toBeDefined();
      expect(getCommand('whoami')).toBeDefined();
      expect(getCommand('switch')).toBeDefined();
      expect(getCommand('logout')).toBeDefined();
      expect(getCommand('exit')).toBeDefined();
    });

    it('should return undefined for empty string', () => {
      const cmd = getCommand('');
      expect(cmd).toBeUndefined();
    });

    it('should return undefined for partial matches', () => {
      const cmd = getCommand('theme');
      expect(cmd).toBeUndefined();
    });

    it('should not match with extra whitespace', () => {
      const cmd = getCommand(' theme init ');
      expect(cmd).toBeUndefined();
    });
  });

  describe('filterCommands()', () => {
    it('should return all commands when query is empty string', () => {
      const result = filterCommands('');
      expect(result).toEqual(COMMANDS);
    });

    it('should return all commands when query is only whitespace', () => {
      const result = filterCommands('   ');
      expect(result).toEqual(COMMANDS);
    });

    it('should filter commands by partial name match', () => {
      const result = filterCommands('theme');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(cmd => cmd.name.includes('theme'))).toBe(true);
    });

    it('should filter commands case-insensitively', () => {
      const resultLower = filterCommands('theme');
      const resultUpper = filterCommands('THEME');
      const resultMixed = filterCommands('ThEmE');

      expect(resultLower).toEqual(resultUpper);
      expect(resultLower).toEqual(resultMixed);
    });

    it('should return empty array when no commands match', () => {
      const result = filterCommands('xyz123nonexistent');
      expect(result).toEqual([]);
    });

    it('should filter by substring match', () => {
      const result = filterCommands('init');
      expect(result.length).toBe(2); // 'theme init' and 'site init'
      expect(result.every(cmd => cmd.name.includes('init'))).toBe(true);
    });

    it('should filter by single character', () => {
      const result = filterCommands('i');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(cmd => cmd.name.toLowerCase().includes('i'))).toBe(true);
    });

    it('should trim whitespace from query', () => {
      const resultTrimmed = filterCommands('theme');
      const resultWithSpaces = filterCommands('  theme  ');
      expect(resultTrimmed).toEqual(resultWithSpaces);
    });

    it('should find site commands', () => {
      const result = filterCommands('site');
      expect(result.length).toBe(4); // site init, site validate, site publish, site pull
      expect(result.every(cmd => cmd.group === 'site')).toBe(true);
    });

    it('should find global commands by name', () => {
      const loginResult = filterCommands('login');
      expect(loginResult.length).toBe(1);
      expect(loginResult[0].name).toBe('login');
    });

    it('should match partial command names', () => {
      const result = filterCommands('val');
      expect(result.length).toBe(2); // theme validate, site validate
      expect(result.every(cmd => cmd.name.includes('validate'))).toBe(true);
    });

    it('should handle special regex characters safely', () => {
      // These should not cause regex errors
      const result1 = filterCommands('.*');
      const result2 = filterCommands('[test]');
      const result3 = filterCommands('(test)');
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result3).toEqual([]);
    });
  });

  describe('parseCommand()', () => {
    describe('two-word commands', () => {
      it('should parse theme commands correctly', () => {
        const result = parseCommand('theme init');
        expect(result.group).toBe('theme');
        expect(result.subCommand).toBe('init');
      });

      it('should parse theme create command', () => {
        const result = parseCommand('theme create');
        expect(result.group).toBe('theme');
        expect(result.subCommand).toBe('create');
      });

      it('should parse theme validate command', () => {
        const result = parseCommand('theme validate');
        expect(result.group).toBe('theme');
        expect(result.subCommand).toBe('validate');
      });

      it('should parse theme push command', () => {
        const result = parseCommand('theme push');
        expect(result.group).toBe('theme');
        expect(result.subCommand).toBe('push');
      });

      it('should parse theme delete command', () => {
        const result = parseCommand('theme delete');
        expect(result.group).toBe('theme');
        expect(result.subCommand).toBe('delete');
      });

      it('should parse site commands correctly', () => {
        const result = parseCommand('site init');
        expect(result.group).toBe('site');
        expect(result.subCommand).toBe('init');
      });

      it('should parse site validate command', () => {
        const result = parseCommand('site validate');
        expect(result.group).toBe('site');
        expect(result.subCommand).toBe('validate');
      });

      it('should parse site publish command', () => {
        const result = parseCommand('site publish');
        expect(result.group).toBe('site');
        expect(result.subCommand).toBe('publish');
      });

      it('should parse site pull command', () => {
        const result = parseCommand('site pull');
        expect(result.group).toBe('site');
        expect(result.subCommand).toBe('pull');
      });
    });

    describe('single-word commands (global)', () => {
      it('should parse login as global command', () => {
        const result = parseCommand('login');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('login');
      });

      it('should parse whoami as global command', () => {
        const result = parseCommand('whoami');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('whoami');
      });

      it('should parse switch as global command', () => {
        const result = parseCommand('switch');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('switch');
      });

      it('should parse logout as global command', () => {
        const result = parseCommand('logout');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('logout');
      });

      it('should parse exit as global command', () => {
        const result = parseCommand('exit');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('exit');
      });
    });

    describe('edge cases', () => {
      it('should handle unknown two-word commands', () => {
        const result = parseCommand('unknown command');
        expect(result.group).toBe('unknown');
        expect(result.subCommand).toBe('command');
      });

      it('should handle unknown single-word commands', () => {
        const result = parseCommand('unknowncmd');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('unknowncmd');
      });

      it('should handle empty string', () => {
        const result = parseCommand('');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('');
      });

      it('should handle commands with more than two words', () => {
        // split(' ') creates more than 2 parts, so it falls through to global
        const result = parseCommand('theme init extra args');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('theme');
      });

      it('should handle single space', () => {
        // split(' ') on ' ' creates ['', ''] which has length 2
        const result = parseCommand(' ');
        expect(result.group).toBe('');
        expect(result.subCommand).toBe('');
      });

      it('should handle multiple spaces between words', () => {
        // split(' ') on 'theme  init' creates ['theme', '', 'init'] which has length 3
        // Falls through to global case
        const result = parseCommand('theme  init');
        expect(result.group).toBe('global');
        expect(result.subCommand).toBe('theme');
      });
    });
  });

  describe('Command type interface', () => {
    it('should accept valid Command objects', () => {
      const validCommand: Command = {
        name: 'test command',
        description: 'A test command',
        group: 'global',
      };
      expect(validCommand.name).toBe('test command');
      expect(validCommand.description).toBe('A test command');
      expect(validCommand.group).toBe('global');
    });

    it('should accept Command without optional args', () => {
      const commandWithoutArgs: Command = {
        name: 'simple',
        description: 'Simple command',
      };
      expect(commandWithoutArgs.args).toBeUndefined();
    });

    it('should accept Command with args', () => {
      const commandWithArgs: Command = {
        name: 'test',
        description: 'Test',
        args: '<name>',
      };
      expect(commandWithArgs.args).toBe('<name>');
    });

    it('should accept Command without optional group', () => {
      const commandWithoutGroup: Command = {
        name: 'orphan',
        description: 'Orphan command',
      };
      expect(commandWithoutGroup.group).toBeUndefined();
    });

    it('should accept all valid group types', () => {
      const themeCmd: Command = { name: 't', description: 'd', group: 'theme' };
      const siteCmd: Command = { name: 's', description: 'd', group: 'site' };
      const globalCmd: Command = { name: 'g', description: 'd', group: 'global' };

      expect(themeCmd.group).toBe('theme');
      expect(siteCmd.group).toBe('site');
      expect(globalCmd.group).toBe('global');
    });
  });

  describe('command counts', () => {
    it('should have exactly 5 theme commands', () => {
      const themeCommands = COMMANDS.filter(c => c.group === 'theme');
      expect(themeCommands.length).toBe(5);
    });

    it('should have exactly 4 site commands', () => {
      const siteCommands = COMMANDS.filter(c => c.group === 'site');
      expect(siteCommands.length).toBe(4);
    });

    it('should have exactly 5 global commands', () => {
      const globalCommands = COMMANDS.filter(c => c.group === 'global');
      expect(globalCommands.length).toBe(5);
    });

    it('should have 14 total commands', () => {
      expect(COMMANDS.length).toBe(14);
    });
  });
});
