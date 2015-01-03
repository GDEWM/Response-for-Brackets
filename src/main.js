/*The MIT License (MIT)

Copyright (c) 2014 Lee Brimelow

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, bitwise:true, indent: 4, maxerr: 150 */
/*global define, brackets, $, TweenMax */

/* This is eseentially all of the responsive feature stuffed into a single file */

define(function (require, exports, module) {
	"use strict";

	/*====================  Define constants  =====================*/

	var EXT_PREFIX				= "responsive",
		MENU_RESPONSE_ID		= EXT_PREFIX + ".mainmenu",
		CMD_RESPONSEMODE_ID		= EXT_PREFIX + ".cmd.launch",
		CMD_INSPECTMODE_ID		= EXT_PREFIX + ".cmd.inspect",
		CMD_HORZLAYOUT_ID		= EXT_PREFIX + ".cmd.horizontal",
		CMD_VERTLAYOUT_ID		= EXT_PREFIX + ".cmd.vertical",
		CMD_PREVIEWURL_ID		= EXT_PREFIX + ".cmd.livepreview",

		// The 'constant' for vertical or horizontal mode.
		VERTICAL = 0,
		HORIZONTAL = 1,

	/*================ Load needed brackets modules ================*/

		CommandManager			= brackets.getModule("command/CommandManager"),
		Menus					= brackets.getModule("command/Menus"),
		DocumentManager			= brackets.getModule("document/DocumentManager"),
		MainViewManager			= brackets.getModule("view/MainViewManager"),
		WorkspaceManager		= brackets.getModule("view/WorkspaceManager"),
		FileUtils				= brackets.getModule("file/FileUtils"),
		FileSystem				= brackets.getModule("filesystem/FileSystem"),
		ProjectManager			= brackets.getModule("project/ProjectManager"),
		EditorManager			= brackets.getModule("editor/EditorManager"),
		ExtensionUtils			= brackets.getModule("utils/ExtensionUtils"),
		AppInit					= brackets.getModule("utils/AppInit"),
		CSSUtils				= brackets.getModule("language/CSSUtils"),
		HTMLUtils				= brackets.getModule("language/HTMLUtils"),
		PreferencesManager		= brackets.getModule("preferences/PreferencesManager"),
	
	/*================  Load custom modules  ================*/

		// This is a much lighter-weight version of the MultiRangeInlineTextEditor.
		// Ideally I could would be able to use the InlineTextEditor we can't yet.
		ResponseInlineEdit		= require("widgets/ResponseInlineEdit").ResponseInlineEdit,

		// Used to ask users if they want to refresh preview pane when switching
		// between HTML documents
		DocReloadBar			= require("widgets/DocReloadBar").DocReloadBar,

		// This much lighter-weight version of the Resizer utility
		Splitter				= require("widgets/Splitter").Splitter,

		// Represents the toolbar at the top of the preview pane
		ResponseToolbar			= require("widgets/ResponseToolbar").ResponseToolbar,
		
		// Set of DOM and CSS utility methods.
		ResponseUtils			= require("utils/ResponseUtils"),

		// Set of DOM and CSS utility methods.
		DomCache				= require("utils/DomCache"),

		// represents a media query and its custom selectors/rules
		Query					= require("query/Query").Query,
		QueryManager			= require("query/QueryManager"),

		// Load the nls string module for this plugin. 
		Strings					= require("strings"),

	/*================  Define module properties  ================*/
	
		// Reference to the DocReloadBar
		docReloadBar,
	
		// Reference to the ResponseToolbar in the preview pane
		toolbar,
		
		// Configure preferences for the extension
		prefs = PreferencesManager.getExtensionPrefs(EXT_PREFIX),

		// Path to this extension.
		modulePath,

		// Path to the current open project.
		projectRoot,

		// Document for the generated media-queries.css file.
		mediaQueryDoc,

		// TODO: should be removed from global scope
		// Element whose CSS rules are being show in the inline editor.
		inlineElement,

		// The range element ruler which you drag to change width.
		slider,

		// Iframe containing the live HTML preview.
		frame,

		// The track indicator that display the current width of the slider
		trackLabel,

		// The track where the color media query bars are shown.
		track,

		// The .main-view div in Brackets core.
		mainView,

		// Main container for the response tools and iFrame.
		response,

		// + button for adding a new media query.
		addButt,

		// The current layout mode.
		mode = VERTICAL,

		// Document object of iframe.
		frameDOM,

		// The inspect mode toggle button.
		inspectButton,

		// Div that provides the dark overlay in inspect mode.
		highlight,

		// Is the code currently animating.
		isAnimating = false,

		// TODO: should be removed from global scope
		// Results returned from ResponseUtils.getAuthorCSSRules().
		cssResults,

		// A style block we will inject into the iframe.
		style,

		// TODO: should be removed from global scope
		// The selected line of code in the main editor.
		selected,

		// The splitter that allows resizing of the split view.
		splitter,

		// indicates whether we are currently working with livePreviewUrl or local files
		workingMode;
	
	/*================  Begin function definitions  ================*/

	/** 
	 *  Main entry point of extension that is called when responsive mode is launched.
	 */
	function Response(e) {

		if (e) { e.stopImmediatePropagation(); }
		
		var iconLink = document.getElementById('response-icon');

		// Prevent creating UI more than once
		if (document.querySelector('#response')) {

			// close any open inline editors
			_closeOpenInlineEditors();

			closeResponseMode();

			return;

		} else {

			// Ensure we can create a preview pane. Either the currently main
			// document needs to be an HTML doc or use the Live Preview URL if
			// it has been set
			var previewPaneUrl = _getPreviewPaneUrl();
			if (!previewPaneUrl) {
				return;
			}

			projectRoot = ProjectManager.getProjectRoot().fullPath;
			mainView = document.querySelector('.main-view');
			
			var mediaQueryFilePath = projectRoot + prefs.get("mediaQueryFile");
			
			// Check if the media-queries css file exists. If it doesn't, then create a
			// new file. If it does, then reload and refresh UI
			FileSystem.resolve(mediaQueryFilePath, function (result, file, fileSystemStats) {
				console.log("resolved path to media query file");
				
				// create an empty file as one doesn't exist yet                
				if ('NotFound' === result) {
					console.log("creating media query file: " + prefs.get("mediaQueryFile"));
					
					var mediaQueryFile = FileSystem.getFileForPath(mediaQueryFilePath);
					
					// create the parent dir if it doesn't yet exist. currently only supports a single node
					console.log("creating parent dir if it doesn't exist");
					var parentDir = FileSystem.getDirectoryForPath(mediaQueryFile.parentPath);
					parentDir.exists(function (error, exists) {
						if (!exists) {
							parentDir.create();
						}
					});
				
					console.log("writing to media query file to force create");
					mediaQueryFile.write('', function (error, stats) {
						console.log("error: " + error + "; stats: " + stats);
						if (error === null) {
							_getMediaQueryDocument(previewPaneUrl);
						}
					});
					console.log("write completed");
				
				} else {
					_getMediaQueryDocument(previewPaneUrl);
				}
				
				
			});
		}
		
		/**
		 * responsible to determine which URL to use in the iframe preview pane
		 */
		function _getPreviewPaneUrl() {
			
			var previewPaneUrl;
			
			workingMode = null;
			
			// check if we should be using the live preview url
			var command = CommandManager.get(CMD_PREVIEWURL_ID);
			if (command.getChecked()) {
				if (ProjectManager.getBaseUrl()) {
					previewPaneUrl = ProjectManager.getBaseUrl();
					workingMode = 'livePreviewUrl';
				} else {
					console.info("Live Preview Base URL not set under File > Project Settings. Need to let user know. defaulting to HTML file if it is open");
				}
			}
			
			// not configured to use live preview url. use current doc if it is an HTML
			if (!previewPaneUrl) {
				var currentDoc = DocumentManager.getCurrentDocument();
			
				// Only switch to responsive mode if the current document is HTML or 
				// a Live Preview Base URL has been defined under File > Project Settings and user
				// has chosen to open with Live Preview Base URL in the menu
				if (currentDoc !== null && currentDoc.language.getId() === "html") {
					previewPaneUrl = "file://" + currentDoc.file.fullPath;
					workingMode = 'local';
				} else {
					console.info("Unable to switch to Responsive mode as the current document is not HTML");
				}
			}

			// display message to user if unable to determine preview pane url
			if (!previewPaneUrl) {

				// Configure the twipsy
				var options = {
					placement: "left",
					trigger: "manual",
					autoHideDelay: 5000,
					title: function () {
						return Strings.ERR_PREVURL_UNAVAILABLE;
					}
				};


				// Show the twipsy with the explanation
				$("#response-icon").twipsy(options).twipsy("show");
			}
			
			return previewPaneUrl;
		}
		
		function _getMediaQueryDocument(previewPaneUrl) {
			
			console.log("getting document for media query");
			DocumentManager.getDocumentForPath(projectRoot + prefs.get("mediaQueryFile"))
				.done(function (doc) {
					console.log("retrieved document");

					// close any open inline editors
					_closeOpenInlineEditors();

					// Save reference to the new files document.
					mediaQueryDoc = doc;
					MainViewManager.addToWorkingSet(MainViewManager.ACTIVE_PANE, doc.file);

					// refresh media queries from file if they exist
					QueryManager.parseMediaQueries(doc.getText(), doc.getLanguage().getMode());
				
					// now we are ready to create the response UI
					createResponseUI(previewPaneUrl);

					// update toolbar icon to indicate we are in responsive mode
					iconLink.style.backgroundPosition = '0 -26px';
					document.body.classList.add('responsive-mode');

					var command = CommandManager.get(CMD_RESPONSEMODE_ID);
					command.setChecked(true);
				})
				.fail(function (error) {
					console.log("error: " + error);
				});
		}

		/**
		 * Responsible for closing any open inline editors.
		 *
		 * Note, we are making use of Document._masterEditor in order to get the editor
		 * associated to the document. This may not be 'legel' but seems to be the only
		 * way to get the editor associated to a document
		 */
		function _closeOpenInlineEditors() {

			var i, len;
			
			try {
				var openDocs = DocumentManager.getAllOpenDocuments();
				for (i = 0; i < openDocs.length; i++) {

					var editor = openDocs[i]._masterEditor;

					if (editor !== null) {
						var inlineWidgets = editor.getInlineWidgets();

						// when closing widgets, the array is being modified so need to 
						// iterate by modifying the length value
						len = inlineWidgets.length;
						while (len--) {
							EditorManager.closeInlineWidget(editor, inlineWidgets[len]);
						}
					}
				}
			} catch (err) {
				console.error("unexpected error occurred trying to close inline widgets", err);
			}
		}
	}

	/** 
	 *  Builds the UI for responsive mode. Lots of DOM injecting here.
	 */
	function createResponseUI(previewPaneUrl) {

		var doc = document;
		doc.body.backgroundColor = "#303030";

		var cm = EditorManager.getCurrentFullEditor()._codeMirror;

		// create response main container and add to body
		response = $('<div id="response" class="quiet-scrollbars"/>')[0];
		doc.body.insertBefore(response, doc.body.firstChild);

		// create toolbar and add to response div element
		toolbar = new ResponseToolbar();
		toolbar.resize(response.offsetWidth, true);
		toolbar.$toolbar.appendTo(response);

		toolbar.on('queryWidthChanged', function(e, newVal) {
			console.log("queryWidthChanged triggered: " + newVal);
		});
		
		// Insert the fragment into the main DOM.
		//doc.body.insertBefore(response, doc.body.firstChild);
		
		// Get references to all the main UI elements that we need.
		inspectButton = document.getElementById("inspectButton");
		addButt = document.getElementById("addButt");
		slider = document.getElementById("slider");
		track = document.getElementById("track");
		trackLabel = document.getElementById("track-label");

		// add click handler for vertical/horizontal layout buttons
		var horzLayoutBtn = document.getElementById("horzButt");
		horzLayoutBtn.addEventListener('click', handleHorzLayoutToggle, false);
		var vertLayoutBtn = document.getElementById("vertButt");
		vertLayoutBtn.addEventListener('click', handleVertLayoutToggle, false);

		// add click handler for refresh button
		var refreshBtn = document.getElementById("response-refresh");
		refreshBtn.addEventListener('click', handleRefreshClick, false);

		// Here I add the live preview iframe wrapped in a div.
		var domArray = [{tag: "div", attr: {id: "fwrap"}, parent: -1},
					{tag: "iframe", attr: {id: "frame", class: "quiet-scrollbars", name: "frame", src: previewPaneUrl}, parent: 0}];

		var frag = ResponseUtils.createDOMFragment(domArray);
		response.appendChild(frag);

		frame = doc.getElementById('frame');
		
		var h = window.innerHeight;

		// Set the initial heights of the panels to 60% response / 40% code editor.
		response.style.height = (h * 0.6) + 'px';
		mainView.style.height = (h - response.offsetHeight - 16) + 'px';

		// Create a vertical splitter to divide the editor and the response UI
		Splitter.makeResizable(response, 'vert', 100, cm);
		splitter = document.querySelector('.vert-splitter');
		
		// Manually fire the window resize event to position everything correctly.
		handleWindowResize(null);

		// Refresh codemirror
		cm.refresh();
	 
		setupEventHandlers();
	}

	/** 
	 *  Sets up all of the event listeners we need
	 */
	function setupEventHandlers() {

		// using jquery load event handling as this will trigger when iframe is reloaded
		// instead of only on the first time it is loaded.
		$(frame).on("load", handleFrameLoaded);
		
		frame.addEventListener('mouseout', handleFrameMouseOut, false);
		addButt.addEventListener('click', handleAddQuery, false);
		window.addEventListener('resize', handleWindowResize, false);
		$(response).on('panelResizeUpdate', handlePanelResize);
		inspectButton.addEventListener('click', handleInspectToggle, false);
	}

	/** 
	 *  Called when the user clicks on one of the editor layout
	 *  toggle buttons (either vertical or horizontal)
	 *
	 * note: the buttons are not named correctly. the 'horzButt' is actually 
	 * when the user is in vertical layout (up and down) while 'vertButt' is
	 * when the user is in horizontal layout (left to right). the code should
	 * be updated at some point to remove this confusion
	 */

	function handleHorzLayoutToggle(e) {

		var btnClicked = false;
		
		// if e is defined then it means the click came from the button in the preview pane. 
		// need to check if it is not already 'active' and signal it was clicked if it is 
		// not active
		if (e) {
			e.stopImmediatePropagation();
			btnClicked = !document.body.classList.contains('response-horz');
		}

		// check if the layout state has changed. making sure not clicking on an already
		// active menu
		var horzCmd = CommandManager.get(CMD_HORZLAYOUT_ID);
		if (btnClicked || !horzCmd.getChecked()) {
			
			// update menu state if not already correct
			horzCmd.setChecked(true);

			var vertCmd = CommandManager.get(CMD_VERTLAYOUT_ID);
			vertCmd.setChecked(false);
		
			// set the mode. would like to get rid of this variable and use menu state instead
			mode = HORIZONTAL;
			
			// update the layout if the preview pane is visible
			showHorizontalLayout();
		}
	}
	
	function handleVertLayoutToggle(e) {

		var btnClicked = false;
		
		// if e is defined then it means the click came from the button in the preview pane. 
		// need to check if it is not already 'active' and signal it was clicked if it is 
		// not active
		if (e) {
			e.stopImmediatePropagation();
			btnClicked = !document.body.classList.contains('response-vert');
		}

		// check if the layout state has changed. making sure not clicking on an already
		// active menu
		var vertCmd = CommandManager.get(CMD_VERTLAYOUT_ID);
		if (btnClicked || !vertCmd.getChecked()) {
			
			// update menu state if not already correct
			vertCmd.setChecked(true);

			var horzCmd = CommandManager.get(CMD_HORZLAYOUT_ID);
			horzCmd.setChecked(false);
		
			// set the mode. would like to get rid of this variable and use menu state instead
			mode = VERTICAL;
			
			// update the layout if the preview pane is visible
			showVerticalLayout();
		}
	}

	function showHorizontalLayout() {
		
		// Update only if the response element exists
		if (document.querySelector('#response')) {

			// update the global class to indicate layout
			document.body.classList.remove('response-vert');
			document.body.classList.add('response-horz');

			// clear any inline css rules on div#response and div.main-view
			response.style.cssText = null;
			mainView.style.cssText = null;

			// Remove the current panel splitter
			if (splitter !== undefined) {
				response.removeChild(splitter);
			}

			// Create a new splitter for this mode
			var cm = EditorManager.getCurrentFullEditor()._codeMirror;
			Splitter.makeResizable(response, 'horz', 344, cm);
			splitter = document.querySelector('.horz-splitter');
			splitter.style.right = '-16px';
			
			var w = window.innerWidth;

			// Change to a left/right layout
			response.style.width = (w * 0.5) + 'px';
			mainView.style.left = (response.offsetWidth + 15) + 'px';
			mainView.style.height = '100%';
			
			toolbar.resize(response.offsetWidth);
			
			// refresh layout
			WorkspaceManager.recomputeLayout(true);
		}
	}

	function showVerticalLayout() {
		
		// Update only if the response element exists
		if (document.querySelector('#response')) {

			// update the global class to indicate layout
			document.body.classList.remove('response-horz');
			document.body.classList.add('response-vert');

			// clear any inline css rules on div#response and div.main-view
			response.style.cssText = null;
			mainView.style.cssText = null;

			// Remove the current panel splitter
			if (splitter !== undefined) {
				response.removeChild(splitter);
			}

			// Create a new splitter for this mode
			var cm = EditorManager.getCurrentFullEditor()._codeMirror;
			Splitter.makeResizable(response, 'vert', 100, cm);

			splitter = document.querySelector('.vert-splitter');

			var h = window.innerHeight;

			// Change to a top/bottom layout
			response.style.height = (h * 0.6) + 'px';
			mainView.style.height = (h - response.offsetHeight - 16) + 'px';
			
			toolbar.resize(response.offsetWidth);
			
			// refresh layout
			WorkspaceManager.recomputeLayout(true);
		}
	}


	/**
	 * Called when user selects live preview menu item. If the menu item
	 * is enabled then the preview pane will load with the url specified under
	 * File > Project Settings
	 */
	function handleLivePreviewToggle(e) {
		
		if (e) {
			e.stopImmediatePropagation();
		}

		// update the inspect menu state
		var command = CommandManager.get(CMD_PREVIEWURL_ID);
		command.setChecked(!command.getChecked());
	}
	
	/** 
	 *  Called when the iframe DOM has fully loaded.
	 */
	function handleFrameLoaded(e) {

		if (e) {
			e.stopImmediatePropagation();
		}

		console.log("frame loaded event fired");
		
		// Store a reference to the iframe document.
		frameDOM = document.getElementById("frame").contentWindow.document;
		
		if (!frameDOM.body.firstElementChild) {
			
			// Configure the twipsy
			var options = {
				placement: "left",
				trigger: "manual",
				autoHideDelay: 5000,
				title: function () {
					return Strings.ERR_PREVURL_NOTLOADED;
				}
			};

			// Show the twipsy with the explanation
			$("#response-icon").twipsy(options).twipsy("show");
			
			return;
		}
		
		frameDOM.body.firstElementChild.style.overflowX = 'hidden';

		// Add an empty style block in the iframe head tag. This is where we
		// will write the CSS changes so they update live in the preview.
		style = frameDOM.head.appendChild(document.createElement('style'));
		style = style.appendChild(document.createTextNode(""));

		// Create the highlight effect div that we use when in inspect mode.
		highlight = document.createElement("div");
		highlight.id = "highlight";
		highlight.style.cssText = "outline: rgba(0, 0, 0, 0.617188) solid 2000px;display:none;-webkit-transition: top 0.2s, left 0.2s, width 0.2s, height 0.2s; -webkit-transition-timing-func: easeOut; position:absolute; width:354px; height:384px; background-color:transparent; top:1420px; z-index:0; left:713px; margin:0; padding:0;pointer-events:none;";

		// Add it to the frame body
		frameDOM.body.appendChild(highlight);

		// Listen for click events on the frame's body
		frameDOM.body.addEventListener('click', handleFrameClick, false);

		// update the inspect mode based on the menu state
		var command = CommandManager.get(CMD_INSPECTMODE_ID);
		toggleInspectMode(command.getChecked());

		// update the layout based on vert/horz mode
		var horzCmd = CommandManager.get(CMD_HORZLAYOUT_ID);
		if (horzCmd.getChecked()) {
			showHorizontalLayout();
		} else {
			showVerticalLayout();
		}
		
		// inject frame with media queries as inline style element
		displayQueryMarkTracks();
		refreshIFrameMediaQueries(false);
	}

	/**
	 * Called when user clicks on refresh button. simply reloads the current page
	 * in the preview pane
	 */
	function handleRefreshClick(e) {
		
		if (e) {
			e.stopImmediatePropagation();
		}

		frame.contentWindow.document.location.reload(true);
	}
	
	/** 
	 *  Called when user mouses off the iframe.
	 */
	function handleFrameMouseOut() {

		// Hide the highlight if the inline editor isn't open. Just a UI tweak.
		if (highlight) {
			highlight.style.display = 'none';
		}
	}

	/** 
	 *  Called when the user clicks on the + button to add a new query.
	 */
	function handleAddQuery() {
		
		var w = slider.value;
		
		// create the query mark at the top of the preview window
		// and set it as the current media query
		var query = QueryManager.addQueryMark(w);
		QueryManager.setCurrentQueryMark(query);
		displayQueryMarkTracks();

		// update inline editor with the newly selected query.
		updateInlineWidgets();

		// Calling this function will write the new query to the style block 
		// in the iframe and also to the media-queries.css file.
		refreshIFrameMediaQueries();
	}

	/**
	 * displays the media query tracks above the slider in the preview pane.
	 */
	function displayQueryMarkTracks() {

		var queries = QueryManager.getSortedQueryMarks(),
			query,
			mark,
			markStyle,
			i,
			z = 5000;
		
		for (i = 0; i < queries.length; i++) {
			
			query = queries[i];
			
			// if query mark div does not yet exist, create it and add to track
			mark = $('#queryMark' + query.width);
			if (mark.length === 0) {
				
				markStyle = {
					'width': query.width + 'px',
					'background': "url('file://" + modulePath + "/images/ruler_min.png') " +
						"0px 0px no-repeat, " +
						"-webkit-gradient(linear, left top, left bottom, from(" + query.color.t + "), to(" + query.color.b + "))"
				};
				
				mark = $("<div/>")
							.attr('id', 'queryMark' + query.width)
							.addClass('mark')
							.css(markStyle)
							.appendTo(track);
				$("<div/>").addClass("wd").text(query.width + 'px').appendTo(mark);
				
				// add listener for when user clicks on an item1
				mark.on('click', handleQueryClicked);
			}
			
			// update z-index on all elements so shorter widths have higher value (to make clickable)
			mark.css('z-index', z--);
		}
	}
	
	/** 
	 *  Called when the user clicks on one of the colored query marks in the track.
	 */
	function handleQueryClicked(e) {

		// parse the width from the id. 9 is the length of queryMark prefix in id
		var w = parseInt(e.target.id.substr(9), 10);
		var q = QueryManager.getQueryMark(w);

		// Set the clicked query as the current query.
		QueryManager.setCurrentQueryMark(q);

		// Snap the ruler and iframe to that query.
		slider.value = w;
		frame.style.width = w + "px";
		
		// update the track label with the current value
		trackLabel.textContent = slider.value + 'px';

		// In horizontal mode the code editor also snaps to the query width to give more space.      
		if (mode === HORIZONTAL) {
			Splitter.updateElement(w);
		}

		// Refresh codemirror
		var cm = EditorManager.getCurrentFullEditor()._codeMirror;
		cm.refresh();

		// update the inline editor with the newly selected query.
		updateInlineWidgets();
	}

	/** 
	 *  Called when the user resizes the brackets window.
	 */
	function handleWindowResize(e) {

		if (e) {
			e.stopImmediatePropagation();
		}

		var w = window.innerWidth;
		var h = window.innerHeight;

		// Get the width and height of the response UI
		var responseWidth = response.offsetWidth;
		var responseHeight = response.offsetHeight;

		toolbar.resize(responseWidth);

		// This gets called if we are in horizontal mode. Since the event can
		// be fired excessively, I use a bitwise operator to eek out some perf.
		if (mode & 1) {
			mainView.style.left = (responseWidth + 15) + 'px';
		} else {
			mainView.style.height = (h - responseHeight - 16) + 'px';
		}
	}

	/** 
	 *  Called when the user resizes the panels using the splitter.
	 */
	function handlePanelResize(e, size) {
  
		// Only refresh codemirror every other call (perf).    
		if (size & 1) {
			var cm = EditorManager.getCurrentFullEditor()._codeMirror;
			cm.refresh();
		}
		
		// Adjust things properly if in horizontal mode.
		if (mode & 1) {
			mainView.style.left = (parseInt(size, 10) + 15) + 'px';
			
			/* BR: refactor 1 */
			toolbar.resize(size);
			/*
			slider.value = slider.max = size;
			frame.style.width = slider.value + "px";

			// update the track label with the current value
			trackLabel.textContent = slider.value + 'px';
			*/
			
			return;
		}

		// Were in vertical mode so adjust things accordingly.
		mainView.style.height = (window.innerHeight - size - 16) + 'px';
	}


	/** 
	 *  Called when the user clicks on the inspect mode toggle button.
	 */
	function handleInspectToggle(e) {

		if (e) {
			e.stopImmediatePropagation();
		}

		// update the inspect menu state
		var command = CommandManager.get(CMD_INSPECTMODE_ID);
		command.setChecked(!command.getChecked());
		
		toggleInspectMode(command.getChecked());
	}
	
	function toggleInspectMode(enabled) {
		
		// update the state of the inspect button
		var inspectBtn = document.getElementById("inspectButton");
		if (inspectBtn) {
			
			// get code mirror from main editor
			var cm = EditorManager.getCurrentFullEditor()._codeMirror;
			
			// change the button visuals and remove any highlighted code lines
			// and the highlight div.
			
			if (enabled) {

				// if menu state is now checked, means it was just turned on. 
				inspectBtn.classList.add("inspectButtonOn");
				if (highlight) {
					highlight.style.display = 'block';
				}
				selected = null;
				frameDOM.body.addEventListener('mouseover', handleInspectHover, false);
				cm.display.wrapper.addEventListener('click', handleCodeClick, false);
				
			} else {

				// If menu state is no longer checked, then it was just turned off
				inspectBtn.classList.remove("inspectButtonOn");
				if (selected) {
					cm.removeLineClass(selected.line, "background");
				}
				if (highlight) {
					highlight.style.display = 'none';
				}
				cm.display.wrapper.removeEventListener('click', handleCodeClick);
				frameDOM.body.removeEventListener('mouseover', handleInspectHover);
				return;
				
			}
		}
	}

	/** 
	 *  Called when the user clicks on a line of code in the editor while in inspect mode.
	 */
	function handleCodeClick(e) {

		e.stopImmediatePropagation();

		// Ignore if the inline editor is open.
		if (isAnimating) {
			return;
		}

		// get code mirror from main editor
		var cm = EditorManager.getCurrentFullEditor()._codeMirror;

		// Get current cursor location.
		var cur = cm.getCursor(),
			line = cur.line;

		// Get the HTML tag name that the cursor is currently on.
		var tag = cm.getTokenAt(cur).state.htmlState.tagName;
		
		var ind;

		// If there is already a selected line with a highlight, remove the highlight.
		if (selected) {
			cm.removeLineClass(selected.line, "background");
		}

		var domCache = DomCache.getCache();

		// Check to see if the editor even contains any tags of this type.
		if (domCache.codeDom[tag]) {
			
			// Find out index position of the tag amongst all of the existing tags of this type.   
			ind = domCache.codeDom[tag].indexOf(line);
			
			// Now find the corrensponding DOM element using the position index.
			// IMPORTANT: If the user adds or changes lines in the HTML editor you will
			// need to rebuild the mapping cache. I never wrote the code for that.
			var el = domCache.frameDom[tag][ind];

			// Set the selected line object using the line number and DOM element.
			selected = {el: el, line: line};
			
			// If we found an element and the inline editor isn't open, then proceed.
			if (el) {
				
				// Boolean that tells you if the scroll position of the iframe is currently being animated.
				isAnimating = true;

				// Here we take the color of the current query and use it highlight the code line.
				var cq = QueryManager.getCurrentQueryMark();
				if (cq) {
					var cl = "l" + cq.colorIndex.toString();
					cm.addLineClass(line, "background", cl);
					
				} else {
					// If there is no current query, just make the highlight the blue color.
					cm.addLineClass(line, "background", "l0");
				}

				// The correct DOM element is now animated into view in the iframe using the
				// TweenMax library. This just animates the scrollTop property of the body.
				TweenMax.to(frameDOM.body, 0.8, {
					scrollTop: (el.offsetTop - frame.offsetHeight * 0.5) + el.offsetHeight * 0.5,
					ease: 'Expo.easeOut',
					onComplete: function () {
						isAnimating = false;
					}
				});

				// Adjust the highlight to show the selected element.
				positionHighlight(el);
			}
		}


	}

	/** 
	 *  Called when the user hovers over an element in the iframe while in inspect mode.
	 */
	function handleInspectHover(e) {

		e.stopImmediatePropagation();

		// position the highlight.
		positionHighlight(e.target);
	}

	/** 
	 *  Called when the user clicks on an element in the iframe while in inspect mode.
	 */
	function handleFrameClick(e) {

		e.stopImmediatePropagation();
		e.preventDefault();

		// If inline editor is open, say goodbye.
		if (!inspectButton.classList.contains("inspectButtonOn")) {
			return;
		}

		// get code mirror from main editor
		var cm = EditorManager.getCurrentFullEditor()._codeMirror;

		var target = e.target;

		// If there is already a selected line of code, remove the background highlight.
		if (selected) {
			cm.removeLineClass(selected.line, "background");
		}

		var tag = target.tagName.toLowerCase();
		var domCache = DomCache.getCache();

		// Find out the position index of the this tag in the cache.
		var ind = domCache.frameDom[tag].indexOf(target);

		// We'll use the codemirror scroller element to animate our code into view.
		var scroller = cm.display.scroller;
		window.scroller = scroller;
		var editorHeight = (scroller.offsetHeight > 0) ? scroller.offsetHeight : parseInt(scroller.style.height, 10);
		
		// Find out the correct line number from the cache.
		var line = domCache.codeDom[tag][ind];
		
		// Set this as the new selected line.
		selected = {el: target, line: line};
		
		// If there is a current query, use its color to highlight the code line.
		var cq = QueryManager.getCurrentQueryMark();
		if (cq) {
			var cl = "l" + cq.colorIndex.toString();
			cm.addLineClass(line, "background", cl);
			
		} else {
			// If there's not, just use the blue color.
			cm.addLineClass(line, "background", "l0");
		}
		
		// Calculate the correct scrollTop value that will make the line be in the center.
		var documentCurPos = cm.charCoords({line: line, ch: 0}, "local").bottom;
		var pos = documentCurPos - editorHeight * 0.5;

		var info = cm.getScrollInfo();
		pos = Math.min(Math.max(pos, 0), (info.height - info.clientHeight));
		
		// Use TweenMax to animate our code to the correct position. When the animation is
		// done we position the cursor on the that line inside the correct tag.
		TweenMax.to(scroller, 0.5, {
			scrollTop: pos,
			roundProps: 'scrollTop',
			ease: 'Expo.easeOut',
			onComplete: function () {
				cm.setCursor(line, cm.getLine(line).indexOf('<') + 1);
			}
		});
	}

	/** 
	 *  Called when the user chooses a CSS selector from the select box
	 *  that appears in the inline editor.
	 */
	function handleSelectorChange(e) {
		
		var newSelector = e.target.value,
			i,
			len;

		var inlineWidget = EditorManager.getFocusedInlineWidget();
		inlineWidget.currentSelector = newSelector;
		
		// Build the editor contents. 
		// Note: For some reason count is 0 when refreshed but 4 when editor is created
		var editorContents = refreshCodeEditor(QueryManager.getCurrentQueryMark(), cssResults, newSelector);

		// Set the text in the inline editor to our new string.
		var inlineCm = inlineWidget.editor._codeMirror;
		inlineCm.setValue(editorContents.contents);

		// Loop through the existingEdits array and highlight lines appropriately.
		var existingEdits = editorContents.existingEdits;
		for (i = 0, len = existingEdits.length; i < len; i++) {
			inlineCm.removeLineClass(existingEdits[i].line, "background");
			inlineCm.addLineClass(existingEdits[i].line, "background", "pq" + existingEdits[i].query.colorIndex);
		}
	}

	/** 
	 *  Function that positions the highlight over a certain DOM element.
	 *  @param: a DOM element you want to highlight.
	 *  The animation of the this highlight is all done using CSS transitions.
	 */
	function positionHighlight(el) {
		
		// If the element passed is bunk or were not in inspect mode, just leave. 
		if (!el || !inspectButton.classList.contains("inspectButtonOn")) {
			return;
		}

		var x = 0;
		var y = 0;

		// Create a temporary reference to the element.
		var tempEl = el;

		// This loop walks up the DOM tree and calculates the correct left
		// and top properties taking into account the element's ancestors.
		while (tempEl) {
			x += tempEl.offsetLeft;
			y += tempEl.offsetTop;
			tempEl = tempEl.offsetParent;
		}

		// Turn on the highlight and position the top and left.
		highlight.style.display = 'block';
		highlight.style.left = x + 'px';
		highlight.style.top = y + 'px';

		// Set the width and height based on either offset values or style properties.
		highlight.style.width = (el.offsetWidth > 0) ? el.offsetWidth + 'px' : el.style.width;
		highlight.style.height = (el.offsetHeight > 0) ? el.offsetHeight + 'px' : el.style.height;
		
	}

	/** 
	 *  This is where we setup and display the inline editor for doing quick edits.
	 *  @params: these 2 get sent when you register as an inline provider. The first
	 *  is the main or host editor and the second is the cursor position.
	 */
	function inlineEditorProvider(hostEditor, pos) {

		// uses the tagInfo from the editor to create adom element in the frame document
		// that needs to be parsed for editing. we don't look up the element as we need
		// more control in what is not included when getting the css rules associated to the
		// element
		function _getFrameElement(frameDom, tagInfo) {

			var element = frameDom.createElement(tagInfo.tagName);

			if (tagInfo.position.tokenType === HTMLUtils.ATTR_NAME || tagInfo.position.tokenType === HTMLUtils.ATTR_VALUE) {
				if (tagInfo.attr.name === "class") {
					// Class selector
					element.className = tagInfo.attr.value.trim();

				} else if (tagInfo.attr.name === "id") {
					// ID selector
					element.id = tagInfo.attr.value.trim();
				}
			}

			return element;
		}

		// Only provide a CSS editor when cursor is in HTML content
		if (hostEditor.getLanguageForSelection().getId() !== "html") {
			return null;
		}
				
		// Only provide CSS editor if the selection is within a single line
		var sel = hostEditor.getSelection();
		if (sel.start.line !== sel.end.line) {
			return null;
		}

		// We are not in responsive mode yet (toolbar icon not selected). Fallback
		// to the default CSS inline editor
		if (!document.querySelector('#response')) {
			return null;
		}
		
		// get code mirror from main editor
		var cm = EditorManager.getCurrentFullEditor()._codeMirror;

		// If there isn't a media query, show the message that a query has not been selected
		if (!QueryManager.getCurrentQueryMark()) {
			if (selected) {
				cm.removeLineClass(selected.line, "background");
			}
			hostEditor.displayErrorMessageAtCursor("There have not been any media queries defined.");
			return $.Deferred().promise();
		}
		
		// We are now going to write the string the temporary CSS file so we can display
		// it in the inline editor. A jQuery deffered object is used for async.
		var result = new $.Deferred();
				
		// If there is a selected line of code in the editor, remove the highlight.
		if (selected) {
			cm.removeLineClass(selected.line, "background");
		}

		// get the tag information for the currently cursor position in the HTML
		// document. If could not be determined then return so message is displayed to user
		var tagInfo = HTMLUtils.getTagInfo(hostEditor, pos);
		if (tagInfo.tagName === "") {
			return null;
		}
		
		// get the first element in the frame dom that matches the tagInfo
		var el = _getFrameElement(frameDOM, tagInfo);

		// Set this element to the inlineElement property that is used elsewhere.
		inlineElement = el;

		// Call my utility method that finds all of the CSS rules that are
		// currently set for this element. See the comments in ResponseUtils.js.
		cssResults = ResponseUtils.getAuthorCSSRules(frameDOM, el);
		
		var count = 4,
			i,
			len,
			cq = QueryManager.getCurrentQueryMark();

		// build the editor contents
		// The line count starts at 4 because of the selector, whitespace, etc.  
		// Note: For some reason count is 0 when refreshed but 4 when editor is created
		var editorContents = refreshCodeEditor(cq, cssResults);

		// Create a new inline editor. This is my stripped-down version of the
		// MultiRangeInlineEditor module.
		var inlineEditor = new ResponseInlineEdit();
		inlineEditor.editorNode = inlineElement;

		// Load the editor with the CSS we generated.
		inlineEditor.load(hostEditor, 0, count + 2, editorContents.contents);

		// Called when the editor is added to the DOM.
		inlineEditor.onAdded = function () {

			// Get a reference to the codemirror instance of the inline editor.
			var inlineCm = this.editor._codeMirror;

			// Loops through the existingEdits array and highlights the appropriate lines
			// in the inline editor.
			var existingEdits = editorContents.existingEdits;
			for (i = 0, len = existingEdits.length; i < len; i++) {
				inlineCm.removeLineClass(existingEdits[i].line, "background");
				inlineCm.addLineClass(existingEdits[i].line, "background", "pq" + existingEdits[i].query.colorIndex);
			}

			// Sets cursor to the end of line 2 in the inline editor.
			this.editor.setCursorPos(1, 0);

			// Listen for changes in the inline editor.
			inlineCm.on("change", inlineChange);

			this.refreshMediaQueryInfo(cq);
			this.refreshSelectorDropdown(cssResults);
			this.$selectorSelect[0].addEventListener('change', handleSelectorChange, false);
		};

		// Called when the inline editor is closed.
		inlineEditor.onClosed = function () {

			// Call parent function first.
			ResponseInlineEdit.prototype.parentClass.onAdded.apply(this, arguments);
		};

		// I had to mod the EditorManager module so it always chooses me.
		result.resolve(inlineEditor);

		return result.promise();
	}

	/**
	 *  refreshes the contents of the inline widget, showing the css rules of the
	 *  current css selector (from dropdown)
	 *
	 *  @params cq              : the current media query that has been selected from slider
	 *  @params res             : the css rules that were retrieved from the selected element in the
	 *                            main editor
	 *  @params currentSelector : the current css selector. If not supplied it will default to
	 *                            first css selector for the current element
	 */
	function refreshCodeEditor(cq, res, currentSelector) {

		currentSelector = currentSelector || res.selectors[0];
		
		// Array to hold information about whether a rule has already been set by this or another query.
		var existingEdits = [],

			// indicates the current line number. setting for 1 as the first line (0) is the selector
			lineNumber = 0,
			
			// used in iterator for properties
			prop,
			index,

			// Here we begin writing the string that we will use to populate the inline editor.
			str = currentSelector + " {\n";

		// Go through all of the returned CSS rules and write to the output string.
		if (res.rules[currentSelector] !== null) {
			for (prop in res.rules[currentSelector]) {

				var pvalue = null;
				lineNumber++;

				// Here we loop through all of the defined media queries to see if this rule
				// has already been set by one of them. This is used to show inheritance.
				var queries = QueryManager.getSortedQueryMarks();
				for (index in queries) {

					var q = queries[index];

					// If the media query (q) has a width greater than the currently selected
					// query and has already set a value for this property, then the current
					// query will inherit that value.
					if (q !== cq && parseInt(q.width, 10) > parseInt(cq.width, 10) &&
							q.selectors[currentSelector]) {

						// Check if it has the property set and if so, add it to the existingEdits
						// array so we can highlight it appropriately. Also stores the value.
						if (q.selectors[currentSelector].rules[prop]) {
							pvalue = q.selectors[currentSelector].rules[prop];
							existingEdits.push({query: q, line: lineNumber});
							pvalue = pvalue.replace(/;/, '');
							break;
						}

					} else if (cq === q && q.selectors[currentSelector]) {
						// Check if the currently selected query has this property already set.
						// If so then we add it to the existingEdits array for highlighting purposes.
						// It also stores the value 'pvalue' so we can use that in the output.

						if (q.selectors[currentSelector].rules[prop]) {
							pvalue = q.selectors[currentSelector].rules[prop];
							existingEdits.push({query: q, line: lineNumber});
							pvalue = pvalue.replace(/;/, '');
							break;
						}
					}
				}

				// If this property hasn't been set by anyone, we use the original value returned.
				if (!pvalue) {
					pvalue = res.rules[currentSelector][prop];
				}

				// Finally we add the CSS rule to the output string.
				str += "\t" + prop + ": " + pvalue.trim() + ";\n";
			}
		} else {
			// no rules so create an empty line
			str += "\t\n";
		}

		// Closing curly brace = we're done!
		str += "}";
		
		return { contents: str, existingEdits: existingEdits, numLines: lineNumber };
	}
	
	/** 
	 *  Called when there is a text change in the inline editor.
	 *
	 *  @params instance    : the codemirror instance,
	 *  @params change      : the change object.
	 */
	function inlineChange(instance, change) {

		// Make sure that the change is even worth looking at.
		if (change.text.length < 2 && change.from.line !== 0) {

			var currentQuery = QueryManager.getCurrentQueryMark();
			var inlineWidget = EditorManager.getFocusedInlineWidget();

			// Add the changed rule to the current query object.
			currentQuery.addRule(inlineWidget.currentSelector, instance.getLine(change.from.line));

			// If a previous query had this prop set, remove its background highlight.
			instance.removeLineClass(change.from.line, "background");

			// Add the new line highlight with the color of the current query.
			instance.addLineClass(change.from.line, "background", "pq" + currentQuery.colorIndex);

			// Write out the changes to the style block and the media queries CSS file.
			refreshIFrameMediaQueries();
		}

		// Adjust the highlight according to the new CSS value.
		positionHighlight(inlineElement);
	}

	/** 
	 *  Function that will update an already opened inline editor. This is called when
	 *  a new query is created or if one of the colored query marks has been clicked.
	 *  NOTE: There is quite a bit of duplicated code here from the inlineEditorProvider function.
	 */
	function updateInlineWidgets() {

		// get the inline widgets for the currently open document
		var hostEditor = EditorManager.getCurrentFullEditor();
		var inlineWidgets = hostEditor.getInlineWidgets();

		// Update the highlight.
		positionHighlight(inlineElement);

		var cq = QueryManager.getCurrentQueryMark(),
			i,
			j,
			len;

		for (j = 0; j < inlineWidgets.length; j++) {

			var inlineCodeMirror = inlineWidgets[j].editor._codeMirror;

			// update the background colour of the inline mark
			inlineWidgets[j].refreshMediaQueryInfo(cq);
			
			var existingEdits = [];

			// Refresh rules for current query and loop through.
			cssResults = ResponseUtils.getAuthorCSSRules(frameDOM, inlineWidgets[j].editorNode);
			inlineWidgets[j].refreshSelectorDropdown(cssResults);

			// Build the editor contents.
			// Note: For some reason count is 0 when refreshed but 4 when editor is created
			var editorContents = refreshCodeEditor(cq, cssResults);

			// Set the text in the inline editor to our new string.
			inlineCodeMirror.setValue(editorContents.contents);

			// Loop through the existingEdits array and highlight lines appropriately.
			existingEdits = editorContents.existingEdits;

			for (i = 0, len = existingEdits.length; i < len; i++) {
				inlineCodeMirror.removeLineClass(existingEdits[i].line, "background");
				inlineCodeMirror.addLineClass(existingEdits[i].line, "background", "pq" + existingEdits[i].query.colorIndex);
			}
		}
	}

	/** 
	 *  Function that goes through all of the media query data and writes it to the 
	 *  style block in the iframe and also to the media-queries.css file.
	 */
	function refreshIFrameMediaQueries(writeToFile) {
		
		// Defining some vars we'll need.
		var s = "",
			sortedQueries = QueryManager.getSortedQueryMarks(),
			i = sortedQueries.length,
			query,
			sel,
			k;
		
		// Loop through the queries and write them to the output string.
		while (i--) {

			// We need to sort the queries so the larger widths are written first
			// in order for inheritance to work properly.
			query = sortedQueries[i];

			s += '@media only screen and (max-width:';
			s += query.width;
			s += 'px) {\n\n';
			for (sel in query.selectors) {
				s += '\t' + sel + ' {\n';
				for (k in query.selectors[sel].rules) {
					s += '\t\t' + k + ": " + query.selectors[sel].rules[k] + '\n';
				}
				s += '\t}\n\n';
			}
			s += '}\n';
		}
		
		// Set the style block in the iframe using the output string. 
		style.textContent = s;
		
		// Write the new text to the media-queries.css file.
		if (writeToFile === undefined || writeToFile) {
			FileUtils.writeText(mediaQueryDoc.file, s);
		}
	}

	function updateCurrentFile(e, newFile, newPaneId, oldFile, oldPaneId) {

		try {
			var currentDoc = DocumentManager.getCurrentDocument();
			if (document.querySelector('#response') && workingMode === 'local' && currentDoc !== null && currentDoc.language.getId() === "html") {
				// open the doc reload bar so user can decide if the preview pane should be reloaded
				docReloadBar.open();
			}
		} catch (err) {
			console.error("unexpected error occurred trying to handle currentFileChange event", err);
		}
	}
	
	function closeResponseMode() {

		// close docReloadBar if it is still open
		docReloadBar.close();

		// ensure inspect mode is off so handlers are removed 
		// but don't update inspect mode menu item
		toggleInspectMode(false);

		// deselect the current query and queries
		QueryManager.clearQueryMarks();
		
		// remove the #response view
		var element = document.getElementById("response");
		if (element) {
			element.parentNode.removeChild(element);

			// Manually fire the window resize event to position everything correctly.
			handleWindowResize(null);
			response = null;

			// refresh layout
			WorkspaceManager.recomputeLayout(true);
		}

		// update toolbar icon and menu state to indicate we are leaving responsive mode
		var iconLink = document.getElementById('response-icon');
		iconLink.style.backgroundPosition = '0 0';
		document.body.classList.remove('responsive-mode');

		var command = CommandManager.get(CMD_RESPONSEMODE_ID);
		command.setChecked(false);
	}
	
	function buildMenuSystem() {
		
		// Build commands and menu system
		var customMenu = Menus.addMenu(Strings.MENU_MAIN, MENU_RESPONSE_ID, Menus.AFTER, Menus.AppMenuBar.NAVIGATE_MENU);

		CommandManager.register(Strings.SUBMENU_RESPSONSEMODE, CMD_RESPONSEMODE_ID, Response);
		customMenu.addMenuItem(CMD_RESPONSEMODE_ID, "Shift-Alt-R");

		// Toggle inspect mode.
		CommandManager.register(Strings.SUBMENU_INSPECTMODE, CMD_INSPECTMODE_ID, handleInspectToggle);
		customMenu.addMenuItem(CMD_INSPECTMODE_ID, "Shift-Alt-I");

		customMenu.addMenuDivider();

		// add menu items to indicate if horizontal or vertical layout should be used for the preview
		// pane
		CommandManager.register(Strings.SUBMENU_HORZLAYOUT, CMD_HORZLAYOUT_ID, handleHorzLayoutToggle);
		customMenu.addMenuItem(CMD_HORZLAYOUT_ID, "Shift-Alt-H");

		CommandManager.register(Strings.SUBMENU_VERTLAYOUT, CMD_VERTLAYOUT_ID, handleVertLayoutToggle);
		customMenu.addMenuItem(CMD_VERTLAYOUT_ID, "Shift-Alt-V");

		customMenu.addMenuDivider();

		// Add menu item to indicate if live preview url setting should be used for preview pane
		CommandManager.register(Strings.SUBMENU_PREVIEWURL, CMD_PREVIEWURL_ID, handleLivePreviewToggle);
		customMenu.addMenuItem(CMD_PREVIEWURL_ID, "Shift-Alt-U");
	}
	
	/** 
	 *  Called when brackets has opened and is ready.
	 */
	AppInit.appReady(function () {
		// Here we add the toolbar icon that launches you into responsive mode.
		var icon = document.createElement('a');
		icon.href = "#";
		icon.id = "response-icon";

		var iconURL = require.toUrl('./images/toolbar-icon.png');
		icon.style.cssText = "content: ''; background: url('" + iconURL + "') 0 0 no-repeat;";

		document.querySelector('#main-toolbar .buttons').appendChild(icon);
		icon.addEventListener('click', Response, false);

		docReloadBar = new DocReloadBar();
	});

	modulePath = FileUtils.getNativeModuleDirectoryPath(module);

	// Is there a brackets function for loading non-module scripts?
	// I couldn't find one so I wrote a simple one.
	ResponseUtils.loadExternalScript(modulePath + "/js/TweenMax.min.js", document.head);

	// Load in the main CSS for the responsive UI.
	ExtensionUtils.addLinkedStyleSheet(modulePath + "/css/respond.css");
	
	prefs.definePreference("mediaQueryFile", "string", "css/media-queries.css");
	prefs.definePreference("preferredLayout", "string", "vertical").on("change", function () {
		
		if (prefs.get("preferredLayout").toLowerCase() === "horizontal") {
			handleHorzLayoutToggle();
		} else {
			handleVertLayoutToggle();
		}
	});

	prefs.definePreference("useLivePreviewUrl", "boolean", false).on("change", function () {

		var command = CommandManager.get(CMD_PREVIEWURL_ID);

		// update the live preview url menu state
		if (prefs.get("useLivePreviewUrl")) {
			command.setChecked(true);
		} else {
			command.setChecked(false);
		}
	});

	buildMenuSystem();

	MainViewManager.on("currentFileChange", $.proxy(updateCurrentFile));
	ProjectManager.on("beforeProjectClose", $.proxy(closeResponseMode));

	// Register as an inline provider.
	EditorManager.registerInlineEditProvider(inlineEditorProvider, 9);
});
