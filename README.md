# Eventbrite Auto-loader

Uses headless browser automation to automate the adding of attendees to an Eventbrite event. Configurable to pick a specific badge type, payment type, and fill in the answers to custom questions.

Example use: If there are many people who need complimentary badges (such as guest speakers), this lets you avoid having to put them all in by hand.

## Caveat
As with all tools based on web scraping and automation, it may break without warning if the Eventbrite site workflow changes.

Make a hidden event to test it with first (and use dummy emails, like your own) before doing anything with your real event.

## Usage
`npm install` should install the needed dependencies. Depending on your environment, you may need to install CasperJS globally, either with `npm install -g casperjs` or via the instructions available [here](http://docs.casperjs.org/en/latest/installation.html).

Run the script with:
```
casperjs ebcasper.js badge_data.json --ssl-protocol=any --ignore-ssl-errors=yes
```

The SSL flags are required for the script to run.


## Converting badge data to JSON
A very simple CSV to JSON script is included in `parse.js`.

### Usage

```
node parse.js example.csv > example.json
```

### Example JSON
https://gist.github.com/xiagu/f478a6d7cf8ea3aceaef
