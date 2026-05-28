# License notes: ZOXEXIVO/open-football-database

**Repo:** https://github.com/ZOXEXIVO/open-football-database
**Checked:** 2026-05-27

## License status

No LICENSE file is present in the repository. GitHub's API returns 404 for the license
endpoint, confirming no license has been declared. The README says only:
"OpenFootball clubs/players database for demo purposes only."

The companion engine repo (ZOXEXIVO/open-football) is Apache-2.0, but that license does
not extend to this database repo — they are separate repositories with separate licensing.

## What "no license" means under copyright law

Under the Berne Convention (the default in all major jurisdictions), a work with no
explicit license is under full copyright: all rights reserved by the author. Without a
license, there is no legal grant to copy, modify, redistribute, or build derivative works.

"Demo purposes only" in the README could be read as an intent-to-share, but it is not a
legal grant of rights.

## Practical risk assessment

| Use | Risk level | Notes |
|---|---|---|
| Cloning the repo for personal use | Low | GitHub TOS permits cloning public repos |
| Running our importer against a user-cloned copy | Ambiguous | We don't distribute the data; the user controls their own clone |
| Redistributing the data or any transformed form | High | No license = all rights reserved |
| Committing any data from the repo to our git history | High | Hard rule — never do this |

## Our architecture

We are providing a read-only converter script. Users clone the source repo themselves;
we do not redistribute, embed, or host any data from it. The output (.pack.json) is
gitignored and stays on the user's machine.

This is the same pattern used by tools like Lutris (game installers that fetch data from
third-party sources the user already has rights to). The argument is that we are a tool,
not a distributor.

However, because there is **no license at all**, this remains legally ambiguous. The
author could at any time assert copyright over the data format and content.

## Judgment

We can proceed with building the importer with the following safeguards already in place:

1. Zero data committed to our repo (players, clubs, names, IDs, JSON snippets).
2. Output files gitignored.
3. README states clearly that users must clone the source themselves.
4. We do not host, cache, or proxy the source data.

The risk is low given the "demo purposes only" framing and the project's history of
being used as an open reference. But we should:
- Monitor the repo for any future license declaration.
- If the author adds a restrictive license, immediately audit and remove any API
  compatibility we have with their format (or switch to a permissively-licensed
  alternative).
- Ideally reach out to ZOXEXIVO to request an explicit open license (MIT or Apache-2.0).

## Recommendation

Proceed with Phase 1 with the safeguards above. The architectural choice (user provides
the data, we provide the tool) is the correct way to handle an unlicensed data source.
