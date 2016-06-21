"use strict"

var casper = require('casper').create({
	pageSettings: {
		loadImages: false,	// The WebPage instance used by Casper will
		loadPlugins: false	// use these settings
	},
	viewportSize: {
		width: 1600,
		height: 950
	},
	logLevel: "debug", // All messages will be logged
	verbose: true      // log messages will be printed out to the console
});

var data = require(casper.cli.args[0]);
var badgeData = data["badges"];
var badgeTypeString = data["badgeTypeString"];
var badgePaymentType = data["badgePaymentType"];

var config = require("config.json")
var eid = config["eventId"];

var COUNT = -1;
var FULL_NAME = 0;
var BADGE_NAME = 1;
var EMAIL = 2;

casper.start("https://www.eventbrite.com/login/", function() {
	casper.on( 'page.error', function (msg, trace) {
		this.echo( 'Error: ' + msg, 'ERROR' );
	});

	var loginCredentials = {
		email: config["login"]["email"],
		password: config["login"]["password"]
	};

	this.fill('div#authentication-container form', loginCredentials, false);
	casper.click('input[value="Log in"]');

	capture(casper, "at_login.png");
});

casper.wait(10000, function() {
	// Need to wait for some amount of time for the login to finish
});

casper.waitForUrl("https://www.eventbrite.com/", function() {
	capture(casper, "post_login.png");

	var iterationCount = 0;
	casper.each(badgeData, function(self, badgeInfo) {

		if(COUNT < 0) {
			var countOfBadges = 1;
		} else {
			var countOfBadges = badgeInfo[COUNT];
		}

		self.thenOpen('https://www.eventbrite.com/attendees-add?eid='+eid, function() {
			this.page.injectJs('includes/jquery.min.js');

			capture(self, 'attendees_add_pre.png');

			self.waitForSelector('form[name="ticketForm"]', function () {
				var badgeQuantityInputName = this.evaluate(function(badgeTypeString) {
					var temp = $("tr.ticket_row td:first-child").filter(function() {
						var txt = $(this).find("div").text();
						// Do exact comparison, otherwise can't pick badges that are strict
						// substrings of earlier ones
						return badgeTypeString === txt;
					});

					return temp.parent().find('input[id^="quant"]')[0].name;
				}, badgeTypeString);

				this.echo("Input name " + badgeQuantityInputName, 'DEBUG');

				// Have to create object this way to set a property name based on a variable
				var obj = {};
				obj['input[name="'+badgeQuantityInputName+'"]'] = countOfBadges;
				this.fillSelectors('form[name="ticketForm"]', obj, false);

				// Change the payment type dropdown.
				// Should be 'paypal' for vendors and 'comp' for everyone else.
				this.evaluate(function(badgePaymentType) {
					$("#pp_payment_status").val(badgePaymentType).change();
				}, badgePaymentType);

				capture(self, 'attendees-add.png');

				// Submit the form
				this.fill('form[name="ticketForm"]', {}, true);
			});
		});

		// Wait for the page to load.
		self.waitForSelector('form#registrationForm', function() {
			this.page.injectJs('includes/jquery.min.js');

			// ********************* Order information
			// Split full name into first and last by the first space
			var fullNameArr = badgeInfo[FULL_NAME].trim().split(' ');
			var fullNameFirst = fullNameArr.shift();
			var fullNameLast = fullNameArr.join(' ');
			if (fullNameLast === "") {
				fullNameLast = "(not provided)";
			}
			var trimmedEmail = badgeInfo[EMAIL].trim();

			this.fill('form#registrationForm', {
				first_name: fullNameFirst,
				last_name: fullNameLast,
				email_address: trimmedEmail
			}, false);

			// ********************* Information for each attendee
			var attendeeFirstNames = this.getElementsAttribute('input[name$="_first_name"]', 'name');
			var attendeeLastNames = this.getElementsAttribute('input[name$="_last_name"]', 'name');
			var attendeeEmailAddresses = this.getElementsAttribute('input[name$="_email_address"]:not([name*="confirm"])', 'name');
			// Custom questions
			var attendeeBadgeNames = extractCustomQuestionNames(this, "Badge Name");
			var attendeeWaivers = extractCustomQuestionNames(this, "Waivers");

			// Make it once so we can fill everything at once >:D
			var selectorObj = {};

			// If the badge name is empty, use the "first" name
			var badgeName = badgeInfo[BADGE_NAME].trim();
			if (badgeName === "") {
			  badgeName = fullNameFirst;
			}

			// Populate the current attendee's selectors
			selectorObj['input[name='+attendeeFirstNames[0]+']'] = fullNameFirst;
			selectorObj['input[name='+attendeeLastNames[0]+']'] = fullNameLast;
			selectorObj['input[name='+attendeeEmailAddresses[0]+']'] = trimmedEmail; // always the same
			selectorObj['input[name='+attendeeBadgeNames[0]+']'] = badgeName;
			selectorObj['input[name='+attendeeWaivers[0]+']'] = true; // check waiver box

			this.fillSelectors('form#registrationForm', selectorObj, false);

			capture(self, 'registration.png');

			// Submit the form
			this.fill('form#registrationForm', {}, true);
		}, function(){ this.echo("Timed out waiting for form to load on row " + iterationCount + ": " + badgeInfo, 'ERROR'); }, 20000);
		//	I think it has to submit something to finalize it.
		self.waitForUrl(/^https?:\/\/www\.eventbrite\.com\/reports.*/, function() {
			iterationCount++; // Increase our iteration! // Not sure why I'm doing this!
		}, function(){ this.echo("Timed out trying to add row " + iterationCount + ": " + badgeInfo, 'ERROR'); }, 20000);
	});
});

function extractCustomQuestionNames(casperInstance, question) {
	return casperInstance.evaluate(function(questionText) {
		// return all td elements matching the given question text
		var temp = $("tr td:first-child").filter(function() {
			return $(this).text().indexOf(questionText) > -1;
		});
		// the actual input is in the next table row, so get the td's parent tr
		// and then get the next tr over, because Eventbrite sucks
		var domNodes = temp.parent().next().find('input').get();
		// return array containing the names of all specified custom question inputs
		return [].map.call(domNodes, function(node) {
			return node.getAttribute('name');
		});
	}, question);
}

/// Count for screenshots
var captureId = 0;
/// For taking numbered screenshots
function capture(casperInstance, filenameSuffix) {
	casperInstance.capture('captures/pic' + captureId + '_' + filenameSuffix);
	captureId++;
}

casper.run();
