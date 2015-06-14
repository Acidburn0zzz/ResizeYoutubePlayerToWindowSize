// ==UserScript==
// @name            Resize YT To Window Size
// @description     Moves the YouTube video to the top of the website and resizes it to the window size.
// @author          Chris H (Zren / Shade)
// @icon            https://youtube.com/favicon.ico
// @homepageURL     https://github.com/Zren/ResizeYoutubePlayerToWindowSize/
// @namespace       http://xshade.ca
// @version         66
// @include         http*://*.youtube.com/*
// @include         http*://youtube.com/*
// @include         http*://*.youtu.be/*
// @include         http*://youtu.be/*
// ==/UserScript==

// Github:          https://github.com/Zren/ResizeYoutubePlayerToWindowSize
// GreasyFork:      https://greasyfork.org/scripts/811-resize-yt-to-window-size
// OpenUserJS.org:  https://openuserjs.org/scripts/zren/Resize_YT_To_Window_Size
// Userscripts.org: http://userscripts-mirror.org/scripts/show/153699

(function (window) {
    "use strict";
    
    //--- Imported Globals
    // yt
    // ytcenter
    // ytplayer
    var uw = window.top;

    //--- Already Loaded?
    // GreaseMonkey loads this script twice for some reason.
    if (uw.ytwp) return;

    //--- Utils
    function isStringType(obj) { return typeof obj === 'string'; }
    function isArrayType(obj) { return obj instanceof Array; }
    function isObjectType(obj) { return typeof obj === 'object'; }
    function isUndefined(obj) { return typeof obj === 'undefined'; }
    function buildVenderPropertyDict(propertyNames, value) {
        var d = {};
        for (var i in propertyNames)
            d[propertyNames[i]] = value;
        return d;
    }

    //--- jQuery
    // Based on jQuery
    // https://github.com/jquery/jquery/blob/master/src/manipulation.js
    var core_rnotwhite = /\S+/g;
    var rclass = /[\t\r\n\f]/g;
    var rtrim = /^(\s|\u00A0)+|(\s|\u00A0)+$/g;

    var jQuery = {
        trim: function( text ) {
            return (text || "").replace( rtrim, "" );
        },
        addClass: function( elem, value ) {
            var classes, cur, clazz, j,
                proceed = typeof value === "string" && value;

            if ( proceed ) {
                // The disjunction here is for better compressibility (see removeClass)
                classes = ( value || "" ).match( core_rnotwhite ) || [];

                cur = elem.nodeType === 1 && ( elem.className ?
                    ( " " + elem.className + " " ).replace( rclass, " " ) :
                    " "
                );

                if ( cur ) {
                    j = 0;
                    while ( (clazz = classes[j++]) ) {
                        if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
                            cur += clazz + " ";
                        }
                    }
                    elem.className = jQuery.trim( cur );
                }
            }
        },
        removeClass: function( elem, value ) {
            var classes, cur, clazz, j,
                proceed = arguments.length === 0 || typeof value === "string" && value;

            if ( proceed ) {
                classes = ( value || "" ).match( core_rnotwhite ) || [];

                // This expression is here for better compressibility (see addClass)
                cur = elem.nodeType === 1 && ( elem.className ?
                    ( " " + elem.className + " " ).replace( rclass, " " ) :
                    ""
                );

                if ( cur ) {
                    j = 0;
                    while ( (clazz = classes[j++]) ) {
                        // Remove *all* instances
                        while ( cur.indexOf( " " + clazz + " " ) >= 0 ) {
                            cur = cur.replace( " " + clazz + " ", " " );
                        }
                    }
                    elem.className = value ? jQuery.trim( cur ) : "";
                }
            }
        }
    };


    //--- Stylesheet
    var JSStyleSheet = function(id) {
        this.id = id;
        this.stylesheet = '';
    };

    JSStyleSheet.prototype.buildRule = function(selector, styles) {
        var s = "";
        for (var key in styles) {
            s += "\t" + key + ": " + styles[key] + ";\n";
        }
        return selector + " {\n" + s + "}\n";
    };

    JSStyleSheet.prototype.appendRule = function(selector, k, v) {
        if (isArrayType(selector))
            selector = selector.join(',\n');
        var newStyle;
        if (!isUndefined(k) && !isUndefined(v) && isStringType(k)) { // v can be any type (as we stringify it).
            var d = {};
            d[k] = v;
            newStyle = this.buildRule(selector, d);
        } else if (!isUndefined(k) && isUndefined(v) && isObjectType(k)) {
            newStyle = this.buildRule(selector, k);
        } else {
            // Invalid Arguments
            console.log('Illegal arguments', arguments);
            return;
        }

        this.stylesheet += newStyle;
    };

    JSStyleSheet.injectIntoHeader = function(injectedStyleId, stylesheet) {
        var styleElement = document.getElementById(injectedStyleId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.type = 'text/css';
            styleElement.id = injectedStyleId;
            document.getElementsByTagName('head')[0].appendChild(styleElement);
        }
        styleElement.appendChild(document.createTextNode(stylesheet));
    };

    JSStyleSheet.prototype.injectIntoHeader = function(injectedStyleId, stylesheet) {
        JSStyleSheet.injectIntoHeader(this.id, this.stylesheet);
    };

    //--- Constants
    var scriptShortName = 'ytwp'; // YT Window Player
    var scriptStyleId = scriptShortName + '-style'; // ytwp-style
    var scriptBodyClassId = scriptShortName + '-window-player'; // .ytwp-window-player
    var viewingVideoClassId = scriptShortName + '-viewing-video'; // .ytwp-viewing-video
    var topOfPageClassId = scriptShortName + '-scrolltop'; // .ytwp-scrolltop
    var scriptBodyClassSelector = 'body.' + scriptBodyClassId; // body.ytwp-window-player

    var videoContainerId = 'player';
    var videoContainerPlacemarkerId = scriptShortName + '-placemarker'; // ytwp-placemarker

    var transitionProperties = ["transition", "-ms-transition", "-moz-transition", "-webkit-transition", "-o-transition"];
    var transformProperties = ["transform", "-ms-transform", "-moz-transform", "-webkit-transform", "-o-transform"];

    //--- YTWP
    var ytwp = uw.ytwp = {
        scriptShortName: scriptShortName, // YT Window Player
        log_: function(logger, args) { logger.apply(console, ['[' + this.scriptShortName + '] '].concat(Array.prototype.slice.call(args))); return 1; },
        log: function() { return this.log_(console.log, arguments); },
        error: function() { return this.log_(console.error, arguments); },

        initialized: false,
        pageReady: false,
        watchPage: false,
    };

    ytwp.util = {
        isWatchUrl: function (url) {
            if (!url)
                url = uw.location.href;
            return url.match(/https?:\/\/(www\.)?youtube.com\/watch\?/);
        }
    };

    var Html5PlayerFix = {
        YTRect: null,
        YTApplication: null,
        playerInstances: null,
        moviePlayerElement: null,
    };
    Html5PlayerFix.getPlayerRect = function() {
        return new Html5PlayerFix.YTRect(Html5PlayerFix.moviePlayerElement.clientWidth, Html5PlayerFix.moviePlayerElement.clientHeight);
    };
    Html5PlayerFix.getApplicationClass = function() {
        if (Html5PlayerFix.YTApplication === null) {
            var testEl = document.createElement('div');
            var testAppInstance = uw.yt.player.Application.create(testEl, {});
            Html5PlayerFix.YTApplication = testAppInstance.constructor;

            // Cleanup testAppInstance
            var playerInstances = Html5PlayerFix.getPlayerInstances();

            var testAppInstanceKey = null;
            Object.keys(playerInstances).forEach(function(key) {
                if (playerInstances[key] === testAppInstance) {
                    testAppInstanceKey = key;
                }
            });
            testAppInstance.dispose();
            delete playerInstances[testAppInstanceKey];
            
        }


        return Html5PlayerFix.YTApplication;
    };
    Html5PlayerFix.getPlayerInstances = function() {
        if (Html5PlayerFix.playerInstances === null) {
            var YTApplication =  Html5PlayerFix.getApplicationClass();
            if (YTApplication === null)
                return null;

            // Use yt.player.Application.create to find the playerInstancesKey.
            // function (a,b){try{var c=t$.B(a);if(t$.j[c]){try{t$.j[c].dispose()}catch(d){cg(d)}t$.j[c]=null}var e=new t$(a,b);Ji(e,function(){t$.j[c]=null});return t$.j[c]=e}catch(g){throw cg(g),g;}}
            var appCreateRegex = /^function \(a,b\)\{try\{var c=([a-zA-Z_$][\w_$]*)\.([a-zA-Z_$][\w_$]*)\(a\);if\(([a-zA-Z_$][\w_$]*)\.([a-zA-Z_$][\w_$]*)\[c\]\)/;
            var fnString = yt.player.Application.create.toString();
            var m = appCreateRegex.exec(fnString);
            if (m) {
                var playerInstancesKey = m[4];
                Html5PlayerFix.playerInstances = YTApplication[playerInstancesKey];
            } else {
                ytwp.error('Error trying to find playerInstancesKey.', fnString);
            }
            Html5PlayerFix.playerInstances = YTApplication.j;
        }

        return Html5PlayerFix.playerInstances;
    };
    Html5PlayerFix.getPlayerInstance = function() {
        if (!ytwp.ytapp) {
            var playerInstances = Html5PlayerFix.getPlayerInstances();
            ytwp.log('playerInstances', playerInstances);
            var appInstance = null;
            var appInstanceKey = null;
            Object.keys(playerInstances).forEach(function(key) {
                appInstanceKey = key;
                appInstance = playerInstances[key];
            });
            ytwp.ytapp = appInstance;
        }
        return ytwp.ytapp;
    };
    Html5PlayerFix.autohideControls = function() {
        var moviePlayerElement = document.getElementById('movie_player');
        if (!moviePlayerElement) return;
        // ytwp.log(moviePlayerElement.classList);
        jQuery.removeClass(moviePlayerElement, 'autohide-controlbar autominimize-controls-aspect autohide-controls-fullscreenonly autohide-controls hide-controls-when-cued autominimize-progress-bar autominimize-progress-bar-fullscreenonly autohide-controlbar-fullscreenonly autohide-controls-aspect autohide-controls-fullscreen autominimize-progress-bar-non-aspect');
        jQuery.addClass(moviePlayerElement, 'autominimize-progress-bar autohide-controls hide-controls-when-cued');
        // ytwp.log(moviePlayerElement.classList);
    };
    Html5PlayerFix.update = function() {
        if (!Html5PlayerFix.playerInstances)
            return;
        for (var key in Html5PlayerFix.playerInstances) {
            var playerInstance = Html5PlayerFix.playerInstances[key];
            Html5PlayerFix.updatePlayerInstance(playerInstance);
        }
    };
    Html5PlayerFix.updatePlayerInstance = function(app) {
        if (!app) {
            return;
        }

        var moviePlayerElement = document.getElementById('movie_player');
        var moviePlayer = null;
        var moviePlayerKey = null;

        // function (a){var b=this.j.X(),c=n$.L.xb.call(this);a||"detailpage"!=b.ma||b.ib||b.experiments.T||(c.height+=30);return c}
        // function (a){var b=this.app.X(),c=n$.M.xb.call(this);a||!JK(b)||b.ab||b.experiments.U||(c.height+=30);return c}
        var clientRectFnRegex1 = /^(function \(a\)\{var b=this\.([a-zA-Z_$][\w_$]*)\.([a-zA-Z_$][\w_$]*)\(\)).*(\|\|\(c\.height\+=30\);return c})$/;
        // function (){var a=this.A.U();if(window.matchMedia){if((a.wb||a.Fb)&&window.matchMedia("(width: "+window.innerWidth+"px) and (height: "+window.innerHeight+"px)").matches)return new H(window.innerWidth,window.innerHeight);if("detailpage"==a.ja&&"blazer"!=a.j&&!a.Fb){a=a.experiments.A;if(window.matchMedia(S6.C).matches)return new H(426,a?280:240);var b=this.A.ha;if(window.matchMedia(b?S6.o:S6.j).matches)return new H(1280,a?760:720);if(b||window.matchMedia(S6.A).matches)return new H(854,a?520:480);if(window.matchMedia(S6.B).matches)return new H(640,a?400:360)}}return new H(this.element.clientWidth,this.element.clientHeight)}
        var clientRectFnRegex2 = /^(function \()(.|\n)*(return new ([a-zA-Z_$][\w_$]*)\(this\.element\.clientWidth,this\.element\.clientHeight\)})$/;
        var clientRectFn = null;
        var clientRectFnKey = null;

        var fnAlreadyReplacedCount = 0;

        Object.keys(app).forEach(function(key1) {
            var val1 = app[key1];//console.log(key1, val1);
            if (typeof val1 === 'object' && val1 !== null && val1.element === moviePlayerElement) {
                moviePlayer = val1;
                moviePlayerKey = key1;

                Object.keys(moviePlayer.constructor.prototype).forEach(function(key2) {
                    var val2 = moviePlayer[key2];//console.log(key1, key2, val2);
                    if (typeof val2 === 'function') {
                        var fnString = val2.toString();
                        // console.log(fnString);
                        if (clientRectFn === null && (clientRectFnRegex1.test(fnString) || clientRectFnRegex2.test(fnString))) {
                            clientRectFn = val2;
                            clientRectFnKey = key2;
                        } else if (val2 === Html5PlayerFix.getPlayerRect) {
                            fnAlreadyReplacedCount += 1;
                        } else {
                            // console.log(key1, key2, val2, '[Not Used]');
                        }
                    }
                });
            }
        });

        if (fnAlreadyReplacedCount > 0) {
            return;
        }

        if (moviePlayer === null || clientRectFn === null) {
            console.log('[ytwp] ', '[Error]', 'HTML5 Player has changed or there\'s multiple playerInstances and this one has been destroyed.');
            console.log('moviePlayer', moviePlayerKey, moviePlayer);
            console.log('clientRectFn', clientRectFnKey, clientRectFn);
            console.log('fnAlreadyReplacedCount', fnAlreadyReplacedCount);
            return;
        }
        
        Html5PlayerFix.moviePlayerElement = moviePlayerElement;
        Html5PlayerFix.YTRect = moviePlayer[clientRectFnKey].call(moviePlayer).constructor;

        moviePlayer[clientRectFnKey] = Html5PlayerFix.getPlayerRect;
    };
    ytwp.Html5PlayerFix = Html5PlayerFix;

    ytwp.event = {
        init: function() {
            ytwp.log('init');
            if (!ytwp.initialized) {
                ytwp.isWatchPage = ytwp.util.isWatchUrl();
                if (ytwp.isWatchPage) {
                    ytwp.event.initStyle();
                    ytwp.event.initScroller();
                    ytwp.initialized = true;
                    ytwp.pageReady = false;
                }
            }
            ytwp.event.onWatchInit();
            ytwp.event.html5PlayerFix();
        },
        initScroller: function() {
            // Register listener & Call it now.
            unsafeWindow.addEventListener('scroll', ytwp.event.onScroll, false);
            unsafeWindow.addEventListener('resize', ytwp.event.onScroll, false);
            ytwp.event.onScroll();
        },
        onScroll: function() {
            var viewportHeight = document.documentElement.clientHeight;

            // topOfPageClassId
            if (unsafeWindow.scrollY == 0) {
                jQuery.addClass(document.body, topOfPageClassId);
            } else {
                jQuery.removeClass(document.body, topOfPageClassId);
            }

            // viewingVideoClassId
            if (unsafeWindow.scrollY <= viewportHeight) {
                jQuery.addClass(document.body, viewingVideoClassId);
            } else {
                jQuery.removeClass(document.body, viewingVideoClassId);
            }
        },
        initStyle: function() {
            ytwp.log('initStyle');
            ytwp.style = new JSStyleSheet(scriptStyleId);
            ytwp.event.buildStylesheet();
            ytwp.style.injectIntoHeader();
        },
        buildStylesheet: function() {
            ytwp.log('buildStylesheet');
            //--- Video Player

            //
            var d;
            d = buildVenderPropertyDict(transitionProperties, 'left 0s linear, padding-left 0s linear');
            d['padding'] = '0 !important';
            d['margin'] = '0 !important';
            ytwp.style.appendRule([
                scriptBodyClassSelector + ' #player',
                scriptBodyClassSelector + '.ytcenter-site-center.ytcenter-non-resize.ytcenter-guide-visible #player',
                scriptBodyClassSelector + '.ltr.ytcenter-site-center.ytcenter-non-resize.ytcenter-guide-visible.guide-collapsed #player',
                scriptBodyClassSelector + '.ltr.ytcenter-site-center.ytcenter-non-resize.ytcenter-guide-visible.guide-collapsed #player-legacy',
                scriptBodyClassSelector + '.ltr.ytcenter-site-center.ytcenter-non-resize.ytcenter-guide-visible.guide-collapsed #watch7-main-container',
            ], d);
            //
            d = buildVenderPropertyDict(transitionProperties, 'width 0s linear, left 0s linear');

            // Bugfix for Firefox
            // Parts of the header (search box) are hidden under the player.
            // Firefox doesn't seem to be using the fixed header+guide yet.
            d['float'] = 'initial';

            // Skinny mode
            d['left'] = 0;
            d['margin-left'] = 0;

            ytwp.style.appendRule(scriptBodyClassSelector + ' #player-api', d);

            // Theatre mode
            ytwp.style.appendRule(scriptBodyClassSelector + ' .watch-stage-mode #player .player-api', {
                'left': 'initial',
                'margin-left': 'initial',
            });
                

            // !important is mainly for simplicity, but is needed to override the !important styling when the Guide is open due to:
            // .sidebar-collapsed #watch7-video, .sidebar-collapsed #watch7-main, .sidebar-collapsed .watch7-playlist { width: 945px!important; }
            // Also, Youtube Center resizes #player at element level.
            ytwp.style.appendRule(
                [
                    scriptBodyClassSelector + ' #player',
                    scriptBodyClassSelector + ' #movie_player',
                    scriptBodyClassSelector + ' #player-mole-container',
                    scriptBodyClassSelector + ' .html5-video-container',
                    scriptBodyClassSelector + ' .html5-main-video',
                ],
                {
                    'width': '100% !important',
                    'min-width': '100% !important',
                    'max-width': '100% !important',
                    'height': '100% !important',
                    'min-height': '100% !important',
                    'max-height': '100% !important',
                }
            );

             ytwp.style.appendRule(
                [
                    scriptBodyClassSelector + ' #player',
                    scriptBodyClassSelector + ' .html5-main-video',
                ],
                {
                    'top': '0 !important',
                    'right': '0 !important',
                    'bottom': '0 !important',
                    'left': '0 !important',
                }
            );
            // Resize #player-unavailable, #player-api
            // Using min/max width/height will keep
            ytwp.style.appendRule(scriptBodyClassSelector + ' #player .player-width', 'width', '100% !important');
            ytwp.style.appendRule(scriptBodyClassSelector + ' #player .player-height', 'height', '100% !important');

            //--- Move Video Player
            ytwp.style.appendRule(scriptBodyClassSelector + ' #player', {
                'position': 'absolute',
                // Already top:0; left: 0;
            });
            ytwp.style.appendRule(scriptBodyClassSelector, { // body
                'margin-top': '100vh',
            });


            //--- Sidebar
            // Remove the transition delay as you can see it moving on page load.
            d = buildVenderPropertyDict(transitionProperties, 'margin-top 0s linear, padding-top 0s linear');
            d['margin-top'] = '0 !important';
            d['top'] = '0 !important';
            ytwp.style.appendRule(scriptBodyClassSelector + ' #watch7-sidebar', d);

            ytwp.style.appendRule(scriptBodyClassSelector + '.cardified-page #watch7-sidebar-contents', 'padding-top', '0');

            //--- Absolutely position the fixed header.
            // Masthead
            d = buildVenderPropertyDict(transitionProperties, 'top 0s linear !important');
            ytwp.style.appendRule(scriptBodyClassSelector + '.hide-header-transition #masthead-positioner', d);
            ytwp.style.appendRule(scriptBodyClassSelector + '.' + viewingVideoClassId + ' #masthead-positioner', {
                'position': 'absolute',
                'top': '100% !important'
            });

            // Guide
            // When watching the video, we need to line it up with the masthead.
            ytwp.style.appendRule(scriptBodyClassSelector + '.' + viewingVideoClassId + ' #appbar-guide-menu', {
                'display': 'initial',
                'position': 'absolute',
                'top': '100% !important' // Masthead height
            });
            ytwp.style.appendRule(scriptBodyClassSelector + '.' + viewingVideoClassId + ' #page.watch #guide', {
                'display': 'initial',
                'margin': '0',
                'position': 'initial'
            });

            //---
            // Hide Scrollbars
            ytwp.style.appendRule(scriptBodyClassSelector + '.' + topOfPageClassId, 'overflow-x', 'hidden');


            //--- Fix Other Possible Style Issues
            ytwp.style.appendRule(scriptBodyClassSelector + ' #placeholder-player', 'display', 'none');
            ytwp.style.appendRule(scriptBodyClassSelector + ' #watch-sidebar-spacer', 'display', 'none');
            ytwp.style.appendRule(scriptBodyClassSelector + ' .skip-nav', 'display', 'none');

            //--- Whitespace Leftover From Moving The Video
            ytwp.style.appendRule(scriptBodyClassSelector + ' #page.watch', 'padding-top', '0');
            ytwp.style.appendRule(scriptBodyClassSelector + ' .player-branded-banner', 'height', '0');

            //--- Playlist Bar
            ytwp.style.appendRule([
                scriptBodyClassSelector + ' #placeholder-playlist',
                scriptBodyClassSelector + ' #player .player-height#watch-appbar-playlist',
            ], 'height', '490px !important');
            d = buildVenderPropertyDict(transitionProperties, 'transform 0s linear');
            ytwp.style.appendRule(scriptBodyClassSelector + ' #watch-appbar-playlist', d);
            d = buildVenderPropertyDict(transformProperties, 'translateY(0px)');
            d['margin-left'] = '0';
            d['top'] = 'calc(100vh + 60px)';
            ytwp.style.appendRule(scriptBodyClassSelector + ' #player .player-height#watch-appbar-playlist', d);
            ytwp.style.appendRule(scriptBodyClassSelector + ' .playlist-videos-list', 'height', '430px');
        },
        onWatchInit: function() {
            ytwp.log('onWatchInit');
            if (!ytwp.initialized) return;
            if (ytwp.pageReady) return;

            ytwp.event.addBodyClass();
            ytwp.pageReady = true;
        },
        onDispose: function() {
            ytwp.log('onDispose');
            ytwp.initialized = false;
            ytwp.pageReady = false;
            ytwp.isWatchPage = false;
            ytwp.ytapp = null;
        },
        addBodyClass: function() {
            // Insert CSS Into the body so people can style around the effects of this script.
            jQuery.addClass(document.body, scriptBodyClassId);
            ytwp.log('Applied ' + scriptBodyClassSelector);
        },
        html5PlayerFix: function() {
            ytwp.log('html5PlayerFix');

            // https://github.com/YePpHa/YouTubeCenter/issues/1083
            if (!uw.ytcenter
                && (!ytwp.ytapp)
                && (uw.ytplayer && uw.ytplayer.config)
                && (uw.yt && uw.yt.player && uw.yt.player.Application && uw.yt.player.Application.create)
            ) {
                ytwp.ytapp = Html5PlayerFix.getPlayerInstance();
            }

            Html5PlayerFix.update();
            Html5PlayerFix.autohideControls();
        },

    };


    ytwp.pubsubListeners = {
        'init': function() { // Not always called
            ytwp.event.init();
        },
        'init-watch': function() { // Not always called
            ytwp.event.init();
        },
        'player-added': function() { // Not always called
            // Usually called after init-watch, however this is called before init when going from channel -> watch page.
            // The init event is when the body element resets all it's classes.
            ytwp.event.init();
        },
        // 'player-resize': function() {},
        // 'player-playback-start': function() {},
        'appbar-guide-delay-load': function() {
            // Listen to a later event that is always called in case the others are missed.
            ytwp.event.init();

            // Channel -> /watch
            if (ytwp.util.isWatchUrl())
                ytwp.event.addBodyClass();
        },
        // 'dispose-watch': function() {},
        'dispose': function() {
            ytwp.event.onDispose();
        }
    };

    ytwp.registerYoutubeListeners = function() {
        ytwp.registerYoutubePubSubListeners();
    };

    ytwp.registerYoutubePubSubListeners = function() {
        // Subscribe
        for (var eventName in ytwp.pubsubListeners) {
            var eventListener = ytwp.pubsubListeners[eventName];
            uw.yt.pubsub.instance_.subscribe(eventName, eventListener);
        }
    };

    ytwp.main = function() {
        try {
            ytwp.registerYoutubeListeners();
        } catch(e) {
            ytwp.error("Could not hook yt.pubsub", e);
            setTimeout(ytwp.main, 1000);
        }
        ytwp.event.init();
    };

    ytwp.main();
    
})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
