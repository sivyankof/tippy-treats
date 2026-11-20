import { TELEMETRY } from '../../data/app/telemetry';
import type { EventParams } from './types';

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

/** A checked event: what may be sent, and what was dropped on the way. */
export interface CheckedEvent {
  /** `null` when the name itself is not allowed: the whole event is dropped. */
  name: string | null;
  params: Record<string, string | number>;
  problems: string[];
}

function nameProblem(name: string, max: number): string | null {
  if (!SNAKE_CASE.test(name)) return `"${name}" is not snake_case`;
  if (name.length > max) return `"${name}" is longer than ${max} characters`;
  if (TELEMETRY.reservedPrefixes.some((prefix) => name.startsWith(prefix)))
    return `"${name}" starts with a reserved prefix`;
  return null;
}

/**
 * Checks an event against the rules of docs/09, section 6: `snake_case` names up to 40 characters,
 * flat values, no reserved prefixes, at most 25 parameters. A parameter that breaks a rule is
 * dropped (a long text is cut, a boolean becomes 1 or 0), a bad event name drops the event.
 */
export function checkEvent(name: string, params: EventParams = {}): CheckedEvent {
  const problems: string[] = [];
  const bad = nameProblem(name, TELEMETRY.nameMax);
  if (bad) return { name: null, params: {}, problems: [`event ${bad}`] };
  const checked: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    const keyProblem = nameProblem(key, TELEMETRY.nameMax);
    if (keyProblem) {
      problems.push(`${name}: parameter ${keyProblem}`);
      continue;
    }
    if (Object.keys(checked).length >= TELEMETRY.paramsMax) {
      problems.push(`${name}: more than ${TELEMETRY.paramsMax} parameters`);
      break;
    }
    if (typeof value === 'boolean') checked[key] = value ? 1 : 0;
    else if (typeof value === 'number') {
      if (Number.isFinite(value)) checked[key] = value;
      else problems.push(`${name}: parameter "${key}" is not a finite number`);
    } else if (typeof value === 'string') {
      if (value.length > TELEMETRY.valueMax)
        problems.push(`${name}: parameter "${key}" was cut to ${TELEMETRY.valueMax} characters`);
      checked[key] = value.slice(0, TELEMETRY.valueMax);
    } else problems.push(`${name}: parameter "${key}" has a value of an unsupported type`);
  }
  return { name, params: checked, problems };
}

/** A checked user property: `name` is `null` when the name is not allowed. */
export function checkProperty(
  name: string,
  value: string,
): { name: string | null; value: string; problems: string[] } {
  const bad = nameProblem(name, TELEMETRY.propertyNameMax);
  if (bad) return { name: null, value, problems: [`property ${bad}`] };
  const problems =
    value.length > TELEMETRY.propertyValueMax
      ? [`property "${name}" was cut to ${TELEMETRY.propertyValueMax} characters`]
      : [];
  return { name, value: value.slice(0, TELEMETRY.propertyValueMax), problems };
}
