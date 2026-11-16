/** Game-time multiplier of the dev-only smoke lap (`tippySoak.smoke()`); 1 everywhere else. */
let speed = 1;

export function setSoakSpeed(value: number): void {
  speed = value;
}

export function soakSpeed(): number {
  return speed;
}
