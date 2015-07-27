"use strict"

var casper = require('casper').create({
	pageSettings: {
		loadImages:  false,        // The WebPage instance used by Casper will
		loadPlugins: false         // use these settings
	},
	logLevel: "debug",              // Only "info" level messages will be logged
	verbose: true                  // log messages will be printed out to the console
});

var badgeData = require(casper.cli.args[0]);
var config = require("config.json")
// Shift off the header row. That's not helpful.
// var headers = badgeData.shift();

// API Test: 1234567890
// Real Event 1234567890
var eid = config["eventId"];

var COUNT = -1;
var FULL_NAME = 0;
var BADGE_NAME = 1;
var EMAIL = 2;
var FIRST_BADGE_COLUMN = 0;
var LAST_BADGE_COLUMN = 15;

// var badgeData = [/*[1,"Lorem Ipsum","DevBadgerDontAccept","registration@bronycon.org",""],*/
                 // [1,"John Testerman","Test","registration@bronycon.org",""]];

var badgeTypeString = config["badgeTypeString"];
var badgePaymentType = config["badgePaymentType"];

casper.start("https://www.eventbrite.com/login/", function() {
	// Set it up so remote logging gets replayed locally
	// casper.on("remote.message", function(message) {
	// 	this.echo("remote console.log: " + message);
	// });

	casper.on( 'page.error', function (msg, trace) {
		this.echo( 'Error: ' + msg, 'ERROR' );
	});

  var loginCredentials = {
    email: config["login"]["email"],
    password: config["login"]["password"]
  };

	this.fill("form.responsive-form.l-block-3", loginCredentials, false);
  casper.click("form.responsive-form.l-block-3 input[type='submit']");

  capture(casper, "at_login.png");
});

casper.wait(10000, function() {
  // Need to wait for some amount of time for the login to finish
})

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
				
			var name = this.evaluate(function(badgeTypeString) {
        // console.log($("tr.ticket_row td:first-child").length);
				var temp = $("tr.ticket_row td:first-child").filter(function() {
					var txt = $(this).text();
					var index = txt.indexOf(badgeTypeString);
					// console.log("(" + badgeTypeString + ") Badge type " + txt + " || " + index);
					return index > -1; // JavaScript has no 'contains' method, apparently
				});
        // console.log(temp.length);
				return temp.parent().find('input[name^="quant"]')[0].name;
			}, badgeTypeString);
			this.echo("Input name " + name, 'INFO');
			
			// Have to create object this way to set a property name based on a variable
			var obj = {};
			obj['input[name="'+name+'"]'] = countOfBadges;
			this.fillSelectors('form[name="ticketForm"]', obj, false);

			// Change the payment type dropdown. Should be PayPal for vendors and complimentary for everyone else.
			this.evaluate(function(badgePaymentType) {
				$("#pp_payment_status").val(badgePaymentType).change();
			}, badgePaymentType);

			capture(self, 'attendees-add.png');

			// Submit the form
			this.fill('form[name="ticketForm"]', {}, true);
		});

		// Wait for the page to load.
		self.waitForSelector('form#registrationForm', function() {
			this.page.injectJs('includes/jquery.min.js');

			// ********************* Order information
			var fullNameArr = badgeInfo[FULL_NAME].split(' ');
			var fullNameFirst = fullNameArr.shift();
			var fullNameLast = fullNameArr.join(' ');
			if (fullNameLast === "") {
				fullNameLast = "(not provided)";
			}
			this.fill('form#registrationForm', {
				first_name: fullNameFirst,
				last_name: fullNameLast,
				email_address: badgeInfo[EMAIL]
			}, false);

			// ********************* Information for each attendee
			var attendeeFirstNames = this.getElementsAttribute('input[name$="_first_name"]', 'name');
			var attendeeLastNames = this.getElementsAttribute('input[name$="_last_name"]', 'name');
			var attendeeEmailAddresses = this.getElementsAttribute('input[name$="_email_address"]:not([name*="confirm"])', 'name');
			// Custom questions
			var attendeeBadgeNames = extractCustomQuestionNames(this, "Badge Name");

			// Make it once so we can fill everything at once >:D
			var selectorObj = {};
			for(var i = 0; i < countOfBadges; i++) {
				var infoIndex = FIRST_BADGE_COLUMN + i*2;
				// Split full name into first and last by the first space
				var fullNameArr = badgeInfo[infoIndex].split(' ');
				var fullNameFirst = fullNameArr.shift();
				var fullNameLast = fullNameArr.join(' ');
				// Populate the current attendee's selectors
				selectorObj['input[name='+attendeeFirstNames[i]+']'] = fullNameFirst;
				selectorObj['input[name='+attendeeLastNames[i]+']'] = fullNameLast;
				selectorObj['input[name='+attendeeEmailAddresses[i]+']'] = badgeInfo[EMAIL]; // always the same
				selectorObj['input[name='+attendeeBadgeNames[i]+']'] = badgeInfo[infoIndex + 1];
			}
			this.fillSelectors('form#registrationForm', selectorObj, false);

			capture(self, 'registration.png');

			// Submit the form
			this.fill('form#registrationForm', {}, true);
		}, function(){ this.echo("Timed out waiting for form to load on row " + iterationCount + ": " + badgeInfo, 'ERROR'); }, 20000);
		//	I think it has to submit something to finalize it.
		// https://www.eventbrite.com/reports
		self.waitForUrl(/^https?:\/\/www\.eventbrite\.com\/reports.*/, function() {
			iterationCount++; // Increase our iteration! // Not sure why I'm doing this!
		}, function(){ this.echo("Timed out trying to add row " + iterationCount + ": " + badgeInfo, 'ERROR'); }, 20000);
	});
});

function extractCustomQuestionNames(casperInstance, question) {
	return casperInstance.evaluate(function(questionText) {
		var temp = $("tr.survey_question td:first-child").filter(function() {
			return $(this).text().indexOf(questionText) > -1;
		});
		var domNodes = temp.parent().find('input').get();
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