import { Version2Client as JiraClient, Version2Models } from 'jira.js';

import { PluginConfig, PluginContext } from './types';

export type { JiraClient };
export type Version = Version2Models.Version;

export function makeClient(config: PluginConfig, _context: PluginContext): JiraClient {
  if (!process.env.JIRA_AUTH) {
    throw new Error('JIRA_AUTH environment variable is not set. Must be a JSON string.');
  }
  return new JiraClient({
    host: config.jiraHost,
    authentication: JSON.parse(process.env.JIRA_AUTH),
  });
}
