var igv = (function (igv) {

    const MIN_TRACK_WIDTH = 500;

    igv.Browser = function (options, trackContainer) {

        igv.browser = this;   // Make globally visible (for use in html markup).

        this.div = $('<div id="igvRootDiv" class="igv-root-div">')[0];


        this.trackHeight = options.trackHeight || 100;

        this.flanking = options.flanking;

        this.controlPanelWidth = options.controlPanelWidth || 50;

        this.type = options.type || "IGV";

        this.searchURL = options.searchURL || "http://www.broadinstitute.org/webservices/igv/locus?genome=hg19&name=";

        $("input[id='trackHeightInput']").val(this.trackHeight);


        this.trackContainerDiv = trackContainer;

        addTrackContainerHandlers(trackContainer);

        this.trackPanels = [];
        this.nextTrackOrder = 0;

        window.onresize = igv.throttle(function () {
            igv.browser.resize();
        }, 10);

    };

    igv.Browser.prototype.loadTrack = function (config) {

        if (this.didAttemptedDuplicateTrackAddition(config)) {
            return;
        }

        var path = config.url,
            type = config.type,
            newTrack;

        if (!type) type = getType(path);

        if (type === "t2d") {
            newTrack = new igv.T2dTrack(config);
        } else if (type === "bed") {
            newTrack = new igv.GeneTrack(config);
        } else if (type === "bam") {
            newTrack = new igv.BAMTrack(config);
        } else if (type === "wig") {
            newTrack = new igv.WIGTrack(config);
        } else if(type === "sequence") {
            newTrack = new igv.SequenceTrack(config);
        }
        else {
            alert("Unknown file type: " + path);
            return null;
        }

        // TODO -- error message "unsupported filed type"
        this.addTrack(newTrack);

        return newTrack;


    };

    igv.Browser.prototype.didAttemptedDuplicateTrackAddition = function (config) {

        var attemptedDuplicateTrackAddition = false;

        this.trackPanels.forEach(function (tp) {

            if (false === attemptedDuplicateTrackAddition) {

                if (JSON.stringify(config) === JSON.stringify(tp.track.config)) {
                    attemptedDuplicateTrackAddition = true;
                }
            }
        });

        if (true === attemptedDuplicateTrackAddition) {
            window.alert("Attempt to load duplicate track.");
            return true;
        }

        return false;

    };

    // Get the file type from the path extension
    function getType(path) {
        if (path.endsWith(".bed") || path.endsWith(".bed.gz")) {
            return "bed";
        } else if (path.endsWith(".bam")) {
            return "bam"
        } else if (path.endsWith(".wig") || path.endsWith(".wig.gz") || path.endsWith(".bedgraph") || path.endsWith(".bedgraph.gz")
            || path.endsWith(".bw") || path.endsWith(".bigwig")) {
            return "wig"
        }
        return null;  // Unknown
    }

    /**
     * Add a new track.  Each track is associated with the following DOM elements
     *
     *      controlDiv  - div on the left for track controls and legend
     *      contentDiv  - a div element wrapping all the track content.  Height can be > viewportDiv height
     *      viewportDiv - a div element through which the track is viewed.  This might have a vertical scrollbar
     *      canvas     - canvas element upon which the track is drawn.  Child of contentDiv
     *
     * The width of all elements should be equal.  Height of the viewportDiv is controlled by the user, but never
     * greater than the contentDiv height.   Height of contentDiv and canvas are equal, and governed by the data
     * loaded.
     *
     * trackFilterJSON session data is optionally passes as a param to restore a trackFilters state
     *
     * @param track
     * @param trackFilterJSON
     */
    igv.Browser.prototype.addTrack = function (track) {

        var browser = this,
            trackView = new igv.TrackView(track, this);

        if (!track.order) {
            track.order = (this.nextTrackOrder)++;
//            track.order = this.trackPanels.length;
        }

        this.trackPanels.push(trackView);

        this.reorderTracks();

        if (this.cursorModel) {
            this.cursorModel.initializeHistogram(trackView.track, function () {
                browser.resize();
            });
        }
        else {
            this.resize();
            //trackView.repaint();
        }

    };

    igv.Browser.prototype.reorderTracks = function () {

        var browser = this;

        this.trackPanels.sort(function (a, b) {
            var aOrder = a.track.order || 0;
            var bOrder = b.track.order || 0;
            return aOrder - bOrder;
        });
        // Reattach the divs to the dom in the correct order
        $(this.trackContainerDiv).children().detach();
        this.trackPanels.forEach(function (tp) {
            browser.trackContainerDiv.appendChild(tp.trackDiv);
        });
    }

    igv.Browser.prototype.removeTrack = function (track) {

        // Find track panel
        var trackPanelRemoved;
        for (var i = 0; i < this.trackPanels.length; i++) {
            if (track === this.trackPanels[i].track) {
                trackPanelRemoved = this.trackPanels[i];
                break;
            }
        }

        if (trackPanelRemoved) {
            this.trackPanels.splice(this.trackPanels.indexOf(trackPanelRemoved), 1);
            this.trackContainerDiv.removeChild(trackPanelRemoved.trackDiv);
        }

    };

    igv.Browser.prototype.setTrackHeight = function (newHeight) {

        this.trackHeight = newHeight;

        this.trackPanels.forEach(function (panel) {
            panel.setTrackHeight(newHeight);
        });

    };

    igv.Browser.prototype.resize = function () {
        if (this.ideoPanel) this.ideoPanel.resize();
        if (this.karyoPanel) this.karyoPanel.resize();
        this.trackPanels.forEach(function (panel) {
            panel.resize();
        })
    }

    igv.Browser.prototype.repaint = function () {

        if (this.ideoPanel) {
            this.ideoPanel.repaint();
        }

        if (this.karyoPanel) {
            this.karyoPanel.repaint();
        }
        this.trackPanels.forEach(function (trackView) {
            trackView.repaint();
        });

        if (this.cursorModel) {
            this.horizontalScrollbar.update();
        }

    };

    igv.Browser.prototype.update = function () {

        if (this.ideoPanel) {
            this.ideoPanel.repaint();
        }

        if (this.karyoPanel) {
            this.karyoPanel.repaint();
        }
        this.trackPanels.forEach(function (trackPanel) {

            trackPanel.update();

        });

        if (this.cursorModel) {
            this.horizontalScrollbar.update();
        }
    };

    /**
     * Return the visible width of a track.  All tracks should have the same width.
     */
    igv.Browser.prototype.trackViewportWidth = function () {

        var width;

        if (this.trackPanels && this.trackPanels.length > 0) {
            width = this.trackPanels[0].viewportDiv.clientWidth;
        }
        else {
            width = this.trackContainerDiv.clientWidth;
        }

        return Math.max(MIN_TRACK_WIDTH, width);

    }

    igv.Browser.prototype.goto = function (chr, start, end) {

        console.log("goto " + chr + " : " + start + "-" + end);

        if (igv.popover) {
            igv.popover.hide();
        }

        // GTEX HACK -- need aliases
        if (this.type === "GTEX" && !chr.startsWith("chr")) chr = "chr" + chr;

        var w,
            chromosome,
            viewportWidth = this.trackViewportWidth();

        this.referenceFrame.chr = chr;

        // If end is undefined,  interpret start as the new center, otherwise compute scale.
        if (!end) {
            w = Math.round(viewportWidth * this.referenceFrame.bpPerPixel / 2);
            start = Math.max(0, start - w);
        }
        else {
            this.referenceFrame.bpPerPixel = (end - start) / (viewportWidth);
        }

        if (this.genome) {
            if (!end) end = start + viewportWidth * this.referenceFrame.bpPerPixel;
            chromosome = this.genome.getChromosome(this.referenceFrame.chr);
            if (chromosome && end > chromosome.bpLength) {
                start -= (end - chromosome.bpLength);
            }
        }

        this.referenceFrame.start = start;

        this.update();
    }

    // Zoom in by a factor of 2, keeping the same center location
    igv.Browser.prototype.zoomIn = function () {

        var newScale, center, viewportWidth;
        viewportWidth = this.trackViewportWidth();

        newScale = Math.max(1 / 14, this.referenceFrame.bpPerPixel / 2);
        if (newScale == this.referenceFrame.bpPerPixel) return;

        center = this.referenceFrame.start + this.referenceFrame.bpPerPixel * viewportWidth / 2;
        this.referenceFrame.start = center - newScale * viewportWidth / 2;
        this.referenceFrame.bpPerPixel = newScale;
        this.update();
    }

    // Zoom out by a factor of 2, keeping the same center location if possible
    igv.Browser.prototype.zoomOut = function () {

        var newScale, maxScale, center, chrLength, widthBP, viewportWidth;
        viewportWidth = this.trackViewportWidth();

        newScale = this.referenceFrame.bpPerPixel * 2;
        chrLength = 250000000;
        if (this.genome) {
            var chromosome = this.genome.getChromosome(this.referenceFrame.chr);
            if (chromosome) {
                chrLength = chromosome.bpLength;
            }
        }
        maxScale = chrLength / viewportWidth;
        if (newScale > maxScale) newScale = maxScale;

        center = this.referenceFrame.start + this.referenceFrame.bpPerPixel * viewportWidth / 2;
        widthBP = newScale * viewportWidth;

        this.referenceFrame.start = Math.round(center - widthBP / 2);

        if (this.referenceFrame.start < 0) this.referenceFrame.start = 0;
        else if (this.referenceFrame.start > chrLength - widthBP) this.referenceFrame.start = chrLength - widthBP;

        this.referenceFrame.bpPerPixel = newScale;
        this.update();
    }

    igv.Browser.prototype.search = function (feature, continuation) {

        console.log("Search " + feature);

        if (feature.contains(":") && feature.contains("-")) {

            var tokens = feature.split(":");
            var chr = tokens[0];
            var posTokens = tokens[1].split("-");
            var start = parseInt(posTokens[0].replace(/,/g, "")) - 1;
            var end = parseInt(posTokens[1].replace(/,/g, ""));

            if (end > start) {
                this.goto(chr, start, end);
            }
            if (continuation) continuation();

        }

        else {

            if (this.searchURL) {

//                var spinner = igv.getSpinner(this.trackContainerDiv);
                var url = this.searchURL + feature;
                var browser = this;

                igv.loadData(url, function (data) {

//                    spinner.stop();

                    var lines = data.split("\n"),
                        len = lines.length,
                        lineNo = 0,
                        foundFeature = false;

                    while (lineNo < len) {
                        // EGFR	chr7:55,086,724-55,275,031	refseq
                        var line = lines[lineNo++];
                        //console.log(line);
                        var tokens = line.split("\t");
                        //console.log("tokens lenght = " + tokens.length);
                        if (tokens.length >= 3) {
                            var f = tokens[0];
                            if (f.toUpperCase() == feature.toUpperCase()) {

                                var source = tokens[2].trim();
                                var type = source == "gtex" ? 'snp' : 'gene';

                                var locusTokens = tokens[1].split(":");
                                var chr = locusTokens[0].trim();
                                var rangeTokens = locusTokens[1].split("-");
                                var start = parseInt(rangeTokens[0].replace(/,/g, ''));
                                var end = parseInt(rangeTokens[1].replace(/,/g, ''));

                                if (browser.flanking) {
                                    start -= browser.flanking;
                                    end += browser.flanking;
                                }

                                if (browser.type === "GTEX") {
                                    igv.selection = new igv.GtexSelection(type == 'gene' ? {gene: feature} : {snp: feature});
                                    browser.goto(chr, start, end);
                                    browser.update();
                                }
                                else {
                                    browser.goto(chr, start, end);
                                }
                                foundFeature = true;
                            }
                        }
                    }

                    if (!foundFeature) alert('No feature found with name "' + feature + '"');

                    if (continuation) continuation();
                });
            }
        }
    }

    function addTrackContainerHandlers(trackContainerDiv) {

        var isMouseDown = false,
            lastMouseX = undefined,
            mouseDownX = undefined;

        $(trackContainerDiv).mousedown(function (e) {
            var coords = igv.translateMouseCoordinates(e, trackContainerDiv);
            isMouseDown = true;
            lastMouseX = coords.x;
            mouseDownX = lastMouseX;
        });

        $(trackContainerDiv).mousemove(igv.throttle(function (e) {

                var browser = igv.browser,
                    coords = igv.translateMouseCoordinates(e, trackContainerDiv),
                    pixels,
                    pixelsEnd,
                    referenceFrame = browser.referenceFrame,
                    isCursor = browser.cursorModel;

                if (!referenceFrame) return;

                if (isMouseDown) { // Possibly dragging

                    if (mouseDownX && Math.abs(coords.x - mouseDownX) > igv.constants.dragThreshold) {

                        referenceFrame.shiftPixels(lastMouseX - coords.x);

                        // TODO -- clamping code below is broken for regular IGV => disabled for now, needs fixed

                        if (isCursor) {

                            // clamp left
                            referenceFrame.start = Math.max(0, referenceFrame.start);

                            // clamp right
                            pixelsEnd = isCursor ?
                                Math.floor(browser.cursorModel.framePixelWidth * browser.cursorModel.filteredRegions.length) :
                                250000000;    // TODO -- get from reference frame, this is the chr length.

                            // Use this for IGV clamping
//                    if (igv.genome) {
//
//                        var chromosome = igv.genome.getChromosome(igv.referenceFrame.chr);
//                        var widthBP = Math.round((igv.trackWidth - igv.labelWidth) * igv.referenceFrame.bpPerPixel);
//                        var endBP = igv.referenceFrame.start + widthBP;
//                        if (chromosome && endBP > chromosome.length) {
//                            if (endBP > chromosome.length) {
//                                igv.referenceFrame.start = chromosome.length - widthBP;
//                            }
//                        }
//                    }


                            pixels = Math.floor(browser.referenceFrame.toPixels(referenceFrame.start) + browser.trackViewportWidth());

                            if (pixels >= pixelsEnd) {
                                referenceFrame.start = browser.referenceFrame.toBP(pixelsEnd - browser.trackViewportWidth());
                            }
                        }

                        browser.repaint();
                    }

                    lastMouseX = coords.x;

                }

            }

            ,
            10
        ))
        ;

        $(trackContainerDiv).mouseup(function (e) {
            mouseDownX = undefined;
            isMouseDown = false;
            lastMouseX = undefined;
        });

        $(trackContainerDiv).mouseleave(function (e) {
            isMouseDown = false;
            lastMouseX = undefined;
            mouseDownX = undefined;
        });

        $(trackContainerDiv).dblclick(function (e) {

            e = $.event.fix(e);   // Sets pageX and pageY for browsers that don't support them

            var canvasCoords = igv.translateMouseCoordinates(e, trackContainerDiv),
                referenceFrame = igv.browser.referenceFrame;

            if (!referenceFrame) return;

            var newCenter = Math.round(referenceFrame.start + canvasCoords.x * referenceFrame.bpPerPixel);
            referenceFrame.bpPerPixel /= 2;
            if (igv.browser.cursorModel) {
                igv.browser.cursorModel.framePixelWidth *= 2;
            }
            igv.browser.goto(referenceFrame.chr, newCenter);

        });

    }

    return igv;
})
(igv || {});


