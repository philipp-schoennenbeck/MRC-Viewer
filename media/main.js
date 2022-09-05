/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// @ts-check
"use strict";




(function () {

	/**
	 * @param {number} value
	 * @param {number} min
	 * @param {number} max
	 * @return {number}
	 */
	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	function getSettings() {
		const element = document.getElementById('preview-mrc-settings');
		if (element) {
			const data = element.getAttribute('data-settings');
			if (data) {
				return JSON.parse(data);
			}
		}

		throw new Error(`Could not load settings`);
	}

	function setImageSrc(url) {
		var req = new XMLHttpRequest();
		req.open('GET', url);
		

		req.responseType = "arraybuffer";
		current_url = url;
		req.onload = function (e) {
			if (req.status == 200) {
				var src = getDataURL(req.response);
				if (src){
					image.src = src ;
				}
				else{
					vscode.postMessage({
						type: 'message',
						value: "This mrc mode is not supported right now."
					});
				}
			}
		};
		req.send();
		
	}

	function loadSlice(){

		var src = getSliceData();
		if (src){
			image.src = src;
		} 
		else{
			vscode.postMessage({
				type: 'message',
				value: "This mrc mode is not supported right now."
			});
		}
		
		// var req = new XMLHttpRequest();
		// req.open('GET', current_url);
		// req.responseType = "arraybuffer";

		// req.onload = function (e) {
		// 	if (req.status == 200) {
		// 		var src = getSliceData(req.response);
		// 		if (src){
		// 			image.src = src;
		// 		} 
		// 		else{
		// 			vscode.postMessage({
		// 				type: 'message',
		// 				value: "This mrc mode is not supported right now."
		// 			});
		// 		}
		// 	}
		// };
		// req.send();
		// getSliceData(req.response);
	}

	function getSliceData(){
		// var buffer = new Uint8Array(response);
		// var headerArray = new Uint32Array(response.slice(0,8));
		// var width = headerArray[0];
		// var height = headerArray[1];
		

		// var data = new mode(response.slice(1024 + width * height * current_slice * bit_size, 1024 + width * height * (current_slice + 1) * bit_size ));

		// var current_max_value = Number.MIN_VALUE;
		// var current_min_value = Number.MAX_VALUE;

		// for (var i = 0; i < data.length; i++){
		// 	if (data[i] < current_min_value ){current_min_value = data[i];}
		// 	if (data[i] > current_max_value ){current_max_value = data[i];}
		// }

		// data = data.map(i => (i - min_value ) / (max_value - min_value) * 255);

		// var idx = 0;
		// var new_data = new Uint8ClampedArray(width * height * 4);
		// for (var i = 0; i < new_data.length;i += 4){
		// 	idx = Math.round(i  / 4);
		// 	new_data[i] = data[idx];
		// 	new_data[i+1] = data[idx];
		// 	new_data[i+2] = data[idx];
		// 	new_data[i+3] = 255;
		// }
		var current_data = data.slice(width * height * current_slice * 4, width * height * (current_slice + 1) * 4)
		var canvas = document.createElement('canvas');
		canvas.width  = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');	
		var rgbaImage = new ImageData(current_data, width, height);
		ctx.putImageData(rgbaImage, 0, 0);
		return canvas.toDataURL();
	}

	function getDataURL(response) {

		// var buffer = new Uint8Array(response);

		var headerArray = new Uint32Array(response.slice(0,1024));

		
		width = headerArray[0];
		height = headerArray[1];



		max_slice = headerArray[2] - 1;
		mode = mode_map[headerArray[3]][1];
		bit_size = mode_map[headerArray[3]][0];

		start_byte = 1024 + headerArray[23];

		
		if (!mode){
			return null
		}

		data = new mode(response.slice(start_byte));

	
		var current_max_value = Number.MIN_VALUE;
		var current_min_value = Number.MAX_VALUE;

		for (var i = 0; i < data.length; i++){
			if (data[i] < current_min_value ){current_min_value = data[i];}
			if (data[i] > current_max_value ){current_max_value = data[i];}
		}


		min_value = current_min_value;
		max_value = current_max_value;
		
		data = data.map(i => (i - min_value ) / (max_value - min_value) * 255);


		// var intData = new Uint8ClampedArray(data);
		var idx = 0;
		var new_data = new Uint8ClampedArray(data.length * 4);
		for (var i = 0; i < new_data.length;i += 4){
			if (i % (width * height * 4) == 0){
				vscode.postMessage({
					type: 'slice',
					value: `${Math.round(i / (width * height * 4)) + 1}\/${max_slice + 1}`
				});
			}
			idx = Math.round(i  / 4);
			new_data[i] = data[idx];
			new_data[i+1] = data[idx];
			new_data[i+2] = data[idx];
			new_data[i+3] = 255;
			
		}

		data = new_data;
		var current_data = data.slice(0,width * height * 4);
		var canvas = document.createElement('canvas');
		canvas.width  = width;
		canvas.height = height;

		
	
		var ctx = canvas.getContext('2d');	
		var rgbaImage = new ImageData(current_data, width, height);
		ctx.putImageData(rgbaImage, 0, 0);
		vscode.postMessage({
			type: 'slice',
			value: `${current_slice + 1}\/${max_slice + 1}`
		});
		vscode.postMessage({
			type: 'updateSlicing',
			value: max_slice
		});

		return canvas.toDataURL();
	}

	/**
	 * Enable image-rendering: pixelated for images scaled by more than this.
	 */
	const PIXELATION_THRESHOLD = 3;

	const SCALE_PINCH_FACTOR = 0.075;
	const MAX_SCALE = 20;
	const MIN_SCALE = 0.1;
	var current_slice = 0;
	const min_slice = 0;
	var max_slice = 0;
	var mode = null;
	var bit_size = null;
	var current_url = null;
	var min_value = null;
	var max_value = null;
	var data = null;
	var width = null;
	var height = null;
	var start_byte = 1024;
	var mode_map = {0:[1, Int8Array], 1:[2, Int16Array], 2: [4, Float32Array], 3:[2, null], 4:[4,null], 6:[2, Uint16Array], 12:[2, null], 101:[0.5,null]}
	const zoomLevels = [
		0.1,
		0.2,
		0.3,
		0.4,
		0.5,
		0.6,
		0.7,
		0.8,
		0.9,
		1,
		1.5,
		2,
		3,
		5,
		7,
		10,
		15,
		20
	];

	const settings = getSettings();

	const isMac = settings.isMac;

	const vscode = acquireVsCodeApi();
	
	

	const initialState = vscode.getState() || { scale: 'fit', offsetX: 0, offsetY: 0 };

	// State
	let scale = initialState.scale;
	let ctrlPressed = false;
	let altPressed = false;
	let hasLoadedImage = false;
	let consumeClick = true;
	let isActive = false;
	var scrollTimer = -1;

	// Elements
	const container = document.body;
	const image = document.createElement('img');


	function updateSlice(newSlice) {
		if (!image || !hasLoadedImage || !image.parentElement) {
			return;
		}
		current_slice = clamp(newSlice, min_slice, max_slice);
		vscode.postMessage({
			type: 'message',
			value: "Going to slice " + newSlice + " now."
		});

		
		loadSlice();
	}

	function updateScale(newScale) {
		if (!image || !hasLoadedImage || !image.parentElement) {
			return;
		}

		if (newScale === 'fit') {
			scale = 'fit';
			image.classList.add('scale-to-fit');
			image.classList.remove('pixelated');
			image.style.minWidth = 'auto';
			image.style.width = 'auto';
			vscode.setState(undefined);
		} else {
			scale = clamp(newScale, MIN_SCALE, MAX_SCALE);
			if (scale >= PIXELATION_THRESHOLD) {
				image.classList.add('pixelated');
			} else {
				image.classList.remove('pixelated');
			}
			const dx = (window.scrollX + container.clientWidth / 2) / container.scrollWidth;
			const dy = (window.scrollY + container.clientHeight / 2) / container.scrollHeight;

			image.classList.remove('scale-to-fit');
			image.style.minWidth = `${(image.naturalWidth * scale)}px`;
			image.style.width = `${(image.naturalWidth * scale)}px`;

			const newScrollX = container.scrollWidth * dx - container.clientWidth / 2;
			const newScrollY = container.scrollHeight * dy - container.clientHeight / 2;

			window.scrollTo(newScrollX, newScrollY);

			vscode.setState({ scale: scale, offsetX: newScrollX, offsetY: newScrollY });
		}

		vscode.postMessage({
			type: 'zoom',
			value: scale
		});
	}

	function setActive(value) {
		isActive = value;
		if (value) {
			if (isMac ? altPressed : ctrlPressed) {
				container.classList.remove('zoom-in');
				container.classList.add('zoom-out');
			} else {
				container.classList.remove('zoom-out');
				container.classList.add('zoom-in');
			}
		} else {
			ctrlPressed = false;
			altPressed = false;
			container.classList.remove('zoom-out');
			container.classList.remove('zoom-in');
		}
	}

	function firstZoom() {
		if (!image || !hasLoadedImage) {
			return;
		}

		scale = image.clientWidth / image.naturalWidth;
		updateScale(scale);
	}

	function zoomIn() {
		if (scale === 'fit') {
			firstZoom();
		}

		let i = 0;
		for (; i < zoomLevels.length; ++i) {
			if (zoomLevels[i] > scale) {
				break;
			}
		}

		updateScale(zoomLevels[i] || MAX_SCALE);
	}

	function zoomOut() {
		if (scale === 'fit') {
			firstZoom();
		}

		let i = zoomLevels.length - 1;
		for (; i >= 0; --i) {
			if (zoomLevels[i] < scale) {
				break;
			}
		}
		updateScale(zoomLevels[i] || MIN_SCALE);
	}

	window.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
		if (!image || !hasLoadedImage) {
			return;
		}
		ctrlPressed = e.ctrlKey;
		altPressed = e.altKey;

		if (isMac ? altPressed : ctrlPressed) {
			container.classList.remove('zoom-in');
			container.classList.add('zoom-out');
		}
	});

	window.addEventListener('keyup', (/** @type {KeyboardEvent} */ e) => {
		if (!image || !hasLoadedImage) {
			return;
		}

		ctrlPressed = e.ctrlKey;
		altPressed = e.altKey;

		if (!(isMac ? altPressed : ctrlPressed)) {
			container.classList.remove('zoom-out');
			container.classList.add('zoom-in');
		}
	});

	container.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
		if (!image || !hasLoadedImage) {
			return;
		}

		if (e.button !== 0) {
			return;
		}

		ctrlPressed = e.ctrlKey;
		altPressed = e.altKey;

		consumeClick = !isActive;
	});

	container.addEventListener('click', (/** @type {MouseEvent} */ e) => {
		if (!image || !hasLoadedImage) {
			return;
		}

		if (e.button !== 0) {
			return;
		}

		if (consumeClick) {
			consumeClick = false;
			return;
		}
		// left click
		if (scale === 'fit') {
			firstZoom();
		}

		if (!(isMac ? altPressed : ctrlPressed)) { // zoom in
			zoomIn();
		} else {
			zoomOut();
		}
	});

	container.addEventListener('wheel', (/** @type {WheelEvent} */ e) => {
		// Prevent pinch to zoom
		if (e.ctrlKey) {
			e.preventDefault();
		}

		if (!image || !hasLoadedImage) {
			return;
		}

		const isScrollWheelKeyPressed = isMac ? altPressed : ctrlPressed || altPressed;

		if (!isScrollWheelKeyPressed && !e.ctrlKey && !e.altKey) { // pinching is reported as scroll wheel + ctrl
			return;
		}
		let delta = e.deltaY > 0 ? 1 : -1;
		if (e.altKey){
			

			current_slice = clamp(current_slice + delta, min_slice, max_slice);


			
			vscode.postMessage({
				type: 'slice',
				value: `${current_slice + 1}\/${max_slice + 1}`
			});
			loadSlice();
			// if (scrollTimer != -1){
			// 	clearTimeout(scrollTimer);
			// }
	
			// // scrollTimer = window.setTimeout(scrollFinished(), 500);
			// scrollTimer = window.setTimeout(scrollFinished,500)
		
			// function scrollFinished() {
				
			// 	loadSlice(delta);
			// }



			
		}
		if (e.ctrlKey){
			if (scale === 'fit') {
				firstZoom();
				
			}
			updateScale(scale * (1 - delta * SCALE_PINCH_FACTOR));
		}
		
		

		// 
	}, { passive: false });

	window.addEventListener('scroll', e => {
		if (!image || !hasLoadedImage || !image.parentElement || scale === 'fit') {
			return;
		}

		const entry = vscode.getState();
		if (entry) {
			vscode.setState({ scale: entry.scale, offsetX: window.scrollX, offsetY: window.scrollY });
		}
	}, { passive: true });

	container.classList.add('image');

	image.classList.add('scale-to-fit');

	image.addEventListener('load', () => {
		if (hasLoadedImage) {
			return;
		}
		hasLoadedImage = true;

		vscode.postMessage({
			type: 'size',
			value: `${image.naturalWidth}x${image.naturalHeight}`,
		});

		document.body.classList.remove('loading');
		document.body.classList.add('ready');
		document.body.append(image);

		updateScale(scale);

		if (initialState.scale !== 'fit') {
			window.scrollTo(initialState.offsetX, initialState.offsetY);
		}
	});

	image.addEventListener('error', e => {
		if (hasLoadedImage) {
			return;
		}

		hasLoadedImage = true;
		document.body.classList.add('error');
		document.body.classList.remove('loading');
	});

	setImageSrc(settings.src);

	document.querySelector('.open-file-link').addEventListener('click', () => {
		vscode.postMessage({
			type: 'reopen-as-text',
		});
	});

	window.addEventListener('message', e => {
		switch (e.data.type) {
			case 'setScale':
				updateScale(e.data.scale);
				break;

			case 'setActive':
				setActive(e.data.value);
				break;

			case 'zoomIn':
				zoomIn();
				break;

			case 'zoomOut':
				zoomOut();
				break;
			
			case 'setSlice':
				updateSlice(e.data.slice);
				break;
		}
	});
}());
