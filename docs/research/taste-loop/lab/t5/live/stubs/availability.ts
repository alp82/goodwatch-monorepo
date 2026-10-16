// Services are empty in T5. An accidental availability request must fail closed.
export function isOnServices(): never { throw new Error('T5 cannot load availability') }
