import { JiraClient } from './jira';



export async function ensureTicketsAreOpen(client: JiraClient, tickets: string[]): Promise<void> {
  const results = [];

  for (const ticket of tickets) {
    try {
      const { fields } = await client.issues.getIssue({ issueIdOrKey: ticket, fields: ['summary', 'status', 'resolution'] });

      if (fields.status?.statusCategory?.name === 'Done' && fields.resolution) {
        results.push({
          message: `*** Ticket ${ticket} is closed with resolution ${fields.resolution.name}. Reopen it to unblock the release.`,
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
