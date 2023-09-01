import { makeClient } from './jira';
import { GenerateNotesContext, PluginConfig, PluginContext } from './types';
import { getTickets } from './getTickets';
import { ensureTicketsAreOpen } from './ensureTicketsAreOpen';

export async function analyzeCommits(config: PluginConfig, context: PluginContext): Promise<void> {
  const jira = makeClient(config, context);
  const tickets = getTickets(config, context as GenerateNotesContext);
  await ensureTicketsAreOpen(jira, tickets);
}
