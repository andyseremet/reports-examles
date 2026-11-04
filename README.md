# Environmental Data Report Generator

A single-page tool (`index.html`) that produces a preliminary environmental
screening report for a UK location.

## How to use

1. Open `index.html` in a web browser (no build step or server needed).
2. Pick a location: type coordinates, search for a place or postcode, or click the map.
3. Choose a search radius and click **Generate Environmental Report**.
4. Export the result as JSON, HTML, or print to PDF.

## Data sources

- Live: [Environment Agency Flood Monitoring API](https://environment.data.gov.uk/flood-monitoring/doc/reference)
  (flood warnings, monitoring stations, latest readings). Covers England only.
- Geocoding: [OpenStreetMap Nominatim](https://nominatim.org/release-docs/latest/api/Search/).
- Other topics (air quality, ecology, geology, etc.) are listed with links to
  the official sources for manual follow-up.

This is a desktop screening aid, not a site-specific environmental assessment.
