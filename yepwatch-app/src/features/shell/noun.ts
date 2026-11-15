/**
 * The visible name of a room. People see "couch" everywhere ("New couch", "Alper's couch", "Your
 * couches"); code, API paths and tables keep "room". Every visible string that names one comes from
 * here, so a rename is one edit.
 */
const one = 'couch';
const many = 'couches';
const upper = (word: string) => word[0].toUpperCase() + word.slice(1);

export const noun = {
  /** "couch" */
  one,
  /** "couches" */
  many,
  /** "Couch": a heading or a button on its own. */
  One: upper(one),
  /** "a couch" */
  a: `a ${one}`,
  /** "New couch" */
  create: `New ${one}`,
  /** "Create couch": the action that makes one. */
  make: `Create ${one}`,
  /** "Your couches" */
  yours: `Your ${many}`,
  /** "Your couch" */
  yourOne: `Your ${one}`,
  /** "Join a couch" */
  joinAny: `Join a ${one}`,
  /** "Join the couch" */
  joinThe: `Join the ${one}`,
  /** "this couch" */
  this: `this ${one}`,
  /** "This couch" */
  This: `This ${one}`,
  /** "Alper’s couch" */
  of: (name: string) => `${name}’s ${one}`,
  /** "Join Alper’s couch" */
  join: (name: string) => `Join ${name}’s ${one}`,
  /** A couch's name when nothing else names it: "Alper’s couch", or "Couch" while the host has no name. */
  named: (host: string) => (host ? `${host}’s ${one}` : upper(one)),
} as const;
