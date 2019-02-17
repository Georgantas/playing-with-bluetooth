
var bleno = require('bleno');

var link_loss_alert_level = 0;
var immediate_alert_level = 0;

var temperature_timer;
var celsius = 0.00;

var flash_count = 0;
var flash_state = 1;
var beep_count = 0;
var beep_state = 1;
var alert_timer;
var flashing = 0;
var beeping = 0;
var active_leds = [];

bleno.on('stateChange', function (state) {
	console.log('on -> stateChange: ' + state);

	if (state === 'poweredOn') {
		// 1803 is the UUID for the link loss service
		// found at: https://www.bluetooth.com/specifications/gatt/services
		// This service defines behavior when a link is lost between two devices.
		// unclear why we're using it's UUID here, and not later in the 'advertisingStart' callback
		bleno.startAdvertising('BDSK', ['1803']);
	} else {
		bleno.stopAdvertising();
	}
});

bleno.on('advertisingStart', function (error) {
	console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

	if (!error) {
		bleno.setServices([
			//  link loss service
			new bleno.PrimaryService({
				uuid: '1803',
				characteristics: [
					// Alert Level: https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.characteristic.alert_level.xml
					new bleno.Characteristic({
						value: 0,
						uuid: '2A06',
						properties: ['read', 'write'],
						onReadRequest: function (offset, callback) {
							console.log('link loss.alert level READ:');
							data = [0x00];
							data[0] = link_loss_alert_level;
							var octets = new Uint8Array(data);
							console.log(octets);
							callback(this.RESULT_SUCCESS, octets);
						},
						onWriteRequest: function (data, offset, withoutResponse, callback) {
							console.log("link loss.alert level WRITE:");
							this.value = data;
							var octets = new Uint8Array(data);
							console.log("0x" + u8AToHexString(octets).toUpperCase());
							// application logic for handling WRITE or WRITE_WITHOUT_RESPONSE on characteristic Link Loss Alert Level goes here
							link_loss_alert_level = octets[0];
							var led = getLed(link_loss_alert_level);
                            				allLedsOff();
							startFlashing(led, 250, 4);
							callback(this.RESULT_SUCCESS);
						}
					})
				]
			}),
			//  immediate alert service
			new bleno.PrimaryService({
				uuid: '1802',
				characteristics: [
					// Alert Level
					new bleno.Characteristic({
						value: 0,
						uuid: '2A06',
						properties: ['writeWithoutResponse'],
						onWriteRequest: function (data, offset, withoutResponse, callback) {
							console.log("immediate alert.alert level WRITE:");
							this.value = data;
							var octets = new Uint8Array(data);
							console.log("0x" + u8AToHexString(octets).toUpperCase());
							immediate_alert_level = octets[0];
							flash_count = (immediate_alert_level + 3) * 2;
							startBeepingAndflashingAll(250, immediate_alert_level);
							callback(this.RESULT_SUCCESS);
						}
					})
				]
			}),
			//  TX power service
			new bleno.PrimaryService({
				uuid: '1804',
				characteristics: [
					// Power Level
					new bleno.Characteristic({
						value: 0,
						uuid: '2A07',
						properties: ['read'],
						onReadRequest: function (offset, callback) {
							console.log('TX Power.level read request:');
							data = [0x0A];
							var octets = new Uint8Array(data);
							callback(this.RESULT_SUCCESS, octets);
						}
					})
				]
			}),
			//  proximity monitoring service
			new bleno.PrimaryService({
				uuid: '3E099910293F11E493BDAFD0FE6D1DFD',
				characteristics: [
					// client proximity
					new bleno.Characteristic({
						value: 0,
						uuid: '3E099911293F11E493BDAFD0FE6D1DFD',
						properties: ['writeWithoutResponse'],
						onWriteRequest: function (data, offset, withoutResponse, callback) {
							console.log("proximity monitoring.client proximity WRITE:");
							this.value = data;
							var octets = new Uint8Array(data);
							console.log("0x" + u8AToHexString(octets).toUpperCase());
							var proximity_band = octets[0];
							var client_rssi = octets[1];
							client_rssi = (256 - client_rssi) * -1;
							allLedsOff();
							if (proximity_band == 0) {
								// means the user has turned off proximity sharing 
								// so we just want to switch off the LEDs
								console.log("Proximity Sharing OFF");
							} else {
								var proximity_led = getLed(proximity_band - 1);
								//proximity_led.writeSync(1);
								console.log("Client RSSI: " + client_rssi);
							}
							callback(this.RESULT_SUCCESS);
						}
					})
				]
			}),
			//  health thermometer service
			new bleno.PrimaryService({
				uuid: '1809',
				characteristics: [
					// temperature measurement
					new bleno.Characteristic({
						value: 0,
						uuid: '2A1C',
						properties: ['indicate'],
						onSubscribe: function (maxValueSize, updateValueCallback) {
							console.log("subscribed to temperature measurement indications");
							simulateTemperatureSensor(updateValueCallback);
							//sampleTemperatureSensor(updateValueCallback);
						},

						// If the client unsubscribes, we stop broadcasting the message
						onUnsubscribe: function () {
							console.log("unsubscribed from temperature measurement indications");
							clearInterval(temperature_timer);
						}
					})
				]
			}),
		]);
	}
});

bleno.on('servicesSet', function (error) {
	console.log('on -> servicesSet: ' + (error ? 'error ' + error : 'success'));
});

bleno.on('accept', function (clientAddress) {
	console.log('on -> accept, client: ' + clientAddress);
	flash_count = 0;
	flashing = 0;
	beep_count = 0;
	clearInterval(alert_timer);
    beepOff();
	allLedsOff();
});

bleno.on('disconnect', function (clientAddress) {
	console.log("Disconnected from address: " + clientAddress);
	if (link_loss_alert_level > 0) {
		console.log("Alerting due to link loss");
		flash_count = link_loss_alert_level * 4 * 15; // 4 per second, 15 seconds or 30 seconds
		startBeepingAndflashingAll(250, link_loss_alert_level);
	}
});

function startFlashing(led, interval, times) {
	console.log("start flashing called, args:", led, interval, times);
}

function getLed() {
	console.log("getLed() called.");
	return 1;
}

function flash_leds() {
	console.log("flash_leds() called.");
}
function allLedsOff() {
	console.log("allLedsOff() called.");
}
function beepOff() {
	console.log("beepOff() called.");
}

function beep() {
	console.log("beep() called.");
}

function startBeepingAndflashingAll(interval, alert_level) {
	console.log("startBeepingAndflashingAll() called, args:", interval, alert_level);
}
function beepAndFlashAll() {
	console.log("beepAndFlashAll() called.");
}

function u8AToHexString(u8a) {
	if (u8a == null) {
		return '';
	}
	hex = '';
	for (var i = 0; i < u8a.length; i++) {
		hex_pair = ('0' + u8a[i].toString(16));
		if (hex_pair.length == 3) {
			hex_pair = hex_pair.substring(1, 3);
		}
		hex = hex + hex_pair;
	}
	return hex.toUpperCase();
}

function simulateTemperatureSensor(updateValueCallback) {
	temperature_timer = setInterval(function () {
		celsius = celsius + 0.1;
		if (celsius > 100.0) {
			celsius = 0.00;
		}
		console.log("simulated temperature: " + celsius + "C");
		celsius_times_10 = celsius * 10;
		var value = [0, 0, 0, 0, 0];
		value[4] = 0xFF; // exponent of -1
		value[3] = (celsius_times_10 >> 16);
		value[2] = (celsius_times_10 >> 8) & 0xFF;
		value[1] = celsius_times_10 & 0xFF;
		var buf = Buffer.from(value);
		updateValueCallback(buf);
	}, 1000);
}



