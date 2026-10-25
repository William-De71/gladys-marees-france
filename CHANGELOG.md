# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.2.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords and countries ([cb043d1](https://github.com/William-De71/gladys-marees-france/commit/cb043d1852cf9e1dfde6684c65003b81528de666))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([2716882](https://github.com/William-De71/gladys-marees-france/commit/27168825982de6abdd7918164015724266bba09f))

## [0.1.0] - 2026-10-16

### Added

- Tides of up to five French harbors from the SHOM predictions (387 harbors: mainland France, overseas, a few foreign ones), picked in a list or typed by name, with a "Find a harbor" button.
- A device per harbor: water height now, rising or falling tide, next tide in words, minutes to the next high and low tide and their heights, coefficient of the next high tide and highest coefficient of tomorrow.
- Scene triggers: high or low tide at its time or 15 minutes to 6 hours before; spring tide of a coefficient of at least 70 to 115, up to the day before, with the following low tide.
- Scene action: get the next tide of a harbor, with a summary ready for a message.
- Dashboard widgets: tide of the day with the curve of the water height and its high and low tides, the next eight tides with their coefficient, the coefficients of the coming two weeks.
- One download a day per harbor, kept in /data; states and scene events computed locally every minute, each event fired once, even after a restart; "Download now" and "Diagnostic" buttons.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.2.0]: https://github.com/William-De71/gladys-marees-france/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-marees-france/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-marees-france/releases/tag/v0.1.0
