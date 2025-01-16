"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SegmentTrackAction = void 0;
const Hub = require("../../hub");
const segment_1 = require("./segment");
class SegmentTrackAction extends segment_1.SegmentAction {
    constructor() {
        super(...arguments);
        this.name = "segment_track";
        this.label = "Segment Track";
        this.iconName = "segment/segment.png";
        this.description = "Add traits via track to your Segment users.";
        this.minimumSupportedLookerVersion = "5.5.0";
    }
    async execute(request) {
        return this.executeSegment(request, segment_1.SegmentCalls.Track);
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [{
                name: "event",
                label: "Event",
                description: "The name of the event you’re tracking.",
                type: "string",
                required: true,
            }];
        return form;
    }
}
exports.SegmentTrackAction = SegmentTrackAction;
Hub.addAction(new SegmentTrackAction());
