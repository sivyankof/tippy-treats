import { CRASH } from '../../data/app/telemetry';

/** One line of a stack, in the shape the Crashlytics plugin takes. */
export interface Frame {
  lineNumber?: number;
  fileName?: string;
  functionName?: string;
}

// V8 / Chrome / Android WebView: "at name (url:line:col)" or "at url:line:col".
const V8_LINE = /^\s*at (?:(.+?) \()?(.+?):(\d+):\d+\)?\s*$/;
// JavaScriptCore / Safari / iOS WebView: "name@url:line:col" or "@url:line:col".
const JSC_LINE = /^(.*?)@(.+?):(\d+):\d+\s*$/;

/** The last part of an address: a build's file name says enough, the rest is only the device's path. */
function baseName(url: string): string {
  const clean = url.split(/[?#]/)[0] ?? url;
  return clean.slice(clean.lastIndexOf('/') + 1) || clean;
}

/** The frames of a stack text, at most `CRASH.stackFramesMax`; lines in neither format are skipped. */
export function parseStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n')) {
    const match = V8_LINE.exec(line) ?? JSC_LINE.exec(line);
    if (!match) continue;
    const [, name, url, row] = match;
    if (!url) continue;
    frames.push({
      functionName: name && name.length > 0 ? name : '<anonymous>',
      fileName: baseName(url),
      lineNumber: Number(row),
    });
    if (frames.length >= CRASH.stackFramesMax) break;
  }
  return frames;
}

/** An error, or anything that was thrown, as a short message and its frames. */
export function describeError(error: unknown): { message: string; frames: Frame[] } {
  if (error instanceof Error) {
    const text = `${error.name}: ${error.message}`.slice(0, CRASH.messageMax);
    return { message: text, frames: parseStack(error.stack) };
  }
  let text: string;
  try {
    text = typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error));
  } catch {
    text = String(error);
  }
  return { message: text.slice(0, CRASH.messageMax), frames: [] };
}
