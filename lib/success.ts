import * as _ from 'lodash';
import pLimit from 'p-limit';

import { JiraClient, makeClient, Version } from './jira';
import { DEFAULT_RELEASE_DESCRIPTION_TEMPLATE, DEFAULT_VERSION_TEMPLATE, GenerateNotesContext, PluginConfig } from './types';
import { escapeRegExp } from './util';

export function getTickets(config: PluginConfig, context: GenerateNotesContext): string[] {
  let patterns: RegExp[] = [];

  if (config.ticketRegex !== undefined) {
    patterns = [new RegExp(config.ticketRegex, 'giu')];
  } else {
    patterns = config.ticketPrefixes!
        .map(prefix => new RegExp(`\\b${escapeRegExp(prefix)}-(\\d+)\\b`, 'giu'));
  }

  const tickets = new Set<string>();
  for (const commit of context.commits) {
    for (const pattern of patterns) {
      const matches = commit.message.match(pattern);
      if (matches) {
        matches.forEach(match => {
          tickets.add(match);
          context.logger.info(`Found ticket ${matches} in commit: ${commit.commit.short}`);
        });
      }
    }
  }

  return [...tickets];
}

async function findOrCreateVersion(config: PluginConfig, context: GenerateNotesContext, jira: JiraClient, projectIdOrKey: string, name: string, description: string): Promise<Version> {
  const remoteVersions = await jira.projectVersions.getProjectVersions({ projectIdOrKey });
  context.logger.info(`Looking for version with name '${name}'`);
  const existing = _.find(remoteVersions, { name });
  if (existing) {
    context.logger.info(`Found existing release '${existing.id}'`);
    return existing;
  }

  context.logger.info(`No existing release found, creating new`);

  let newVersion: Version;
  if (config.dryRun) {
    context.logger.info(`dry-run: making a fake release`);
    newVersion = {
      name,
      id: 'dry_run_id',
    } as any;
  } else {
    const descriptionText = description || '';
    newVersion = await jira.projectVersions.createVersion({
      name,
      projectId: projectIdOrKey as any,
      description: descriptionText,
      released: Boolean(config.released),
      releaseDate: config.setReleaseDate ? (new Date().toISOString()) : undefined,
    });
  }

  context.logger.info(`Made new release '${newVersion.id}'`);
  return newVersion;
}

async function editIssueFixVersions(config: PluginConfig, context: GenerateNotesContext, jira: JiraClient, newVersionName: string, releaseVersionId: string, issueKey: string): Promise<void> {
  try {
    context.logger.info(`Adding issue ${issueKey} to '${newVersionName}'`);
    if (!config.dryRun) {
      await jira.issues.editIssue({
        issueIdOrKey: issueKey,
        update: {
          fixVersions: [{
            add: { id: releaseVersionId },
          }],
        },
        properties: undefined as any,
      });
    }
  } catch (exception: any) {
    const allowedMessages = [
      /Issue does not exist/i,
      /Field 'fixVersions' cannot be set/i
    ];

    const messages = [...(exception?.errorMessages || []), Object.entries(exception?.errors || {})];
    const unknown = messages.filter(e => !allowedMessages.some(regex => regex.test(e)));
    if (unknown.length > 0) {
      throw exception;
    }

    context.logger.error(`Unable to update issue ${issueKey}: ${JSON.stringify(exception, null, 2)}`);
  }
}

export async function success(config: PluginConfig, context: GenerateNotesContext): Promise<void> {
  const tickets = getTickets(config, context);

  context.logger.info(`Found ticket ${tickets.join(', ')}`);

  if (tickets.length === 0) {
    return;
  }

  const versionTemplate = _.template(config.releaseNameTemplate ?? DEFAULT_VERSION_TEMPLATE);
  const newVersionName = versionTemplate({ version: context.nextRelease.version });

  const descriptionTemplate = _.template(config.releaseDescriptionTemplate ?? DEFAULT_RELEASE_DESCRIPTION_TEMPLATE);
  const newVersionDescription = descriptionTemplate({ version: context.nextRelease.version, notes: context.nextRelease.notes });

  context.logger.info(`Using jira release '${newVersionName}'`);

  const jira = makeClient(config, context);

  await ensureTicketsAreOpen(jira, tickets);

  const project = await jira.projects.getProject({ projectIdOrKey: config.projectId });
  const { id: releaseVersionId } = await findOrCreateVersion(config, context, jira, project.id, newVersionName, newVersionDescription);

  if (!releaseVersionId) {
    throw new Error('Missing release version id!');
  }

  const concurrentLimit = pLimit(config.networkConcurrency || 10);

  const edits = tickets.map(issueKey =>
    concurrentLimit(() =>
      editIssueFixVersions(config, context, jira, newVersionName, releaseVersionId, issueKey),
    ),
  );

  await Promise.all(edits);
}


async function ensureTicketsAreOpen(client: JiraClient, tickets: string[]): Promise<void> {
    const results = [];
  
    for (const ticket of tickets) {
      try {
        const {fields} = await client.issues.getIssue({ issueIdOrKey: ticket, fields: ['summary', 'status', 'resolution']});
  
        if (fields.status?.statusCategory?.name === 'Done' && fields.resolution) {
          results.push({
            message: `*** Ticket ${ticket} is closed with resolution ${fields.resolution.name}. Reopen it to unblock the release.`,
          });
        }
      } catch (e: unknown) {
        const error = e as Error & { errorMessages?: string[] };
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