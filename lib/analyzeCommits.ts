import { ensureTicketsAreOpen } from './ensureTicketsAreOpen';
import { getTickets } from './getTickets';
import { makeClient } from './jira';
import { GenerateNotesContext, PluginConfig, PluginContext } from './types';

export async function analyzeCommits(config: PluginConfig, context: PluginContext): Promise<void> {
  const jira = makeClient(config, context);
  const tickets = getTickets(config, context as GenerateNotesContext);
  await ensureTicketsAreOpen(jira, tickets);
}
