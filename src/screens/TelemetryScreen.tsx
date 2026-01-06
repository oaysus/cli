import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import {
  getTelemetryStatus,
  setTelemetryEnabled,
} from '../lib/shared/telemetry.js';

interface TelemetryScreenProps {
  action: 'status' | 'enable' | 'disable';
  onExit?: () => void;
}

export function TelemetryScreen({ action, onExit }: TelemetryScreenProps) {
  const { exit } = useApp();
  const [status, setStatus] = useState<{
    enabled: boolean;
    envDisabled: boolean;
  } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function handleAction() {
      try {
        if (action === 'status') {
          const currentStatus = await getTelemetryStatus();
          setStatus(currentStatus);
          setDone(true);
        } else if (action === 'enable') {
          await setTelemetryEnabled(true);
          setMessage('Telemetry has been enabled.');
          setDone(true);
        } else if (action === 'disable') {
          await setTelemetryEnabled(false);
          setMessage('Telemetry has been disabled.');
          setDone(true);
        }
      } catch (error) {
        setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setDone(true);
      }
    }

    handleAction();
  }, [action]);

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        if (onExit) {
          onExit();
        }
        exit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [done, exit, onExit]);

  if (action === 'status' && status) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Oaysus CLI Telemetry Status</Text>
        </Box>

        <Box flexDirection="column">
          <Box>
            <Text>Status: </Text>
            {status.enabled ? (
              <Text color="green" bold>Enabled</Text>
            ) : (
              <Text color="red" bold>Disabled</Text>
            )}
          </Box>

          {status.envDisabled && (
            <Box marginTop={1}>
              <Text color="yellow">
                Note: Telemetry is disabled via OAYSUS_TELEMETRY_DISABLED environment variable.
              </Text>
            </Box>
          )}

          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              Oaysus CLI collects anonymous usage data to help improve the tool.
            </Text>
            <Text dimColor>
              No personal data, file contents, or source code is collected.
            </Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Commands:</Text>
            <Text dimColor>  oaysus telemetry enable   - Enable telemetry</Text>
            <Text dimColor>  oaysus telemetry disable  - Disable telemetry</Text>
            <Text dimColor>  oaysus telemetry status   - Show current status</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (message) {
    return (
      <Box padding={1}>
        <Text>{message}</Text>
      </Box>
    );
  }

  return (
    <Box padding={1}>
      <Text>Processing...</Text>
    </Box>
  );
}
