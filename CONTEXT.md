# GoodWatch

GoodWatch analyzes movies and shows into a structured "DNA" profile and uses it for discovery and recommendations.

## Language

### DNA generation

**Fingerprint**:
The 74 named trait scores of a title, each an integer from 0 to 10, serialized in schema order.
_Avoid_: DNA vector, score vector, trait vector

**DNA**:
The full generated analysis of a title: fingerprint, highlight keys, essence text, essence tags, advisories, and viewing context.
_Avoid_: Analysis, profile

**Essence text**:
The short evocative description of a title inside its DNA.

**Premium tier**:
Titles with TMDB popularity at or above 1.0, or released within the last 12 months. Generated with the primary model.
_Avoid_: Popular titles, important titles

**Economy tier**:
Every title that isn't premium tier. Generated with the fallback model by default.
_Avoid_: Unpopular titles, long tail

**Primary model**:
The model that generates premium-tier DNA and takes over economy-tier titles the fallback model can't complete.

**Fallback model**:
The model that generates economy-tier DNA and takes over premium-tier titles the primary model can't complete.
_Avoid_: Secondary model, backup model

### Queue

**Completeness queue**:
The two-phase selection order for DNA generation: never-selected titles by descending popularity, then already-selected titles by oldest selection.

**Soft reset**:
Clearing a title's selection timestamp so it re-enters phase 1 of the completeness queue, without deleting its existing DNA.
_Avoid_: Reset, regeneration, backfill

**Spend pause**:
The state where the model provider's spending limit is reached and generation runs stop until the limit resets.
_Avoid_: Quota block, budget stop
