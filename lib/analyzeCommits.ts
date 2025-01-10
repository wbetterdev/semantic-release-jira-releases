import { ensureTicketsAreOpen } from './ensureTicketsAreOpen.js';
import { getTickets } from './getTickets.js';
import { makeClient } from './client.js';
import { GenerateNotesContext, PluginConfig, PluginContext } from './types.js';

export async function analyzeCommits(
  config: PluginConfig,
  context: PluginContext,
): Promise<void> {
  const jira = makeClient(config, context);
  const tickets = getTickets(config, context as GenerateNotesContext);
  await ensureTicketsAreOpen(jira, tickets);
}
