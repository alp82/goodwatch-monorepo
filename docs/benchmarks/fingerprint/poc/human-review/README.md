# Continuing the human fingerprint review

Open `review.html`. It loads `completed-review.original.json` unchanged and resumes at **all active reviews complete**. Candidate identities remain hidden and letters retain their original meanings.

Active labels: **A, B, D, E, F**. **0 reviews remain.** `settings.json` records the current selection and pending recommendations; `screening.json` adds the calculated remaining count. Pending recommendations do not remove candidates automatically.

Screened from further human review: H, M, G, I. Reasons and review history are recorded in `settings.json` and the original exports. C, J, K and L have no usable first-pass results. The early screen reduces human review workload; it is not a claim of catalog-wide inferiority and does not select the final two candidates.

Use Left/Right arrow keys for previous/next review. The shortcuts leave text editing and dropdown controls alone. Score-chip backgrounds fill proportionally from 0 to 10; flagged chips use amber.

Each supplied JSON export is preserved byte for byte in its original snapshot file. Progress exports retain all previous judgments, including screened/unavailable candidates. Export before closing the form; Import resumes later exports.

Keep this directory and its judgments out of independent Astra/Fable sessions. Their existing `../blind-first/` packets remain unchanged; all original responses and the separate model-label key are retained. No additional inference ran.
