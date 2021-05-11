'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.run = run;
var FIRST_INDEX = 0;
var NOT_FOUND = 0;

var Sorters = {
	w: function w(a, b) {
		return b.w - a.w;
	},
	h: function h(a, b) {
		return b.h - a.h;
	},
	a: function a(_a, b) {
		return b.area - _a.area;
	},
	max: function max(a, b) {
		return Math.max(b.w, b.h) - Math.max(a.w, a.h);
	},
	min: function min(a, b) {
		return Math.min(b.w, b.h) - Math.min(a.w, a.h);
	}
};

var MultiSorters = {
	height: function height(a, b) {
		return msort(a, b, ['h', 'w']);
	},
	width: function width(a, b) {
		return msort(a, b, ['w', 'h']);
	},
	area: function area(a, b) {
		return msort(a, b, ['a', 'h', 'w']);
	},
	maxside: function maxside(a, b) {
		return msort(a, b, ['max', 'min', 'h', 'w']);
	}
};

function run(method, files) {
	if (method !== 'none') {
		var filter = MultiSorters[method];
		if (filter) {
			files.sort(filter);
		}
	}
};

function msort(a, b, criteria) {
	/* sort by multiple criteria */
	var diff, n;

	for (n = FIRST_INDEX; n < criteria.length; n++) {
		diff = Sorters[criteria[n]](a, b);

		if (diff !== FIRST_INDEX) {
			return diff;
		}
	}

	return NOT_FOUND;
}