"use strict"

var casper = require('casper').create({
	pageSettings: {
		loadImages:  false,        // The WebPage instance used by Casper will
		loadPlugins: false         // use these settings
	},
	logLevel: "debug",              // Only "info" level messages will be logged
	verbose: true                  // log messages will be printed out to the console
});

// var badgeData = require('vendor_final_update.json');
var config = require("config.json")
// Shift off the header row. That's not helpful.
// var headers = badgeData.shift();

// API Test: 1234567890
// Real Event 1234567890
var eid = config["eventId"];
var loginCredentials = {
  email: config["login"]["email"],
  password: config["login"]["password"]
};

var COUNT = 0;
var FULL_NAME = 1;
var BADGE_NAME = 2;
var EMAIL = 3;
var FIRST_BADGE_COLUMN = 1;
var LAST_BADGE_COLUMN = 15;
// var badgeData = [/*["1","1001-A","Cute N' Kitschy","xiagu@bronycon.org","Kelly Sapp","Kelly Sapp","","","","","","","","","","","","",""],*/
				// ["2","1001-B","Angel Trip Studio","xiagu@bronycon.org","Jazmin Ruotolo","Jaz Kitty","Oscar Matos","Papi-san","","","","","","","","","N/A","$50.00","8R959523JM276693B"]];/*,
//				["1","1002-A","Ajin Arts","xiagu@bronycon.org","Ciro Ramirez Jr","Ajin","","","","","","","","","","","","",""]*/
//				["6","710","Lemonbrat: Cutie Corral","xiagu@bronycon.org","Corey Wood","Dashing Spirits","Barbara Staples","Jezebel Tart","Michael Smith","Bitz","Ryan Numrich","Helping Hooves","Lucie Rider","Fluttershy","Matt Jacob","Buckie","N/A","$200.00 ","1M393666A6289905P"]];
// var badgeData = [["4","420","Butts N Stuff","xiagu@bronycon.org","Stephanie Sanjurjo","Stephy Butts","Raul Ortiz","darkmagician1212","TKeyah Nowell","Le' Butch","Jesse Young","Knucklesjes","","","","","N/A","$100.00 ","74Y59622MG0138548 / 3SS39107FL379892U"]];
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
	
  capture(casper, 'login.png');

	this.fill("form.responsive-form", loginCredentials, true);
});

casper.waitForUrl("https://www.eventbrite.com/", function() {
	var iterationCount = 0;
	casper.each(badgeData, function(self, badgeInfo) {

		self.thenOpen('https://www.eventbrite.com/attendees-add?eid='+eid, function() {
			this.page.injectJs('includes/jquery.min.js');
				
			var name = this.evaluate(function(badgeTypeString) {
				var temp = $("tr.ticket_row td:first-child").filter(function() {
					var txt = $(this).text();
					var index = txt.indexOf(badgeTypeString);
					// console.log("(" + badgeTypeString + ") Badge type " + txt + " || " + index);
					return index > -1; // JavaScript has no 'contains' method, apparently
				});
				return temp.parent().find('input[name^="quant"]')[0].name;
			}, badgeTypeString);
			this.echo("Input name " + name, 'INFO');
			
			// Have to create object this way to set a property name based on a variable
			var obj = {};
			obj['input[name="'+name+'"]'] = badgeInfo[COUNT];
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
			var fullNameArr = badgeInfo[FIRST_BADGE_COLUMN].split(' ');
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
			var attendeeBadgeNames = extractCustomQuestionNames(this, "Badge Name:");
			var attendeeBoothNumberNames = extractCustomQuestionNames(this, "Booth Number");
			var attendeeBoothNameNames = extractCustomQuestionNames(this, "Booth Name");

			// all the numbers match up now

			// Make it once so we can fill everything at once >:D
			var selectorObj = {};
			for(var i = 0; i < badgeInfo[COUNT]; i++) {
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
				selectorObj['input[name='+attendeeBoothNumberNames[i]+']'] = badgeInfo[BOOTH_NUM]; // always the same
				selectorObj['input[name='+attendeeBoothNameNames[i]+']'] = badgeInfo[BOOTH_NAME]; // always the same
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