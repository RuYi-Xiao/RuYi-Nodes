The bundled Typo.js library is adapted to accept preloaded `.aff` and `.dic`
text only. RuYi-Nodes loads its bundled dictionary files in `worker.mjs` before
constructing Typo. The upstream automatic browser/Node file loader has been
removed; dictionary parsing, spelling checks and suggestions are retained.

Upstream copyright and redistribution terms are in `TYPO-LICENSE.txt`.
Dictionary notices are in `EN-LICENSE.txt`.
