import fs from 'fs';
import path from 'path';
import { AppError } from '../../error.js';
import {
  IssueInputSchema,
  CreateIssueInputSchema,
  UpdateIssueInputSchema,
  normalizeIssueInput,
  type IssueInput,
  type CreateIssueInput,
  type UpdateIssueInput,
} from './IssueInputSchema.js';

export interface LoadIssueFromJsonOptions {
  mode: 'create' | 'update';
}

/**
 * Load and validate issue input from a JSON file.
 */
export function loadIssueFromJson(
  filePath: string,
  options: LoadIssueFromJsonOptions = { mode: 'create' }
): IssueInput {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw AppError.config(`Issue JSON file not found: ${resolvedPath}`);
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    throw AppError.config(`Failed to read issue JSON file: ${resolvedPath}`, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw AppError.config(`Invalid JSON in issue file: ${resolvedPath}`, error);
  }

  const baseResult = IssueInputSchema.safeParse(parsed);
  if (!baseResult.success) {
    const issues = baseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.validation(`Invalid issue input: ${issues}`);
  }

  const normalized = normalizeIssueInput(baseResult.data);

  const schema = options.mode === 'create' ? CreateIssueInputSchema : UpdateIssueInputSchema;
  const validationResult = schema.safeParse(normalized);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.validation(`Invalid issue input for ${options.mode}: ${issues}`);
  }

  return normalized;
}

/**
 * Load and validate issue input for creation from a JSON file.
 */
export function loadCreateIssueFromJson(filePath: string): CreateIssueInput {
  const input = loadIssueFromJson(filePath, { mode: 'create' });
  return input as CreateIssueInput;
}

/**
 * Load and validate issue input for update from a JSON file.
 */
export function loadUpdateIssueFromJson(filePath: string): UpdateIssueInput {
  const input = loadIssueFromJson(filePath, { mode: 'update' });
  return input as UpdateIssueInput;
}

/**
 * Parse issue input from a JSON string.
 */
export function parseIssueInputFromString(
  jsonString: string,
  options: LoadIssueFromJsonOptions = { mode: 'create' }
): IssueInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw AppError.config('Invalid JSON string', error);
  }

  const baseResult = IssueInputSchema.safeParse(parsed);
  if (!baseResult.success) {
    const issues = baseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.validation(`Invalid issue input: ${issues}`);
  }

  const normalized = normalizeIssueInput(baseResult.data);

  const schema = options.mode === 'create' ? CreateIssueInputSchema : UpdateIssueInputSchema;
  const validationResult = schema.safeParse(normalized);

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.validation(`Invalid issue input for ${options.mode}: ${issues}`);
  }

  return normalized;
}
