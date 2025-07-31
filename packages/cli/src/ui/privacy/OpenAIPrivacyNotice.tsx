/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface OpenAIPrivacyNoticeProps {
  onExit: () => void;
}

export const OpenAIPrivacyNotice = ({ onExit }: OpenAIPrivacyNoticeProps) => {
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={Colors.AccentPurple}>
        OpenAI API Notice
      </Text>
      <Newline />
      <Text>
        By using the OpenAI API<Text color={Colors.AccentBlue}>[1]</Text>,
        you are agreeing to the OpenAI Terms of Use
        <Text color={Colors.AccentRed}>[2]</Text> and the API Usage Policies
        <Text color={Colors.AccentGreen}>[3]</Text>.
      </Text>
      <Newline />
      <Text>
        <Text color={Colors.AccentBlue}>[1]</Text>{' '}
        https://platform.openai.com/docs
      </Text>
      <Text>
        <Text color={Colors.AccentRed}>[2]</Text> https://openai.com/terms
      </Text>
      <Text>
        <Text color={Colors.AccentGreen}>[3]</Text>{' '}
        https://openai.com/policies/usage-policies
      </Text>
      <Newline />
      <Text color={Colors.Gray}>Press Esc to exit.</Text>
    </Box>
  );
};