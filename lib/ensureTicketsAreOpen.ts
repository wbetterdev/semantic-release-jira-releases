import { cosmiconfig, CosmiconfigResult } from 'cosmiconfig';

import { JiraClient } from './jira';

type Config = {
  ignored?: string[];
};
type Result = Omit<CosmiconfigResult, 'config'> & {
  config: Config;
};

let cache: Result | undefined;

const configExplorer = cosmiconfig('semantic-release-jira-releases');
const getConfig = async () => {
  cache = cache || await configExplorer.search() as Result
  return cache?.config || {};
}

async function isIgnored(ticket: string): Promise<boolean> {
  const { ignored = [] } = await getConfig();
  return ignored.includes(ticket);
}



export async function ensureTicketsAreOpen(client: JiraClient, tickets: string[]): Promise<void> {
  const results = [];

  for (const ticket of tickets) {
    try {
      const { fields } = await client.issues.getIssue({ issueIdOrKey: ticket, fields: ['summary', 'status', 'resolution'] });

      if (fields.status?.statusCategory?.name === 'Done' && fields.resolution) {
        results.push({
          message: `*** Ticket ${ticket} is closed with resolution ${fields.resolution.name}. Reopen it to unblock the release.`,
          ignore: await isIgnored(ticket),
        });
      }
    } catch (e: unknown) {
      const error = e as Error & { errorMessages?: string[]; };
      const message = error.errorMessages?.join(', ') || error?.message as string || e;
      results.push({
        ignore: true,
        message: `>>> Could not fetch ticket ${ticket}, it will be ignored/skipped. (${message})`,
      });
    }

    if (results.some(x => !x.ignore)) {
      throw new Error(`

  PRE-FLIGHT CHECKS FAILED: Some tickets are closed:

  ${results.map(x => x.message).join('\n')}




  `);
    }
  }

}
