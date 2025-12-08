import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import os from 'os';
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { SuccessMessage } from '../components/SuccessMessage.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Framework, InitOptions } from '../types/templates.js';
import { generateProject } from '../lib/project-generator.js';
import { isValidProjectName, toKebabCase, toPascalCase } from '../lib/shared/file-utils.js';
import { loadCredentials } from '../lib/shared/auth.js';
import { HistoryEntry } from '../components/App.js';

interface Props {
  projectName?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

type Screen =
  | 'framework'
  | 'project-name'
  | 'description'
  | 'author'
  | 'confirm'
  | 'generating'
  | 'success'
  | 'error';

// Custom indicator component for cyan color
const CyanIndicator = ({ isSelected }: { isSelected?: boolean }) => (
  <Text color={isSelected ? 'cyan' : undefined}>{isSelected ? '❯ ' : '  '}</Text>
);

// Custom item component for cyan color
const CyanItem = ({ isSelected, label }: { isSelected?: boolean; label: string }) => (
  <Text color={isSelected ? 'cyan' : undefined}>{label}</Text>
);

export function InitScreen({ projectName: initialName, onExit, sessionHistory = [], addToHistory }: Props) {
  const [screen, setScreen] = useState<Screen>('framework');
  const [framework, setFramework] = useState<Framework>('react');
  const [projectName, setProjectName] = useState(initialName || '');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [error, setError] = useState<string>('');
  const [projectPath, setProjectPath] = useState<string>('');
  const [filesCreated, setFilesCreated] = useState<string[]>([]);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Load version and credentials on mount
  useEffect(() => {
    const loadAllData = async () => {
      // Load all data in parallel
      const [versionData, credsData] = await Promise.all([
        // Load version
        (async () => {
          try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const pkgPath = path.join(__dirname, '../../package.json');
            const pkgData = await readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgData);
            return pkg.version;
          } catch {
            return '0.1.0';
          }
        })(),
        // Load credentials
        loadCredentials()
      ]);

      // Single state update to prevent multiple renders
      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });

    };

    loadAllData();
  }, []);

  // Auto-exit after success
  useEffect(() => {
    if (screen === 'success') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

  // Framework Selection
  const frameworkItems = [
    { label: 'React', value: 'react' as Framework },
    { label: 'Vue', value: 'vue' as Framework },
    { label: 'Svelte', value: 'svelte' as Framework }
  ];

  const handleFrameworkSelect = (item: { value: Framework }) => {
    setFramework(item.value);
    if (addToHistory) {
      // Add command name and first selection
      const entries: HistoryEntry[] = [];

      entries.push({
        type: 'info',
        content: '❯ /init',
        color: 'cyan',
        // Add spacing marker to indicate this should have top margin
        spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
      });

      entries.push({ type: 'prompt', content: 'Select a framework for your theme pack' });
      entries.push({ type: 'response', content: item.value });

      addToHistory(entries);
    }
    setScreen('project-name');
  };

  // Project Name Input
  const handleProjectNameSubmit = (value: string) => {
    const name = toKebabCase(value.trim());

    if (!name) {
      setError('Project name is required');
      return;
    }

    if (!isValidProjectName(name)) {
      setError('Project name must only contain lowercase letters, numbers, and hyphens');
      return;
    }

    setProjectName(name);
    if (addToHistory) {
      addToHistory([
        { type: 'prompt', content: 'What should we call your project?' },
        { type: 'response', content: name }
      ]);
    }
    setError('');
    setScreen('description');
  };

  // Description Input
  const handleDescriptionSubmit = (value: string) => {
    const desc = value.trim() || 'A custom component package for Oaysus';
    setDescription(desc);
    if (addToHistory) {
      addToHistory([
        { type: 'prompt', content: 'Add a brief description' },
        { type: 'response', content: desc }
      ]);
    }
    setScreen('author');
  };

  // Author Input
  const handleAuthorSubmit = (value: string) => {
    const authorName = value.trim() || 'John Doe';
    setAuthor(authorName);
    if (addToHistory) {
      addToHistory([
        { type: 'prompt', content: "Who's building this?" },
        { type: 'response', content: authorName }
      ]);
    }
    setScreen('confirm');
  };

  // Handle cancellation
  const handleCancel = () => {
    if (addToHistory) {
      addToHistory({
        type: 'info',
        content: 'Init command cancelled, returned to menu'
      });
    }
    if (onExit) onExit();
  };

  // Confirmation and escape handling
  useInput((input, key) => {
    // Only handle input for non-framework screens to avoid conflicts with SelectInput
    if (screen === 'framework') {
      // Let SelectInput handle all keys during framework selection
      if (key.escape) {
        handleCancel();
      }
      return;
    }

    if (screen === 'confirm') {
      if (input === 'y' || input === 'Y') {
        handleGenerate();
      } else if (input === 'n' || input === 'N' || key.escape) {
        handleCancel();
      }
    } else if (key.escape && screen !== 'generating' && screen !== 'success' && screen !== 'error') {
      handleCancel();
    }
  });

  // Generate Project
  const handleGenerate = async () => {
    setScreen('generating');

    const options: InitOptions = {
      projectName,
      description,
      framework,
      author
    };

    const targetPath = path.join(process.cwd(), projectName);

    const result = await generateProject(options, targetPath);

    if (result.success) {
      setProjectPath(result.projectPath);
      setFilesCreated(result.filesCreated);
      setScreen('success');
    } else {
      setError(result.error || 'Unknown error occurred');
      setScreen('error');
    }
  };

  // Don't render until data is loaded to prevent double rendering
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Session History - Shows accumulated selections */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'prompt') {
              return (
                <Box key={uniqueKey}>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'response') {
              return (
                <Box key={uniqueKey}>
                  <Text dimColor>❯ </Text>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'success') {
              // Split checkmark from text: "✓ Message" -> "✓ " + "Message"
              const hasCheckmark = entry.content.startsWith('✓ ');
              if (hasCheckmark) {
                const text = entry.content.substring(2); // Remove "✓ "
                return (
                  <Box key={uniqueKey}>
                    <Text color="green">✓ </Text>
                    <Text>{text}</Text>
                  </Box>
                );
              }
              return (
                <Box key={uniqueKey}>
                  <Text color="green">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'spinner') {
              return (
                <Box key={uniqueKey}>
                  <Spinner type="dots" color="cyan" message={entry.content} />
                </Box>
              );
            } else if (entry.type === 'progress') {
              return (
                <Box key={uniqueKey}>
                  <Text color="cyan">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'error') {
              return (
                <Box key={uniqueKey}>
                  <Text color="red">{entry.content}</Text>
                </Box>
              );
            } else {
              // Default info type
              const textColor = entry.color === 'dim' ? undefined : entry.color;
              const isDim = entry.color === 'dim';
              const needsTopMargin = entry.spinnerId === 'command-separator';
              return (
                <Box key={uniqueKey} marginTop={needsTopMargin ? 1 : 0}>
                  <Text color={textColor} dimColor={isDim}>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Command indicator showing active command */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/init</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {screen === 'framework' && (
          <Box flexDirection="column">
            <Box>
              <Text>Select a framework for your theme pack </Text>
              <Text dimColor>(Step 1 of 4)</Text>
            </Box>
            <Box marginTop={1}>
              <SelectInput
                items={frameworkItems}
                onSelect={handleFrameworkSelect}
                indicatorComponent={CyanIndicator}
                itemComponent={CyanItem}
              />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'project-name' && (
          <Box flexDirection="column">
            <Box>
              <Text>What should we call your project? </Text>
              <Text dimColor>(Step 2 of 4)</Text>
            </Box>
            <Text dimColor>Lowercase letters, numbers, and hyphens only</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={projectName}
                  onChange={setProjectName}
                  onSubmit={handleProjectNameSubmit}
                  placeholder="my-awesome-theme"
                />
              </Text>
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">✗ {error}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'description' && (
          <Box flexDirection="column">
            <Box>
              <Text>Add a brief description </Text>
              <Text dimColor>(Step 3 of 4)</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={description}
                  onChange={setDescription}
                  onSubmit={handleDescriptionSubmit}
                  placeholder="A beautiful theme pack for Oaysus"
                />
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'author' && (
          <Box flexDirection="column">
            <Box>
              <Text>Who's building this? </Text>
              <Text dimColor>(Step 4 of 4)</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={author}
                  onChange={setAuthor}
                  onSubmit={handleAuthorSubmit}
                  placeholder="John Doe"
                />
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'confirm' && (
          <Box flexDirection="column">
            <Text>Ready to create your theme pack?</Text>
            <Box marginTop={1} flexDirection="column" paddingLeft={2}>
              <Text><Text color="gray">Project Name:</Text> {projectName}</Text>
              <Text><Text color="gray">Framework:</Text> {framework}</Text>
              <Text><Text color="gray">Description:</Text> {description}</Text>
              <Text><Text color="gray">Author:</Text> {author}</Text>
            </Box>
            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Create project?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {screen === 'generating' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Generating project..." />
          </Box>
        )}

        {screen === 'success' && (
          <SuccessMessage
            message={`Project "${projectName}" created successfully!`}
            details={[
              `📁 Location: ${projectPath}`,
              `📦 Framework: ${framework}`,
              `✨ Structure: components/ directory with Hero component`,
              '',
              'Next steps:',
              `  cd ${projectName}`,
              '  npm install',
              '  oaysus create component  # Add more components',
              '  oaysus validate'
            ]}
          />
        )}

        {screen === 'error' && (
          <ErrorMessage
            message="Failed to create project"
            details={[error]}
            suggestion="Check if the directory already exists or ensure you have write permissions"
          />
        )}
      </Box>
    </Box>
  );
}
