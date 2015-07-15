var casper = require('casper').create({
	pageSettings: {
		loadImages:  false,        // The WebPage instance used by Casper will
		loadPlugins: false         // use these settings
	},
	logLevel: "debug",              // Only "info" level messages will be logged
	verbose: true                  // log messages will be printed out to the console
});

var badgeData = require('musicians.json');
// Shift off the header row. That's not helpful.
var headers = badgeData.shift();

// API Test: 1234567890
// Real Event 1234567890
var eid = 1234567890;

var FULL_NAME = 0;
var BADGE_NAME = 1;
var EMAIL = 2;

// var badgeData = [["Detrix Thompson","TheLightLeavesThee","xiagu@bronycon.org",""],
// 				 ["John Testerman","Iron Solari","xiagu@bronycon.org",""]];
var badgeTypeString = "Musician";
var badgePaymentType = "comp";

casper.start('https://www.eventbrite.com/login', function() {
	// Set it up so remote logging gets replayed locally
	// casper.on("remote.message", function(message) {
	// 	this.echo("remote console.log: " + message);
	// });

	casper.on( 'page.error', function (msg, trace) {
		this.echo( 'Error: ' + msg, 'ERROR' );
	});
	
	this.fill('form[action="/login"]', { email: 'registration@bronycon.org', password: 'hunter2' }, true);
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
			
			// Have to create object this way to set a property name based on a variable
			var obj = {};
			obj['input[name="'+name+'"]'] = 1; // adding 1 panelist at a time
			this.fillSelectors('form[name="ticketForm"]', obj, false);

			// Change the payment type dropdown. Should be PayPal for vendors and complimentary for everyone else.
			this.evaluate(function(badgePaymentType) {
				$("#pp_payment_status").val(badgePaymentType).change();
			}, badgePaymentType);

			// capture(self, 'attendees-add.png');

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
			var attendeeBadgeNames = extractCustomQuestionNames(this, "Badge Name:");

			// Make it once so we can fill everything at once >:D
			var selectorObj = {};
		
			// Populate the current attendee's selectors
			selectorObj['input[name='+attendeeFirstNames[0]+']'] = fullNameFirst;
			selectorObj['input[name='+attendeeLastNames[0]+']'] = fullNameLast;
			selectorObj['input[name='+attendeeEmailAddresses[0]+']'] = badgeInfo[EMAIL]; // always the same
			selectorObj['input[name='+attendeeBadgeNames[0]+']'] = badgeInfo[BADGE_NAME];
			
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
	casperInstance.capture('pic' + captureId + '_' + filenameSuffix);
	captureId++;
}

casper.run();