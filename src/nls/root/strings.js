/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

// English - root strings

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define */

define({
	"MENU_RESPONSE_ID"				: "responsive.cmd.mainmenu",
	"CMD_RESPONSEMODE_ID"			: "responsive.cmd.launch",
	"CMD_INSPECTMODE_ID"			: "responsive.cmd.inspect",
	"CMD_HORZLAYOUT_ID"				: "responsive.cmd.horizontal",
	"CMD_VERTLAYOUT_ID"				: "responsive.cmd.vertical",
	"CMD_PREVIEWURL_ID"				: "responsive.cmd.livepreview",
	
	"MENU_MAIN"                     : "Response",
	"SUBMENU_RESPSONSEMODE"         : "Responsive Mode",
	"SUBMENU_INSPECTMODE"           : "Inspect Mode",
	"SUBMENU_HORZLAYOUT"            : "Horizontal View",
	"SUBMENU_VERTLAYOUT"            : "Vertical View",
	"SUBMENU_PREVIEWURL"            : "Use Live Preview URL",
	"ERR_PREVURL_UNAVAILABLE"       : "Unable to switch to Responsive Mode as the current file is not an HTML document and/or the Live Preview URL is not correctly configured",
	"ERR_PREVURL_NOTLOADED"         : "Unable to load the preview pane due to misconfiguration. Please check Live Preview URL settings",
	
	DOCRELOAD_MSG                   : "Do you wish to reload the preview pane with the current document",
	DOCRELOAD_OK                    : "Yes",
	DOCRELOAD_OK_HINT               : "Clicking will reload the preview pane",
	DOCRELOAD_CANCEL                : "No",
	DOCRELOAD_CANCEL_HINT           : "Clicking will leave the preview pane unchanged",
	
	TOOLBAR_INSPECTLABEL			: "Inspect",
	TOOLBAR_INSPECT_TITLE			: "Enable/Disable the Inspect feature",
	TOOLBAR_LAYOUTLABEL				: "Layout",
	TOOLBAR_HORZ_TITLE				: "Switch to Horizontal Layout",
	TOOLBAR_VERT_TITLE				: "Switch to Vertical Layout",
	TOOLBAR_REFRESH_TITLE			: "Reloads the preview pane",
	TOOLBAR_ADD_TITLE				: "Adds a new media query"
});