// Maestro's JS runtime has no sleep; busy-wait on the clock (only used for the background flow).
const end = Date.now() + Number(MS);
while (Date.now() < end) { /* wait */ }
